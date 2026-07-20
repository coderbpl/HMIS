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

-- ---------- Vitals: height (BMI) if missing ----------
IF COL_LENGTH('dbo.Vitals', 'Height') IS NULL
  ALTER TABLE dbo.Vitals ADD Height DECIMAL(5,1) NULL;
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

PRINT 'Migration complete: consult-context columns + usp_Consult_Save updated.';
GO
