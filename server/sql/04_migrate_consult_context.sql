/* Migration for EXISTING HMIS databases (safe to run repeatedly).
   Brings a live DB created from an older 01_schema.sql up to date so that
   usp_Consult_Save works with the full consult payload:
   allergies (medicine + food), blood group, family history, past illness,
   social history — this is the fix for "Complete consultation" failing.

   Run as a schema-owner account (NOT hmis_app):
     sqlcmd -S <server> -d HMIS -i 04_migrate_consult_context.sql
*/
USE HMIS;
GO

-- ---------- Patients: clinical-context columns ----------
IF COL_LENGTH('dbo.Patients', 'BloodGroup') IS NULL
  ALTER TABLE dbo.Patients ADD BloodGroup VARCHAR(7) NULL;
IF COL_LENGTH('dbo.Patients', 'FoodAllergiesJson') IS NULL
  ALTER TABLE dbo.Patients ADD FoodAllergiesJson NVARCHAR(MAX) NOT NULL DEFAULT '[]';
IF COL_LENGTH('dbo.Patients', 'FamilyJson') IS NULL
  ALTER TABLE dbo.Patients ADD FamilyJson NVARCHAR(MAX) NOT NULL DEFAULT '[]';
IF COL_LENGTH('dbo.Patients', 'SocialJson') IS NULL
  ALTER TABLE dbo.Patients ADD SocialJson NVARCHAR(MAX) NOT NULL DEFAULT '[]';
IF COL_LENGTH('dbo.Patients', 'FacilityCode') IS NULL
  ALTER TABLE dbo.Patients ADD FacilityCode VARCHAR(20) NULL;
GO

-- Widen UHID storage if the DB predates facility-scoped codes
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.Patients')
             AND name = 'PatientCode' AND max_length < 24 AND max_length > 0)
  ALTER TABLE dbo.Patients ALTER COLUMN PatientCode VARCHAR(24) NOT NULL;
GO

-- ---------- Consults: multi-diagnosis needs 400 chars ----------
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.Consults')
             AND name = 'Diagnosis' AND max_length BETWEEN 1 AND 400) -- nvarchar(200) = 400 bytes
  ALTER TABLE dbo.Consults ALTER COLUMN Diagnosis NVARCHAR(400) NULL;
GO

-- ---------- Emergency admissions: unidentified patients have no mobile/age ----------
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.Patients') AND name = 'Mobile' AND is_nullable = 0)
  ALTER TABLE dbo.Patients ALTER COLUMN Mobile VARCHAR(15) NULL;
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.Patients') AND name = 'Age' AND is_nullable = 0)
  ALTER TABLE dbo.Patients ALTER COLUMN Age INT NULL;
GO

-- ---------- Vitals: height (BMI) if missing ----------
IF COL_LENGTH('dbo.Vitals', 'Height') IS NULL
  ALTER TABLE dbo.Vitals ADD Height DECIMAL(5,1) NULL;
GO

-- ---------- Tokens: booking-flow columns (fixes 500 on Start Consult) ----------
-- Older DBs lack these; every queue/status procedure references them.
IF COL_LENGTH('dbo.Tokens', 'Category') IS NULL
  ALTER TABLE dbo.Tokens ADD Category VARCHAR(10) NOT NULL DEFAULT 'normal';
IF COL_LENGTH('dbo.Tokens', 'Source') IS NULL
  ALTER TABLE dbo.Tokens ADD Source VARCHAR(8) NOT NULL DEFAULT 'counter';
IF COL_LENGTH('dbo.Tokens', 'Complaint') IS NULL
  ALTER TABLE dbo.Tokens ADD Complaint NVARCHAR(200) NULL;
IF COL_LENGTH('dbo.Tokens', 'FeeAmount') IS NULL
  ALTER TABLE dbo.Tokens ADD FeeAmount INT NULL;
IF COL_LENGTH('dbo.Tokens', 'FeeExemption') IS NULL
  ALTER TABLE dbo.Tokens ADD FeeExemption NVARCHAR(30) NULL;
IF COL_LENGTH('dbo.Tokens', 'SlotTime') IS NULL
  ALTER TABLE dbo.Tokens ADD SlotTime CHAR(5) NULL;
IF COL_LENGTH('dbo.Tokens', 'ArrivedAt') IS NULL
  ALTER TABLE dbo.Tokens ADD ArrivedAt DATETIME2 NULL;
GO
-- Older CHECK constraint may not allow 'booked'/'cancelled' — rebuild it
DECLARE @ck sysname = (SELECT name FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.Tokens') AND definition LIKE '%Status%');
IF @ck IS NOT NULL EXEC('ALTER TABLE dbo.Tokens DROP CONSTRAINT ' + @ck);
ALTER TABLE dbo.Tokens ADD CONSTRAINT CK_Tokens_Status
  CHECK (Status IN ('booked','checked-in','waiting','in-consult','done','cancelled'));
GO

-- ---------- Facilities: UHID code columns + missing sequence table ----------
IF COL_LENGTH('dbo.Facilities', 'StateCode') IS NULL
  ALTER TABLE dbo.Facilities ADD StateCode CHAR(2) NOT NULL DEFAULT 'MP';
IF COL_LENGTH('dbo.Facilities', 'DistrictCode') IS NULL
  ALTER TABLE dbo.Facilities ADD DistrictCode CHAR(3) NOT NULL DEFAULT 'BPL';
IF COL_LENGTH('dbo.Facilities', 'ShortCode') IS NULL
  ALTER TABLE dbo.Facilities ADD ShortCode CHAR(4) NOT NULL DEFAULT 'DH01';
GO
UPDATE dbo.Facilities SET ShortCode='PH02' WHERE FacilityCode='PHC_AHD_02' AND ShortCode='DH01';
UPDATE dbo.Facilities SET ShortCode='CH03' WHERE FacilityCode='CHC_COL_03' AND ShortCode='DH01';
GO
IF OBJECT_ID('dbo.UhidSequences', 'U') IS NULL
CREATE TABLE dbo.UhidSequences (
  FacilityCode VARCHAR(20) NOT NULL REFERENCES dbo.Facilities(FacilityCode),
  Yr           CHAR(2)     NOT NULL,
  LastSeq      INT         NOT NULL DEFAULT 0,
  CONSTRAINT PK_UhidSeq PRIMARY KEY (FacilityCode, Yr)
);
GO

-- ---------- Symptoms catalog (self-service booking) ----------
IF OBJECT_ID('dbo.Symptoms', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Symptoms (
    SymptomId  TINYINT      IDENTITY PRIMARY KEY,
    Code       VARCHAR(20)  NOT NULL UNIQUE,
    NameEn     NVARCHAR(60) NOT NULL,
    NameHin    NVARCHAR(60) NOT NULL,
    DeptId     TINYINT      NOT NULL REFERENCES dbo.Departments(DeptId)
  );
  INSERT INTO dbo.Symptoms (Code, NameEn, NameHin, DeptId) VALUES
   ('fever',     N'Fever / cough',       N'बुखार / खांसी',      1),
   ('chest',     N'Chest pain',          N'छाती में दर्द',       1),
   ('stomach',   N'Stomach pain',        N'पेट दर्द',           1),
   ('bone',      N'Bone / joint pain',   N'हड्डी / जोड़ दर्द',   4),
   ('child',     N'Child''s illness',    N'बच्चे की समस्या',     2),
   ('pregnancy', N'Pregnancy care',      N'गर्भावस्था',          3),
   ('ent',       N'Ear / nose / throat', N'कान / नाक / गला',    5),
   ('skin',      N'Skin problem',        N'त्वचा समस्या',        1);
END
GO

-- ---------- Medicines / templates / prescriptions (if the DB predates them) ----------
IF OBJECT_ID('dbo.Medicines', 'U') IS NULL
CREATE TABLE dbo.Medicines (
  MedicineId   VARCHAR(20)   PRIMARY KEY,
  Name         NVARCHAR(100) NOT NULL,
  GenericName  NVARCHAR(100) NOT NULL,
  Category     VARCHAR(40)   NOT NULL,
  DoseForms    NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  Strengths    NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  DefaultRoute VARCHAR(20)   NOT NULL,
  DefaultFreq  VARCHAR(20)   NOT NULL,
  DefaultDur   VARCHAR(20)   NOT NULL,
  IsControlled BIT           NOT NULL DEFAULT 0
);
IF OBJECT_ID('dbo.FacilityMedicines', 'U') IS NULL
CREATE TABLE dbo.FacilityMedicines (
  FacilityCode VARCHAR(20)  REFERENCES dbo.Facilities(FacilityCode),
  MedicineId   VARCHAR(20)  REFERENCES dbo.Medicines(MedicineId),
  PRIMARY KEY (FacilityCode, MedicineId)
);
IF OBJECT_ID('dbo.DoctorMedicines', 'U') IS NULL
CREATE TABLE dbo.DoctorMedicines (
  DoctorId     INT          REFERENCES dbo.Users(UserId),
  MedicineId   VARCHAR(20)  REFERENCES dbo.Medicines(MedicineId),
  IsQuickPick  BIT          NOT NULL DEFAULT 1,
  CustomDose   NVARCHAR(50) NULL,
  CustomFreq   VARCHAR(20)  NULL,
  PRIMARY KEY (DoctorId, MedicineId)
);
IF OBJECT_ID('dbo.ConsultTemplates', 'U') IS NULL
CREATE TABLE dbo.ConsultTemplates (
  TemplateId      INT           IDENTITY PRIMARY KEY,
  DoctorId        INT           NULL REFERENCES dbo.Users(UserId),
  Name            NVARCHAR(100) NOT NULL,
  Category        VARCHAR(40)   NOT NULL,
  IsSystemDefault BIT           NOT NULL DEFAULT 0,
  Complaints      NVARCHAR(MAX) NULL,
  Examination     NVARCHAR(MAX) NULL,
  Diagnosis       NVARCHAR(200) NULL,
  PrescriptionJson NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  Advice          NVARCHAR(MAX) NULL,
  FollowUp        NVARCHAR(MAX) NULL
);
IF OBJECT_ID('dbo.Prescriptions', 'U') IS NULL
CREATE TABLE dbo.Prescriptions (
  PrescriptionId INT          IDENTITY PRIMARY KEY,
  ConsultId      INT          NULL REFERENCES dbo.Consults(ConsultId),
  TokenId        INT          NOT NULL REFERENCES dbo.Tokens(TokenId),
  PatientId      INT          NOT NULL REFERENCES dbo.Patients(PatientId),
  DoctorId       INT          NOT NULL REFERENCES dbo.Users(UserId),
  FacilityCode   VARCHAR(20)  NOT NULL REFERENCES dbo.Facilities(FacilityCode),
  Status         VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending','dispensing','dispensed','cancelled')),
  ItemsJson      NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  DispensedBy    INT          NULL REFERENCES dbo.Users(UserId),
  DispensedAt    DATETIME2    NULL
);
GO

-- ---------- helper + final proc (same text as 02_procs.sql) ----------
CREATE OR ALTER FUNCTION dbo.fn_MergeJsonArray (@A NVARCHAR(MAX), @B NVARCHAR(MAX))
RETURNS NVARCHAR(MAX)
AS
BEGIN
  IF @B IS NULL OR @B = '' OR @B = '[]' RETURN ISNULL(@A, '[]');
  RETURN ISNULL((
    SELECT '[' + STRING_AGG('"' + STRING_ESCAPE(v, 'json') + '"', ',') + ']'
    FROM (SELECT DISTINCT value AS v
          FROM (SELECT value FROM OPENJSON(ISNULL(@A, '[]'))
                UNION SELECT value FROM OPENJSON(@B)) u) d
  ), '[]');
END;
GO

CREATE OR ALTER PROCEDURE dbo.usp_Consult_Save
  @TokenRef VARCHAR(16), @DoctorRef VARCHAR(16), @Diagnosis NVARCHAR(400),
  @RxJson NVARCHAR(MAX), @LabsJson NVARCHAR(MAX),
  @Disposition VARCHAR(12), @Notes NVARCHAR(MAX),
  @AllergiesJson NVARCHAR(MAX) = NULL, @FoodAllergiesJson NVARCHAR(MAX) = NULL,
  @BloodGroup VARCHAR(7) = NULL, @FamilyJson NVARCHAR(MAX) = NULL,
  @PastIllnessJson NVARCHAR(MAX) = NULL, @SocialJson NVARCHAR(MAX) = NULL
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

    UPDATE dbo.Patients SET
      AllergiesJson     = dbo.fn_MergeJsonArray(AllergiesJson, @AllergiesJson),
      FoodAllergiesJson = dbo.fn_MergeJsonArray(FoodAllergiesJson, @FoodAllergiesJson),
      ConditionsJson    = dbo.fn_MergeJsonArray(ConditionsJson, @PastIllnessJson),
      BloodGroup        = COALESCE(@BloodGroup, BloodGroup),
      FamilyJson        = COALESCE(@FamilyJson, FamilyJson),
      SocialJson        = COALESCE(@SocialJson, SocialJson)
    WHERE PatientId = @PatientId;

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

-- ---------- updated status proc: emergency bypasses the triage gate ----------
CREATE OR ALTER PROCEDURE dbo.usp_Token_UpdateStatus
  @TokenRef VARCHAR(16), @NewStatus VARCHAR(12), @ActorRef VARCHAR(16)
AS
BEGIN
  SET NOCOUNT ON;
  SET XACT_ABORT ON;
  DECLARE @TokenId INT = TRY_CAST(@TokenRef AS INT);
  DECLARE @Old VARCHAR(12) = (SELECT Status FROM dbo.Tokens WHERE TokenId = @TokenId);
  IF @Old IS NULL THROW 50003, 'Token not found', 1;

  -- idempotent: re-calling the current state (e.g. Resume on in-consult) is a no-op
  IF @Old = @NewStatus
  BEGIN
    SELECT t.TokenId, dbo.fn_DisplayToken(t.DeptId, t.SeqNo) AS TokenNo,
           p.PatientCode, d.Name AS Department, t.TokenDate, t.Status, t.Priority,
           t.VitalsDone, t.IssuedAt, t.CalledAt
    FROM dbo.Tokens t
    JOIN dbo.Patients p ON p.PatientId = t.PatientId
    JOIN dbo.Departments d ON d.DeptId = t.DeptId
    WHERE t.TokenId = @TokenId;
    RETURN;
  END

  -- allowed transitions only ('checked-in' may go straight to consult once triaged)
  IF NOT ( (@Old = 'checked-in' AND @NewStatus IN ('waiting','in-consult'))
        OR (@Old = 'waiting'    AND @NewStatus IN ('in-consult','checked-in'))
        OR (@Old = 'in-consult' AND @NewStatus IN ('done','waiting')) )
    THROW 50004, 'Invalid status transition', 1;

  BEGIN TRAN;
    -- triage gate: vitals must be recorded before the doctor sees the patient
    -- (emergency category bypasses — treatment first, paperwork later)
    IF @NewStatus = 'in-consult' AND EXISTS (
      SELECT 1 FROM dbo.Tokens WHERE TokenId = @TokenId AND VitalsDone = 0 AND Category <> 'emergency')
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

PRINT 'Schema migration complete.';
PRINT '>>> NOW RE-RUN 02_procs.sql — it recreates every procedure (CREATE OR ALTER)';
PRINT '>>> so all 36 procs match this schema: sqlcmd -S <server> -d HMIS -i 02_procs.sql';
GO

-- ---------- Emergency triage severity + EHR history ----------
IF COL_LENGTH('dbo.Tokens', 'TriageLevel') IS NULL
  ALTER TABLE dbo.Tokens ADD TriageLevel VARCHAR(6) NULL
    CHECK (TriageLevel IN ('red','yellow','green'));
GO
-- After running this migration, re-run 02_procs.sql to refresh
-- usp_Token_Issue, the queue procs and the new usp_Patient_History.
