/* HMIS schema — run once against a fresh HMIS database.
   The application never touches these tables directly: all access goes
   through the stored procedures in 02_procs.sql (EXECUTE-only account). */

IF DB_ID('HMIS') IS NULL CREATE DATABASE HMIS;
GO
USE HMIS;
GO

CREATE TABLE dbo.Roles (
  RoleId     TINYINT       IDENTITY PRIMARY KEY,
  RoleName   VARCHAR(20)   NOT NULL UNIQUE   -- doctor / nurse / reception / pharmacy / admin
);

CREATE TABLE dbo.Users (
  UserId     INT           IDENTITY PRIMARY KEY,
  Username   NVARCHAR(64)  NOT NULL UNIQUE,
  FullName   NVARCHAR(120) NOT NULL,
  PassHash   VARCHAR(72)   NOT NULL,          -- bcrypt
  RoleId     TINYINT       NOT NULL REFERENCES dbo.Roles(RoleId),
  IsActive   BIT           NOT NULL DEFAULT 1,
  CreatedAt  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.Departments (
  DeptId     TINYINT       IDENTITY PRIMARY KEY,
  Code       CHAR(2)       NOT NULL UNIQUE,
  Name       NVARCHAR(60)  NOT NULL UNIQUE,
  Series     CHAR(1)       NOT NULL UNIQUE    -- token prefix: A, B, C…
);

CREATE TABLE dbo.Patients (
  PatientId   INT           IDENTITY PRIMARY KEY,
  -- Facility-scoped UHID (MP-BPL-DH01-26-00001), assigned by usp_Patient_Create.
  PatientCode VARCHAR(24)   NOT NULL UNIQUE,
  FullName    NVARCHAR(120) NOT NULL,
  Mobile      VARCHAR(15)   NOT NULL,
  Age         INT           NOT NULL CHECK (Age BETWEEN 0 AND 130),
  Sex         CHAR(1)       NOT NULL CHECK (Sex IN ('M','F','O')),
  DeptId      TINYINT       NOT NULL REFERENCES dbo.Departments(DeptId),
  Abha        VARCHAR(20)   NULL,
  Scheme      NVARCHAR(40)  NULL,
  FacilityCode VARCHAR(20)  NULL,   -- FK added after dbo.Facilities exists (see end of script)
  BloodGroup  VARCHAR(7)    NULL,
  AllergiesJson  NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  FoodAllergiesJson NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  FamilyJson     NVARCHAR(MAX) NOT NULL DEFAULT '[]',   -- [{relation, condition}]
  ConditionsJson NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  MedsJson       NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  CreatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Patients_Mobile ON dbo.Patients(Mobile);
CREATE INDEX IX_Patients_Name   ON dbo.Patients(FullName);

CREATE TABLE dbo.Tokens (
  TokenId    INT          IDENTITY PRIMARY KEY,
  TokenDate  DATE         NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
  DeptId     TINYINT      NOT NULL REFERENCES dbo.Departments(DeptId),
  SeqNo      INT          NOT NULL,           -- per-dept per-day sequence
  TokenNo    AS (CAST(SeqNo AS VARCHAR(8))) PERSISTED, -- display combines Series + SeqNo in procs
  PatientId  INT          NOT NULL REFERENCES dbo.Patients(PatientId),
  Status     VARCHAR(12)  NOT NULL DEFAULT 'waiting'
             CHECK (Status IN ('booked','checked-in','waiting','in-consult','done','cancelled')),
  Priority   VARCHAR(10)  NOT NULL DEFAULT 'normal' CHECK (Priority IN ('normal','urgent')),
  Category   VARCHAR(10)  NOT NULL DEFAULT 'normal' CHECK (Category IN ('normal','emergency','referral')),
  Source     VARCHAR(8)   NOT NULL DEFAULT 'counter' CHECK (Source IN ('counter','self')),
  Complaint  NVARCHAR(200) NULL,          -- symptom chips / chief complaint at booking
  FeeAmount  INT          NULL,
  FeeExemption NVARCHAR(30) NULL,         -- BPL / Govt scheme / JSY …
  SlotTime   CHAR(5)      NULL,           -- advance-booking slot, e.g. '10:30'
  VitalsDone BIT          NOT NULL DEFAULT 0,
  IssuedAt   DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME(),
  ArrivedAt  DATETIME2    NULL,           -- set at check-in (booked -> waiting)
  CalledAt   DATETIME2    NULL,
  CONSTRAINT UQ_Tokens_DeptDaySeq UNIQUE (TokenDate, DeptId, SeqNo)
);
CREATE INDEX IX_Tokens_Board ON dbo.Tokens(TokenDate, DeptId, Status);

CREATE TABLE dbo.Consults (
  ConsultId   INT           IDENTITY PRIMARY KEY,
  TokenId     INT           NOT NULL REFERENCES dbo.Tokens(TokenId),
  PatientId   INT           NOT NULL REFERENCES dbo.Patients(PatientId),
  DoctorId    INT           NOT NULL REFERENCES dbo.Users(UserId),
  Diagnosis   NVARCHAR(200) NULL,
  RxJson      NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  LabsJson    NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  Disposition VARCHAR(12)   NOT NULL DEFAULT 'home'
              CHECK (Disposition IN ('home','review','admit','refer')),
  Notes       NVARCHAR(MAX) NULL,
  CompletedAt DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.Vitals (
  VitalsId   INT          IDENTITY PRIMARY KEY,
  TokenId    INT          NOT NULL REFERENCES dbo.Tokens(TokenId),
  PatientId  INT          NOT NULL REFERENCES dbo.Patients(PatientId),
  Bp         VARCHAR(9)   NULL,
  Pulse      INT          NULL CHECK (Pulse BETWEEN 20 AND 250),
  Temp       DECIMAL(5,1) NULL CHECK (Temp BETWEEN 90 AND 110),
  Spo2       INT          NULL CHECK (Spo2 BETWEEN 50 AND 100),
  Rr         INT          NULL CHECK (Rr BETWEEN 5 AND 80),
  Weight     DECIMAL(5,1) NULL CHECK (Weight BETWEEN 1 AND 400),
  Height     DECIMAL(5,1) NULL CHECK (Height BETWEEN 30 AND 250),
  RecordedBy INT          NULL REFERENCES dbo.Users(UserId),
  RecordedAt DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Vitals_Patient ON dbo.Vitals(PatientId, RecordedAt DESC);

CREATE TABLE dbo.AuditLog (
  AuditId    BIGINT        IDENTITY PRIMARY KEY,
  At         DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
  ActorId    INT           NULL,
  Action     VARCHAR(40)   NOT NULL,
  Entity     VARCHAR(30)   NOT NULL,
  EntityRef  VARCHAR(30)   NOT NULL,
  Detail     NVARCHAR(400) NULL
);
GO

CREATE TABLE dbo.Symptoms (
  SymptomId  TINYINT      IDENTITY PRIMARY KEY,
  Code       VARCHAR(20)  NOT NULL UNIQUE,
  NameEn     NVARCHAR(60) NOT NULL,
  NameHin    NVARCHAR(60) NOT NULL,
  DeptId     TINYINT      NOT NULL REFERENCES dbo.Departments(DeptId)
);
GO

INSERT INTO dbo.Roles (RoleName) VALUES ('doctor'),('nurse'),('reception'),('pharmacy'),('admin');
INSERT INTO dbo.Departments (Code, Name, Series) VALUES
 ('GM','General Medicine','A'), ('PD','Pediatrics','B'), ('OB','Obstetrics','C'),
 ('OR','Orthopedics','D'), ('EN','ENT','E');
INSERT INTO dbo.Symptoms (Code, NameEn, NameHin, DeptId) VALUES
 ('fever',     N'Fever / cough',       N'बुखार / खांसी',      1),
 ('chest',     N'Chest pain',          N'छाती में दर्द',       1),
 ('stomach',   N'Stomach pain',        N'पेट दर्द',           1),
 ('bone',      N'Bone / joint pain',   N'हड्डी / जोड़ दर्द',   4),
 ('child',     N'Child''s illness',    N'बच्चे की समस्या',     2),
 ('pregnancy', N'Pregnancy care',      N'गर्भावस्था',          3),
 ('ent',       N'Ear / nose / throat', N'कान / नाक / गला',    5),
 ('skin',      N'Skin problem',        N'त्वचा समस्या',        1);
GO

-- NEW TABLES FOR MEDICINE, TEMPLATES & PHARMACY PRESCRIPTIONS

CREATE TABLE dbo.Facilities (
  FacilityCode VARCHAR(20)  PRIMARY KEY,
  Name         NVARCHAR(100) NOT NULL,
  Type         VARCHAR(30)   NOT NULL, -- District Hospital / PHC / CHC
  Address      NVARCHAR(200) NOT NULL,
  StateCode    CHAR(2)       NOT NULL DEFAULT 'MP',  -- feeds the UHID prefix
  DistrictCode CHAR(3)       NOT NULL DEFAULT 'BPL',
  ShortCode    CHAR(4)       NOT NULL DEFAULT 'DH01'
);

-- Per-facility, per-year UHID sequence: MP-BPL-DH01-26-00001
CREATE TABLE dbo.UhidSequences (
  FacilityCode VARCHAR(20) NOT NULL REFERENCES dbo.Facilities(FacilityCode),
  Yr           CHAR(2)     NOT NULL,
  LastSeq      INT         NOT NULL DEFAULT 0,
  CONSTRAINT PK_UhidSeq PRIMARY KEY (FacilityCode, Yr)
);

CREATE TABLE dbo.Medicines (
  MedicineId   VARCHAR(20)   PRIMARY KEY,
  Name         NVARCHAR(100) NOT NULL,
  GenericName  NVARCHAR(100) NOT NULL,
  Category     VARCHAR(40)   NOT NULL,
  DoseForms    NVARCHAR(MAX) NOT NULL DEFAULT '[]', -- JSON array of strings
  Strengths    NVARCHAR(MAX) NOT NULL DEFAULT '[]', -- JSON array of strings
  DefaultRoute VARCHAR(20)   NOT NULL,
  DefaultFreq  VARCHAR(20)   NOT NULL,
  DefaultDur   VARCHAR(20)   NOT NULL,
  IsControlled BIT           NOT NULL DEFAULT 0
);

CREATE TABLE dbo.FacilityMedicines (
  FacilityCode VARCHAR(20)  REFERENCES dbo.Facilities(FacilityCode),
  MedicineId   VARCHAR(20)  REFERENCES dbo.Medicines(MedicineId),
  PRIMARY KEY (FacilityCode, MedicineId)
);

CREATE TABLE dbo.DoctorMedicines (
  DoctorId     INT          REFERENCES dbo.Users(UserId),
  MedicineId   VARCHAR(20)  REFERENCES dbo.Medicines(MedicineId),
  IsQuickPick  BIT          NOT NULL DEFAULT 1,
  CustomDose   NVARCHAR(50) NULL,
  CustomFreq   VARCHAR(20)  NULL,
  PRIMARY KEY (DoctorId, MedicineId)
);

CREATE TABLE dbo.ConsultTemplates (
  TemplateId      INT           IDENTITY PRIMARY KEY,
  DoctorId        INT           NULL REFERENCES dbo.Users(UserId), -- NULL means system-wide default
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

CREATE TABLE dbo.Prescriptions (
  PrescriptionId INT          IDENTITY PRIMARY KEY,
  ConsultId      INT          NULL REFERENCES dbo.Consults(ConsultId),
  TokenId        INT          NOT NULL REFERENCES dbo.Tokens(TokenId),
  PatientId      INT          NOT NULL REFERENCES dbo.Patients(PatientId),
  DoctorId       INT          NOT NULL REFERENCES dbo.Users(UserId),
  FacilityCode   VARCHAR(20)  NOT NULL REFERENCES dbo.Facilities(FacilityCode),
  Status         VARCHAR(20)  NOT NULL DEFAULT 'pending' CHECK (Status IN ('pending', 'dispensing', 'dispensed', 'cancelled')),
  ItemsJson      NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  DispensedBy    INT          NULL REFERENCES dbo.Users(UserId),
  DispensedAt    DATETIME2    NULL
);
GO

-- Seed Facilities
INSERT INTO dbo.Facilities (FacilityCode, Name, Type, Address) VALUES
('DIST_HOSP_01', 'District Hospital, Bhopal', 'District Hospital', 'Bhopal'),
('PHC_AHD_02', 'Primary Health Centre, Anand Nagar', 'PHC', 'Anand Nagar'),
('CHC_COL_03', 'Community Health Centre, Kolar', 'CHC', 'Kolar');

-- Seed Medicines
INSERT INTO dbo.Medicines (MedicineId, Name, GenericName, Category, DoseForms, Strengths, DefaultRoute, DefaultFreq, DefaultDur, IsControlled) VALUES
('M-01', 'Paracetamol 500mg', 'Paracetamol', 'Analgesics', '["tablet", "syrup"]', '["500mg", "125mg/5ml"]', 'oral', 'TDS', '3 days', 0),
('M-02', 'Ibuprofen 400mg', 'Ibuprofen', 'Analgesics', '["tablet"]', '["400mg"]', 'oral', 'BD', '3 days', 0),
('M-03', 'Amoxicillin 500mg', 'Amoxicillin', 'Antibiotics', '["capsule", "syrup"]', '["500mg", "250mg/5ml"]', 'oral', 'TDS', '5 days', 0),
('M-04', 'Azithromycin 500mg', 'Azithromycin', 'Antibiotics', '["tablet"]', '["500mg", "250mg"]', 'oral', 'OD', '3 days', 0),
('M-05', 'Cetirizine 10mg', 'Cetirizine', 'Antihistamines', '["tablet"]', '["10mg"]', 'oral', 'HS', '5 days', 0),
('M-06', 'Metformin 500mg', 'Metformin', 'Antidiabetics', '["tablet"]', '["500mg", "850mg", "1000mg"]', 'oral', 'BD', '30 days', 0),
('M-07', 'Glimepiride 2mg', 'Glimepiride', 'Antidiabetics', '["tablet"]', '["1mg", "2mg"]', 'oral', 'OD', '30 days', 0),
('M-08', 'Telmisartan 40mg', 'Telmisartan', 'Antihypertensives', '["tablet"]', '["20mg", "40mg", "80mg"]', 'oral', 'OD', '30 days', 0),
('M-09', 'Amlodipine 5mg', 'Amlodipine', 'Antihypertensives', '["tablet"]', '["2.5mg", "5mg", "10mg"]', 'oral', 'OD', '30 days', 0),
('M-10', 'Pantoprazole 40mg', 'Pantoprazole', 'Gastrointestinal', '["tablet"]', '["40mg"]', 'oral', 'OD', '10 days', 0),
('M-11', 'Ranitidine 150mg', 'Ranitidine', 'Gastrointestinal', '["tablet"]', '["150mg", "300mg"]', 'oral', 'BD', '7 days', 0),
('M-12', 'Atorvastatin 10mg', 'Atorvastatin', 'Cardiovascular', '["tablet"]', '["10mg", "20mg", "40mg"]', 'oral', 'HS', '30 days', 0),
('M-13', 'Salbutamol Inhaler', 'Salbutamol', 'Respiratory', '["inhaler"]', '["100mcg/puff"]', 'inhalation', 'PRN', '15 days', 0),
('M-14', 'Montelukast 10mg', 'Montelukast', 'Respiratory', '["tablet"]', '["10mg", "5mg"]', 'oral', 'HS', '10 days', 0),
('M-15', 'Amoxicillin + Clavulanic Acid 625mg', 'Amoxicillin + Clavulanic Acid', 'Antibiotics', '["tablet"]', '["625mg", "375mg"]', 'oral', 'BD', '5 days', 0),
('M-16', 'Ciprofloxacin 500mg', 'Ciprofloxacin', 'Antibiotics', '["tablet"]', '["500mg"]', 'oral', 'BD', '5 days', 0),
('M-17', 'ORSalts (ORS) sachet', 'Oral Rehydration Salts', 'Gastrointestinal', '["powder"]', '["20.5g"]', 'oral', 'PRN', '3 days', 0),
('M-18', 'Loperamide 2mg', 'Loperamide', 'Gastrointestinal', '["capsule"]', '["2mg"]', 'oral', 'STAT', '1 day', 0),
('M-19', 'Morphine 10mg', 'Morphine', 'Analgesics', '["tablet", "injection"]', '["10mg", "15mg/ml"]', 'oral', 'TDS', '2 days', 1),
('M-20', 'Insulin Glargine 100 IU/ml', 'Insulin Glargine', 'Antidiabetics', '["injection"]', '["100 IU/ml"]', 'subcutaneous', 'OD', '30 days', 0),
('M-21', 'Multivitamin', 'Multivitamin', 'Others', '["tablet"]', '["1 tab"]', 'oral', 'OD', '30 days', 0),
('M-22', 'Folic Acid 5mg', 'Folic Acid', 'Others', '["tablet"]', '["5mg"]', 'oral', 'OD', '90 days', 0),
('M-23', 'Calcium Carbonate + Vit D3', 'Calcium + Vitamin D3', 'Others', '["tablet"]', '["500mg"]', 'oral', 'OD', '30 days', 0),
('M-24', 'Iron + Folic Acid (IFA)', 'Iron + Folic Acid', 'Others', '["tablet"]', '["100mg Iron + 0.5mg FA"]', 'oral', 'OD', '90 days', 0),
('M-25', 'Diclofenac 50mg', 'Diclofenac', 'Analgesics', '["tablet", "gel"]', '["50mg", "1% gel"]', 'oral', 'BD', '5 days', 0);

-- Seed Facility Mappings
-- DIST_HOSP_01: all
INSERT INTO dbo.FacilityMedicines (FacilityCode, MedicineId) SELECT 'DIST_HOSP_01', MedicineId FROM dbo.Medicines;
-- PHC_AHD_02: selective
INSERT INTO dbo.FacilityMedicines (FacilityCode, MedicineId) VALUES
('PHC_AHD_02','M-01'),('PHC_AHD_02','M-02'),('PHC_AHD_02','M-03'),('PHC_AHD_02','M-04'),('PHC_AHD_02','M-05'),
('PHC_AHD_02','M-06'),('PHC_AHD_02','M-07'),('PHC_AHD_02','M-08'),('PHC_AHD_02','M-09'),('PHC_AHD_02','M-10'),
('PHC_AHD_02','M-11'),('PHC_AHD_02','M-13'),('PHC_AHD_02','M-14'),('PHC_AHD_02','M-17'),('PHC_AHD_02','M-18'),
('PHC_AHD_02','M-21'),('PHC_AHD_02','M-22'),('PHC_AHD_02','M-23'),('PHC_AHD_02','M-24'),('PHC_AHD_02','M-25');
-- CHC_COL_03: selective (all except M-19 Morphine)
INSERT INTO dbo.FacilityMedicines (FacilityCode, MedicineId) SELECT 'CHC_COL_03', MedicineId FROM dbo.Medicines WHERE MedicineId <> 'M-19';

-- Seed System Default Templates
INSERT INTO dbo.ConsultTemplates (DoctorId, Name, Category, IsSystemDefault, Complaints, Examination, Diagnosis, PrescriptionJson, Advice, FollowUp) VALUES
(NULL, 'URTI (Common Cold)', 'General Medicine', 1, 
 'Sore throat, nasal congestion, runny nose, low-grade fever for 2 days.',
 'Throat congestion (+), chest clear, no lymphadenopathy.',
 'Acute Upper Respiratory Tract Infection (URTI)',
 '[{"name": "Paracetamol 500mg", "dose": "1-0-1", "route": "oral", "frequency": "BD", "duration": "3 days", "qty": 6}, {"name": "Cetirizine 10mg", "dose": "0-0-1", "route": "oral", "frequency": "HS", "duration": "5 days", "qty": 5}]',
 'Warm water gargling TDS. Warm fluids. Rest.',
 'OPD review if fever persists > 3 days.'),
(NULL, 'Acute Gastroenteritis', 'General Medicine', 1,
 'Watery diarrhea 4-5 times, vomiting 2 times, abdominal cramps since yesterday.',
 'Mild dehydration (+), abdomen soft, hyperactive bowel sounds.',
 'Acute Gastroenteritis',
 '[{"name": "ORSalts (ORS) sachet", "dose": "SOS", "route": "oral", "frequency": "SOS", "duration": "3 days", "qty": 5}, {"name": "Loperamide 2mg", "dose": "1-0-0", "route": "oral", "frequency": "STAT", "duration": "1 day", "qty": 1}]',
 'Drink ORS after every loose motion. Light diet (khichdi). Avoid dairy.',
 'Return immediately if vomiting prevents oral intake or blood in stool.'),
(NULL, 'Hypertension Follow-Up', 'General Medicine', 1,
 'Routine follow-up. No headache, chest pain, or dyspnea.',
 'BP: 130/80 mmHg, pulse: 76 bpm. S1 S2 normal.',
 'Essential Hypertension',
 '[{"name": "Telmisartan 40mg", "dose": "1-0-0", "route": "oral", "frequency": "OD", "duration": "30 days", "qty": 30}]',
 'Salt restricted diet. Daily walking 30 mins. Monitor BP weekly.',
 'Review with BP chart in 1 month.');
GO


-- Facility seed + FK for the UHID scheme (state → district → facility)
INSERT INTO dbo.Facilities (FacilityCode, Name, Type, Address, StateCode, DistrictCode, ShortCode) VALUES
 ('DIST_HOSP_01', N'District Hospital, Bhopal',            'District Hospital', N'Bhopal',      'MP', 'BPL', 'DH01'),
 ('PHC_AHD_02',   N'Primary Health Centre, Anand Nagar',   'PHC',               N'Anand Nagar', 'MP', 'BPL', 'PH02'),
 ('CHC_COL_03',   N'Community Health Centre, Kolar',       'CHC',               N'Kolar',       'MP', 'BPL', 'CH03');
GO
ALTER TABLE dbo.Patients ADD CONSTRAINT FK_Patients_Facility
  FOREIGN KEY (FacilityCode) REFERENCES dbo.Facilities(FacilityCode);
GO
