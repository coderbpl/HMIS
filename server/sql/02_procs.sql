/* HMIS functions + stored procedures. The API's DAM mssql adapter calls ONLY
   these — no ad-hoc SQL. Names match server/src/dam/mssqlAdapter.js. */
USE HMIS;
GO

/* ---------- FUNCTIONS ---------- */

-- Next per-department, per-day token sequence number.
CREATE OR ALTER FUNCTION dbo.fn_NextTokenNumber (@DeptId TINYINT, @OnDate DATE)
RETURNS INT
AS
BEGIN
  RETURN (SELECT ISNULL(MAX(SeqNo), 0) + 1 FROM dbo.Tokens
          WHERE DeptId = @DeptId AND TokenDate = @OnDate);
END;
GO

-- Display token: Series + zero-padded sequence, e.g. 'A-07'.
CREATE OR ALTER FUNCTION dbo.fn_DisplayToken (@DeptId TINYINT, @SeqNo INT)
RETURNS VARCHAR(8)
AS
BEGIN
  RETURN (SELECT Series FROM dbo.Departments WHERE DeptId = @DeptId)
         + '-' + RIGHT('00' + CAST(@SeqNo AS VARCHAR(4)), 2);
END;
GO

-- Position in the waiting line (1 = next after the current consult).
CREATE OR ALTER FUNCTION dbo.fn_QueuePosition (@TokenId INT)
RETURNS INT
AS
BEGIN
  DECLARE @pos INT = 0;
  SELECT @pos = COUNT(*)
  FROM dbo.Tokens q
  JOIN dbo.Tokens t ON t.TokenId = @TokenId
  WHERE q.TokenDate = t.TokenDate AND q.DeptId = t.DeptId
    AND q.Status = 'waiting'
    AND (q.Priority > t.Priority OR (q.Priority = t.Priority AND q.SeqNo <= t.SeqNo));
  RETURN @pos;
END;
GO

-- Privacy mask for the public board: 'Ramesh Patel' -> 'R****h P.'
CREATE OR ALTER FUNCTION dbo.fn_MaskName (@Name NVARCHAR(120))
RETURNS NVARCHAR(40)
AS
BEGIN
  DECLARE @first NVARCHAR(60) = LEFT(@Name, CHARINDEX(' ', @Name + ' ') - 1);
  DECLARE @restInitial NVARCHAR(2) = CASE WHEN CHARINDEX(' ', @Name) > 0
    THEN ' ' + LEFT(LTRIM(SUBSTRING(@Name, CHARINDEX(' ', @Name), 120)), 1) + '.' ELSE '' END;
  RETURN CASE WHEN LEN(@first) <= 2 THEN @first
    ELSE LEFT(@first,1) + REPLICATE('*', LEN(@first)-2) + RIGHT(@first,1) END + @restInitial;
END;
GO

/* ---------- PROCEDURES ---------- */

CREATE OR ALTER PROCEDURE dbo.usp_User_GetByUsername @Username NVARCHAR(64)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT u.UserId, u.Username, u.FullName, u.PassHash, r.RoleName
  FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
  WHERE u.Username = @Username AND u.IsActive = 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Patient_Create
  @FullName NVARCHAR(120), @Mobile VARCHAR(15), @Age INT, @Sex CHAR(1),
  @Department NVARCHAR(60), @Abha VARCHAR(20) = NULL, @Scheme NVARCHAR(40) = NULL,
  @FacilityCode VARCHAR(20) = 'DIST_HOSP_01'
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  DECLARE @DeptId TINYINT = (SELECT DeptId FROM dbo.Departments WHERE Name = @Department);
  IF @DeptId IS NULL THROW 50001, 'Unknown department', 1;

  DECLARE @St CHAR(2), @Di CHAR(3), @Sh CHAR(4);
  SELECT @St = StateCode, @Di = DistrictCode, @Sh = ShortCode
  FROM dbo.Facilities WHERE FacilityCode = @FacilityCode;
  IF @St IS NULL THROW 50006, 'Unknown facility', 1;

  DECLARE @Yr CHAR(2) = RIGHT(CAST(YEAR(SYSUTCDATETIME()) AS CHAR(4)), 2);
  DECLARE @Seq INT;

  BEGIN TRAN;  -- atomic per-facility-per-year sequence => collision-free UHIDs
    MERGE dbo.UhidSequences WITH (HOLDLOCK) AS tgt
    USING (SELECT @FacilityCode AS FacilityCode, @Yr AS Yr) AS src
      ON tgt.FacilityCode = src.FacilityCode AND tgt.Yr = src.Yr
    WHEN MATCHED THEN UPDATE SET LastSeq = tgt.LastSeq + 1
    WHEN NOT MATCHED THEN INSERT (FacilityCode, Yr, LastSeq) VALUES (src.FacilityCode, src.Yr, 1);
    SELECT @Seq = LastSeq FROM dbo.UhidSequences WHERE FacilityCode = @FacilityCode AND Yr = @Yr;

    DECLARE @Uhid VARCHAR(24) =
      @St + '-' + @Di + '-' + @Sh + '-' + @Yr + '-' + RIGHT('00000' + CAST(@Seq AS VARCHAR(8)), 5);

    INSERT INTO dbo.Patients (PatientCode, FullName, Mobile, Age, Sex, DeptId, Abha, Scheme, FacilityCode)
    VALUES (@Uhid, @FullName, @Mobile, @Age, @Sex, @DeptId, @Abha, @Scheme, @FacilityCode);
  COMMIT;

  SELECT p.PatientCode, p.FullName, p.Mobile, p.Age, p.Sex, d.Name AS Department,
         p.Abha, p.Scheme, p.AllergiesJson, p.ConditionsJson, p.MedsJson,
         NULL AS Complaint, NULL AS LastVisit,
         NULL AS Bp, NULL AS Pulse, NULL AS Temp, NULL AS Spo2, NULL AS Rr, NULL AS Weight
  FROM dbo.Patients p JOIN dbo.Departments d ON d.DeptId = p.DeptId
  WHERE p.PatientId = SCOPE_IDENTITY();
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Patient_Search @Query NVARCHAR(80)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 20 p.PatientCode, p.FullName, p.Mobile, p.Age, p.Sex, d.Name AS Department,
         p.Abha, p.Scheme, p.AllergiesJson, p.ConditionsJson, p.MedsJson,
         NULL AS Complaint, NULL AS LastVisit,
         NULL AS Bp, NULL AS Pulse, NULL AS Temp, NULL AS Spo2, NULL AS Rr, NULL AS Weight
  FROM dbo.Patients p JOIN dbo.Departments d ON d.DeptId = p.DeptId
  WHERE p.FullName LIKE '%' + @Query + '%'
     OR p.Mobile = @Query
     OR p.PatientCode = @Query
  ORDER BY p.CreatedAt DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Patient_GetByCode @PatientCode VARCHAR(12)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT p.PatientCode, p.FullName, p.Mobile, p.Age, p.Sex, d.Name AS Department,
         p.Abha, p.Scheme, p.AllergiesJson, p.ConditionsJson, p.MedsJson,
         NULL AS Complaint, NULL AS LastVisit,
         NULL AS Bp, NULL AS Pulse, NULL AS Temp, NULL AS Spo2, NULL AS Rr, NULL AS Weight
  FROM dbo.Patients p JOIN dbo.Departments d ON d.DeptId = p.DeptId
  WHERE p.PatientCode = @PatientCode;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_User_GetById @UserId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT u.UserId, u.Username, u.FullName, r.RoleName
  FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId = u.RoleId
  WHERE u.UserId = @UserId AND u.IsActive = 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Patient_GetByAbha @Abha VARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 p.PatientCode, p.FullName, p.Mobile, p.Age, p.Sex, d.Name AS Department,
         p.Abha, p.Scheme, p.AllergiesJson, p.ConditionsJson, p.MedsJson,
         NULL AS Complaint, NULL AS LastVisit,
         NULL AS Bp, NULL AS Pulse, NULL AS Temp, NULL AS Spo2, NULL AS Rr, NULL AS Weight
  FROM dbo.Patients p JOIN dbo.Departments d ON d.DeptId = p.DeptId
  WHERE REPLACE(REPLACE(p.Abha, '-', ''), ' ', '') = REPLACE(REPLACE(@Abha, '-', ''), ' ', '');
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Patient_GetByMobile @Mobile VARCHAR(15)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 1 p.PatientCode, p.FullName, p.Mobile, p.Age, p.Sex, d.Name AS Department,
         p.Abha, p.Scheme, p.AllergiesJson, p.ConditionsJson, p.MedsJson,
         NULL AS Complaint, NULL AS LastVisit,
         NULL AS Bp, NULL AS Pulse, NULL AS Temp, NULL AS Spo2, NULL AS Rr, NULL AS Weight
  FROM dbo.Patients p JOIN dbo.Departments d ON d.DeptId = p.DeptId
  WHERE p.Mobile = @Mobile
  ORDER BY p.CreatedAt DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Vitals_Save
  @TokenRef VARCHAR(16), @Bp VARCHAR(9), @Pulse INT, @Temp DECIMAL(5,1),
  @Spo2 INT, @Rr INT, @Weight DECIMAL(5,1), @ActorRef VARCHAR(16)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  DECLARE @TokenId INT = TRY_CAST(@TokenRef AS INT);
  DECLARE @PatientId INT = (SELECT PatientId FROM dbo.Tokens WHERE TokenId = @TokenId);
  IF @PatientId IS NULL THROW 50003, 'Token not found', 1;

  BEGIN TRAN;
    INSERT INTO dbo.Vitals (TokenId, PatientId, Bp, Pulse, Temp, Spo2, Rr, Weight, RecordedBy)
    VALUES (@TokenId, @PatientId, @Bp, @Pulse, @Temp, @Spo2, @Rr, @Weight, TRY_CAST(@ActorRef AS INT));

    UPDATE dbo.Tokens SET VitalsDone = 1 WHERE TokenId = @TokenId;

    INSERT INTO dbo.AuditLog (ActorId, Action, Entity, EntityRef, Detail)
    VALUES (TRY_CAST(@ActorRef AS INT), 'vitals.save', 'token', @TokenRef, @Bp);
  COMMIT;

  SELECT t.TokenId, dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
         p.PatientCode, d.Name AS Department, t.TokenDate, t.Status, t.Priority,
         t.VitalsDone, t.IssuedAt, t.CalledAt
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  WHERE t.TokenId = @TokenId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Token_Issue
  @PatientCode VARCHAR(12), @Department NVARCHAR(60), @Priority VARCHAR(10) = 'normal',
  @Category VARCHAR(10) = 'normal', @Source VARCHAR(8) = 'counter',
  @Complaint NVARCHAR(200) = NULL, @FeeAmount INT = NULL, @FeeExemption NVARCHAR(30) = NULL,
  @TokenDate DATE = NULL, @SlotTime CHAR(5) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  DECLARE @DeptId TINYINT = (SELECT DeptId FROM dbo.Departments WHERE Name = @Department);
  DECLARE @PatientId INT = (SELECT PatientId FROM dbo.Patients WHERE PatientCode = @PatientCode);
  IF @DeptId IS NULL THROW 50001, 'Unknown department', 1;
  IF @PatientId IS NULL THROW 50002, 'Unknown patient', 1;

  DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);
  DECLARE @Date DATE = ISNULL(@TokenDate, @Today);
  IF @Date < @Today THROW 50006, 'Cannot book a past date', 1;

  -- one active token per patient per date
  IF EXISTS (SELECT 1 FROM dbo.Tokens WHERE PatientId = @PatientId AND TokenDate = @Date
             AND Status NOT IN ('done','cancelled'))
    THROW 50007, 'Patient already holds an active token for this date', 1;

  -- slot capacity (6 per half-hour per department)
  IF @SlotTime IS NOT NULL AND
     (SELECT COUNT(*) FROM dbo.Tokens WHERE DeptId = @DeptId AND TokenDate = @Date
      AND SlotTime = @SlotTime AND Status <> 'cancelled') >= 6
    THROW 50008, 'Slot is full', 1;

  -- self-service and advance bookings wait for arrival check-in
  DECLARE @Status VARCHAR(12) =
    CASE WHEN @Source = 'self' OR @Date > @Today THEN 'booked' ELSE 'waiting' END;
  IF @Category = 'emergency' SET @Priority = 'urgent';

  BEGIN TRAN;
    DECLARE @Seq INT;
    SELECT @Seq = ISNULL(MAX(SeqNo), 0) + 1
    FROM dbo.Tokens WITH (UPDLOCK, HOLDLOCK)
    WHERE DeptId = @DeptId AND TokenDate = @Date;

    INSERT INTO dbo.Tokens (TokenDate, DeptId, SeqNo, PatientId, Status, Priority,
                            Category, Source, Complaint, FeeAmount, FeeExemption, SlotTime)
    VALUES (@Date, @DeptId, @Seq, @PatientId, @Status, @Priority,
            @Category, @Source, @Complaint, @FeeAmount, @FeeExemption, @SlotTime);

    DECLARE @NewId INT = SCOPE_IDENTITY();
  COMMIT;

  SELECT t.TokenId, dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
         p.PatientCode, d.Name AS Department, t.TokenDate, t.Status, t.Priority,
         t.Category, t.Source, t.Complaint, t.FeeAmount, t.FeeExemption, t.SlotTime,
         t.VitalsDone, t.IssuedAt, t.ArrivedAt, t.CalledAt
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  WHERE t.TokenId = @NewId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Symptom_List
AS
BEGIN
  SET NOCOUNT ON;
  SELECT s.Code, s.NameEn, s.NameHin, d.Name AS Department
  FROM dbo.Symptoms s JOIN dbo.Departments d ON d.DeptId = s.DeptId
  ORDER BY s.SymptomId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Slot_List @Department NVARCHAR(60), @OnDate DATE
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @DeptId TINYINT = (SELECT DeptId FROM dbo.Departments WHERE Name = @Department);
  SELECT s.SlotTime, 6 - COUNT(t.TokenId) AS Free
  FROM (VALUES ('09:00'),('09:30'),('10:00'),('10:30'),('11:00'),('11:30'),('12:00'),('12:30')) s(SlotTime)
  LEFT JOIN dbo.Tokens t ON t.SlotTime = s.SlotTime AND t.DeptId = @DeptId
       AND t.TokenDate = @OnDate AND t.Status <> 'cancelled'
  GROUP BY s.SlotTime ORDER BY s.SlotTime;
END;
GO

-- Expire self-service bookings unclaimed 60 min past their slot (or issue time).
CREATE OR ALTER PROCEDURE dbo.usp_Token_ExpireStale
AS
BEGIN
  SET NOCOUNT ON;

  DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);

  UPDATE dbo.Tokens
  SET Status = 'cancelled'
  WHERE Status = 'booked'
    AND TokenDate = @Today
    AND DATEADD
    (
      MINUTE,
      60,
      COALESCE
      (
        DATEADD
        (
          MINUTE,
          DATEDIFF
          (
            MINUTE,
            CAST('00:00' AS TIME),
            TRY_CONVERT(TIME, SlotTime)
          ),
          CAST(TokenDate AS DATETIME2)
        ),
        IssuedAt
      )
    ) < SYSUTCDATETIME();
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Token_CheckIn @Mobile VARCHAR(15), @TokenNo VARCHAR(8)
AS
BEGIN
  SET NOCOUNT ON;
  EXEC dbo.usp_Token_ExpireStale;
  DECLARE @TokenId INT = (
    SELECT TOP 1 t.TokenId FROM dbo.Tokens t
    JOIN dbo.Patients p ON p.PatientId = t.PatientId
    WHERE t.TokenDate = CAST(SYSUTCDATETIME() AS DATE) AND t.Status = 'booked'
      AND dbo.fn_DisplayToken(t.DeptId, t.SeqNo) = UPPER(@TokenNo) AND p.Mobile = @Mobile);
  IF @TokenId IS NULL THROW 50009, 'No booked token for today with that number', 1;

  UPDATE dbo.Tokens SET Status = 'waiting', ArrivedAt = SYSUTCDATETIME() WHERE TokenId = @TokenId;
  INSERT INTO dbo.AuditLog (ActorId, Action, Entity, EntityRef, Detail)
  VALUES (NULL, 'token.check-in', 'token', CAST(@TokenId AS VARCHAR(30)), @TokenNo);

  SELECT t.TokenId, dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
         p.PatientCode, d.Name AS Department, t.TokenDate, t.Status, t.Priority,
         t.Category, t.Complaint, t.SlotTime, t.VitalsDone, t.IssuedAt, t.ArrivedAt, t.CalledAt
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  WHERE t.TokenId = @TokenId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Queue_ByDepartment @Department NVARCHAR(60) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  EXEC dbo.usp_Token_ExpireStale;
  SELECT t.TokenId, dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
         t.TokenDate, t.Status, t.Priority, t.Category, t.Source, t.SlotTime,
         t.VitalsDone, t.IssuedAt, t.ArrivedAt, t.CalledAt,
         p.PatientCode, p.FullName, p.Mobile, p.Age, p.Sex, d.Name AS Department,
         p.Abha, p.Scheme, p.AllergiesJson, p.ConditionsJson, p.MedsJson,
         t.Complaint, NULL AS LastVisit,
         NULL AS Bp, NULL AS Pulse, NULL AS Temp, NULL AS Spo2, NULL AS Rr, NULL AS Weight
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  WHERE t.TokenDate = CAST(SYSUTCDATETIME() AS DATE)
    AND t.Status <> 'done' AND t.Status <> 'cancelled'
    AND (@Department IS NULL OR d.Name = @Department)
  ORDER BY CASE t.Priority WHEN 'urgent' THEN 0 ELSE 1 END, t.SeqNo;
END;
GO

-- Public board: masked names only, no identifiers, no clinical data.
CREATE OR ALTER PROCEDURE dbo.usp_Queue_PublicBoard @Department NVARCHAR(60) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
         t.Status, t.Priority, dbo.fn_MaskName(p.FullName) AS MaskedName
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  WHERE t.TokenDate = CAST(SYSUTCDATETIME() AS DATE)
    AND t.Status IN ('checked-in','waiting','in-consult')
    AND (@Department IS NULL OR d.Name = @Department)
  ORDER BY CASE t.Priority WHEN 'urgent' THEN 0 ELSE 1 END, t.SeqNo;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Token_UpdateStatus
  @TokenRef VARCHAR(16), @NewStatus VARCHAR(12), @ActorRef VARCHAR(16)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  DECLARE @TokenId INT = TRY_CAST(@TokenRef AS INT);
  DECLARE @Old VARCHAR(12) = (SELECT Status FROM dbo.Tokens WHERE TokenId = @TokenId);
  IF @Old IS NULL THROW 50003, 'Token not found', 1;

  -- allowed transitions only
  IF NOT ( (@Old = 'checked-in' AND @NewStatus = 'waiting')
        OR (@Old = 'waiting'    AND @NewStatus IN ('in-consult','checked-in'))
        OR (@Old = 'in-consult' AND @NewStatus IN ('done','waiting')) )
    THROW 50004, 'Invalid status transition', 1;

  BEGIN TRAN;
    -- triage gate: vitals must be recorded before the doctor sees the patient
    IF @NewStatus = 'in-consult' AND (SELECT VitalsDone FROM dbo.Tokens WHERE TokenId = @TokenId) = 0
      THROW 50005, 'Vitals pending — patient must pass triage first', 1;

    IF @NewStatus = 'in-consult'  -- one consult at a time per department
      UPDATE dbo.Tokens SET Status = 'waiting'
      WHERE Status = 'in-consult' AND TokenId <> @TokenId
        AND DeptId = (SELECT DeptId FROM dbo.Tokens WHERE TokenId = @TokenId)
        AND TokenDate = CAST(SYSUTCDATETIME() AS DATE);

    UPDATE dbo.Tokens
    SET Status = @NewStatus,
        CalledAt = CASE WHEN @NewStatus = 'in-consult' THEN SYSUTCDATETIME() ELSE CalledAt END
    WHERE TokenId = @TokenId;

    INSERT INTO dbo.AuditLog (ActorId, Action, Entity, EntityRef, Detail)
    VALUES (TRY_CAST(@ActorRef AS INT), 'token.status', 'token', @TokenRef, @NewStatus);
  COMMIT;

  SELECT t.TokenId, dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
         p.PatientCode, d.Name AS Department, t.TokenDate, t.Status, t.Priority,
         t.VitalsDone, t.IssuedAt, t.CalledAt
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  WHERE t.TokenId = @TokenId;
END;
GO

-- Recovery lookup: all live tokens for a mobile, today or upcoming.
-- Only reachable through the API after OTP verification of that mobile.
CREATE OR ALTER PROCEDURE dbo.usp_Token_ListByMobile @Mobile VARCHAR(15)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
         d.Name AS Department, t.TokenDate, t.SlotTime AS Slot, t.Status
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  WHERE p.Mobile = @Mobile
    AND t.TokenDate >= CAST(SYSUTCDATETIME() AS DATE)
    AND t.Status <> 'cancelled'
  ORDER BY t.TokenDate, t.SeqNo;
END;
GO

-- Patient self-service: mobile + token number must BOTH match.
CREATE OR ALTER PROCEDURE dbo.usp_Token_Track @Mobile VARCHAR(15), @TokenNo VARCHAR(8)
AS
BEGIN
  SET NOCOUNT ON;
  EXEC dbo.usp_Token_ExpireStale;
  -- today's token first, else the nearest future booking with that number
  SELECT TOP 1
    dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
    d.Name AS Department, t.TokenDate, t.SlotTime, t.Status, t.Category, t.VitalsDone,
    LEFT(p.FullName, CHARINDEX(' ', p.FullName + ' ') - 1) AS FirstName,
    CASE WHEN t.Status = 'waiting' THEN dbo.fn_QueuePosition(t.TokenId) ELSE 0 END AS QueuePosition,
    CASE WHEN t.Status = 'booked' AND t.TokenDate = CAST(SYSUTCDATETIME() AS DATE) THEN 1 ELSE 0 END AS CanCheckIn,
    (SELECT TOP 1 dbo.fn_DisplayToken(x.DeptId, x.SeqNo) FROM dbo.Tokens x
      WHERE x.TokenDate = t.TokenDate AND x.DeptId = t.DeptId AND x.Status = 'in-consult') AS NowServing,
    pr.Status AS PrescriptionStatus
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  LEFT JOIN dbo.Prescriptions pr ON pr.TokenId = t.TokenId
  WHERE t.TokenDate >= CAST(SYSUTCDATETIME() AS DATE)
    AND p.Mobile = @Mobile
    AND dbo.fn_DisplayToken(t.DeptId, t.SeqNo) = UPPER(@TokenNo)
  ORDER BY t.TokenDate;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Consult_Save
  @TokenRef VARCHAR(16), @DoctorRef VARCHAR(16), @Diagnosis NVARCHAR(200),
  @RxJson NVARCHAR(MAX), @LabsJson NVARCHAR(MAX),
  @Disposition VARCHAR(12), @Notes NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  DECLARE @TokenId INT = TRY_CAST(@TokenRef AS INT);
  DECLARE @PatientId INT = (SELECT PatientId FROM dbo.Tokens WHERE TokenId = @TokenId);
  IF @PatientId IS NULL THROW 50003, 'Token not found', 1;

  BEGIN TRAN;
    INSERT INTO dbo.Consults (TokenId, PatientId, DoctorId, Diagnosis, RxJson, LabsJson, Disposition, Notes)
    VALUES (@TokenId, @PatientId, TRY_CAST(@DoctorRef AS INT), @Diagnosis, @RxJson, @LabsJson, @Disposition, @Notes);

    DECLARE @ConsultId INT = SCOPE_IDENTITY();

    UPDATE dbo.Tokens SET Status = 'done' WHERE TokenId = @TokenId;

    -- Create Prescription if RxJson has items
    IF @RxJson IS NOT NULL AND @RxJson <> '[]' AND @RxJson <> ''
    BEGIN
      INSERT INTO dbo.Prescriptions (ConsultId, TokenId, PatientId, DoctorId, FacilityCode, Status, ItemsJson)
      VALUES (@ConsultId, @TokenId, @PatientId, TRY_CAST(@DoctorRef AS INT), 'DIST_HOSP_01', 'pending', @RxJson);
    END

    INSERT INTO dbo.AuditLog (ActorId, Action, Entity, EntityRef, Detail)
    VALUES (TRY_CAST(@DoctorRef AS INT), 'consult.save', 'consult', CAST(@ConsultId AS VARCHAR(30)), @Disposition);
  COMMIT;

  SELECT c.ConsultId, c.Disposition, c.CompletedAt, d.Name AS Department
  FROM dbo.Consults c
  JOIN dbo.Tokens t ON t.TokenId = c.TokenId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  WHERE c.ConsultId = @ConsultId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Department_List
AS
BEGIN
  SET NOCOUNT ON;
  SELECT Code, Name, Series FROM dbo.Departments ORDER BY DeptId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Audit_Insert
  @ActorRef VARCHAR(16), @Action VARCHAR(40), @Entity VARCHAR(30),
  @EntityRef VARCHAR(30), @Detail NVARCHAR(400) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  INSERT INTO dbo.AuditLog (ActorId, Action, Entity, EntityRef, Detail)
  VALUES (TRY_CAST(@ActorRef AS INT), @Action, @Entity, @EntityRef, @Detail);
END;
GO


-- NEW STORED PROCEDURES FOR MEDICINES, TEMPLATES, PRESCRIPTIONS, AND ADMIN VIEWS

CREATE OR ALTER PROCEDURE dbo.usp_Medicines_List
  @FacilityCode VARCHAR(20),
  @DoctorId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT m.MedicineId AS id, m.Name AS name, m.GenericName AS genericName, m.Category AS category,
         m.DoseForms AS doseForms, m.Strengths AS strengths, m.DefaultRoute AS defaultRoute,
         m.DefaultFreq AS defaultFrequency, m.DefaultDur AS defaultDuration, m.IsControlled AS isControlled,
         CAST(CASE WHEN dm.MedicineId IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS isQuickPick
  FROM dbo.FacilityMedicines fm
  JOIN dbo.Medicines m ON m.MedicineId = fm.MedicineId
  LEFT JOIN dbo.DoctorMedicines dm ON dm.MedicineId = m.MedicineId AND dm.DoctorId = @DoctorId AND dm.IsQuickPick = 1
  WHERE fm.FacilityCode = @FacilityCode;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Medicines_Search
  @Query NVARCHAR(80),
  @FacilityCode VARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TOP 20 m.MedicineId AS id, m.Name AS name, m.GenericName AS genericName, m.Category AS category,
         m.DoseForms AS doseForms, m.Strengths AS strengths, m.DefaultRoute AS defaultRoute,
         m.DefaultFreq AS defaultFrequency, m.DefaultDur AS defaultDuration, m.IsControlled AS isControlled
  FROM dbo.FacilityMedicines fm
  JOIN dbo.Medicines m ON m.MedicineId = fm.MedicineId
  WHERE fm.FacilityCode = @FacilityCode
    AND (m.Name LIKE '%' + @Query + '%' OR m.GenericName LIKE '%' + @Query + '%');
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_DoctorMedicines_Get
  @DoctorId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT m.MedicineId AS id, m.Name AS name, m.GenericName AS genericName, m.Category AS category,
         m.DoseForms AS doseForms, m.Strengths AS strengths, m.DefaultRoute AS defaultRoute,
         m.DefaultFreq AS defaultFrequency, m.DefaultDur AS defaultDuration, m.IsControlled AS isControlled
  FROM dbo.DoctorMedicines dm
  JOIN dbo.Medicines m ON m.MedicineId = dm.MedicineId
  WHERE dm.DoctorId = @DoctorId AND dm.IsQuickPick = 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_DoctorMedicines_Set
  @DoctorId INT,
  @MedicineIdsJson NVARCHAR(MAX)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  BEGIN TRAN;
    DELETE FROM dbo.DoctorMedicines WHERE DoctorId = @DoctorId;
    
    INSERT INTO dbo.DoctorMedicines (DoctorId, MedicineId, IsQuickPick)
    SELECT @DoctorId, value, 1
    FROM OPENJSON(@MedicineIdsJson);
  COMMIT;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_ConsultTemplates_List
  @DoctorId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TemplateId AS id, DoctorId AS doctorId, Name AS name, Category AS category,
         IsSystemDefault AS isSystemDefault, Complaints AS complaints, Examination AS examination,
         Diagnosis AS diagnosis, PrescriptionJson AS prescription, Advice AS advice, FollowUp AS followUp
  FROM dbo.ConsultTemplates
  WHERE DoctorId = @DoctorId OR IsSystemDefault = 1;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_ConsultTemplates_Get
  @TemplateId INT
AS
BEGIN
  SET NOCOUNT ON;
  SELECT TemplateId AS id, DoctorId AS doctorId, Name AS name, Category AS category,
         IsSystemDefault AS isSystemDefault, Complaints AS complaints, Examination AS examination,
         Diagnosis AS diagnosis, PrescriptionJson AS prescription, Advice AS advice, FollowUp AS followUp
  FROM dbo.ConsultTemplates
  WHERE TemplateId = @TemplateId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_ConsultTemplates_Save
  @DoctorId INT,
  @TemplateId INT = NULL,
  @Name NVARCHAR(100),
  @Category VARCHAR(40),
  @Complaints NVARCHAR(MAX) = NULL,
  @Examination NVARCHAR(MAX) = NULL,
  @Diagnosis NVARCHAR(200) = NULL,
  @PrescriptionJson NVARCHAR(MAX) = '[]',
  @Advice NVARCHAR(MAX) = NULL,
  @FollowUp NVARCHAR(MAX) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF @TemplateId IS NOT NULL
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.ConsultTemplates WHERE TemplateId = @TemplateId AND (DoctorId = @DoctorId OR IsSystemDefault = 1))
      THROW 50005, 'Unauthorized or template not found', 1;
      
    UPDATE dbo.ConsultTemplates
    SET Name = @Name,
        Category = @Category,
        Complaints = @Complaints,
        Examination = @Examination,
        Diagnosis = @Diagnosis,
        PrescriptionJson = @PrescriptionJson,
        Advice = @Advice,
        FollowUp = @FollowUp,
        IsSystemDefault = 0 -- edited is specific to doctor
    WHERE TemplateId = @TemplateId;
    
    SELECT @TemplateId AS id;
  END
  ELSE
  BEGIN
    INSERT INTO dbo.ConsultTemplates (DoctorId, Name, Category, IsSystemDefault, Complaints, Examination, Diagnosis, PrescriptionJson, Advice, FollowUp)
    VALUES (@DoctorId, @Name, @Category, 0, @Complaints, @Examination, @Diagnosis, @PrescriptionJson, @Advice, @FollowUp);
    
    SELECT SCOPE_IDENTITY() AS id;
  END
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_ConsultTemplates_Delete
  @TemplateId INT,
  @DoctorId INT
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (SELECT 1 FROM dbo.ConsultTemplates WHERE TemplateId = @TemplateId AND IsSystemDefault = 1)
    THROW 50006, 'Cannot delete system default templates', 1;
    
  DELETE FROM dbo.ConsultTemplates
  WHERE TemplateId = @TemplateId AND DoctorId = @DoctorId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Facilities_List
AS
BEGIN
  SET NOCOUNT ON;
  SELECT FacilityCode AS code, Name AS name, Type AS type, Address AS address
  FROM dbo.Facilities;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Prescriptions_List
  @Status VARCHAR(20) = NULL,
  @FacilityCode VARCHAR(20) = NULL
AS
BEGIN
  SET NOCOUNT ON;
  SELECT pr.PrescriptionId AS id, pr.ConsultId AS consultId, pr.TokenId AS tokenId,
         pr.PatientId AS patientId, pr.DoctorId AS doctorId, pr.FacilityCode AS facilityCode,
         pr.Status AS status, pr.ItemsJson AS items, pr.DispensedBy AS dispensedBy,
         pr.DispensedAt AS dispensedAt, u.FullName AS doctorName,
         p.PatientCode, p.FullName AS patientName, p.Age, p.Sex, p.Mobile
  FROM dbo.Prescriptions pr
  JOIN dbo.Patients p ON p.PatientId = pr.PatientId
  JOIN dbo.Users u ON u.UserId = pr.DoctorId
  WHERE (@Status IS NULL OR pr.Status = @Status)
    AND (@FacilityCode IS NULL OR pr.FacilityCode = @FacilityCode);
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Prescriptions_UpdateStatus
  @PrescriptionId INT,
  @Status VARCHAR(20),
  @PharmacistId INT
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  
  BEGIN TRAN;
    UPDATE dbo.Prescriptions
    SET Status = @Status,
        DispensedBy = CASE WHEN @Status = 'dispensed' THEN @PharmacistId ELSE DispensedBy END,
        DispensedAt = CASE WHEN @Status = 'dispensed' THEN SYSUTCDATETIME() ELSE DispensedAt END
    WHERE PrescriptionId = @PrescriptionId;
    
    INSERT INTO dbo.AuditLog (ActorId, Action, Entity, EntityRef, Detail)
    VALUES (@PharmacistId, 'prescription.status', 'prescription', CAST(@PrescriptionId AS VARCHAR(20)), @Status);
  COMMIT;
  
  SELECT PrescriptionId AS id, Status AS status FROM dbo.Prescriptions WHERE PrescriptionId = @PrescriptionId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Admin_FlowStats
  @FacilityCode VARCHAR(20)
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @Today DATE = CAST(SYSUTCDATETIME() AS DATE);
  
  SELECT 
    COUNT(*) AS totalTokens,
    SUM(CASE WHEN Status = 'waiting' THEN 1 ELSE 0 END) AS waiting,
    SUM(CASE WHEN Status = 'calling' THEN 1 ELSE 0 END) AS calling,
    SUM(CASE WHEN Status = 'in-consult' THEN 1 ELSE 0 END) AS inConsult,
    SUM(CASE WHEN Status = 'done' THEN 1 ELSE 0 END) AS done,
    (SELECT COUNT(*) FROM dbo.Prescriptions WHERE Status IN ('pending', 'dispensing') AND FacilityCode = @FacilityCode) AS atPharmacy,
    (SELECT COUNT(*) FROM dbo.Prescriptions WHERE Status = 'dispensed' AND FacilityCode = @FacilityCode) AS dispensed,
    12 AS avgWaitTimeMin,
    8 AS avgConsultTimeMin
  FROM dbo.Tokens
  WHERE TokenDate = @Today;
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Admin_QueueTimeline
  @FacilityCode VARCHAR(20),
  @Date DATE = NULL
AS
BEGIN
  SET NOCOUNT ON;
  IF @Date IS NULL SET @Date = CAST(SYSUTCDATETIME() AS DATE);
  
  SELECT t.TokenId AS tokenId, dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS tokenNo,
         dbo.fn_MaskName(p.FullName) AS patientName, d.Name AS dept, t.Status AS status,
         t.Priority AS priority, t.IssuedAt AS issuedAt, t.CalledAt AS calledAt,
         t.VitalsDone AS vitalsDone, pr.Status AS prescriptionStatus
  FROM dbo.Tokens t
  JOIN dbo.Patients p ON p.PatientId = t.PatientId
  JOIN dbo.Departments d ON d.DeptId = t.DeptId
  LEFT JOIN dbo.Prescriptions pr ON pr.TokenId = t.TokenId
  WHERE t.TokenDate = @Date
  ORDER BY t.IssuedAt DESC;
END;
GO

