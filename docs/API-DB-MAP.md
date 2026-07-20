# API ↔ Stored Procedure ↔ Table Map

Every database touch goes through a stored procedure (the app account is
EXECUTE-only). This is the complete map of endpoint → procedure → tables.
Interactive API docs (request/response schemas, try-it-out): **`/api-docs`**
(sign in as admin; OpenAPI JSON at `/openapi.json`).

## Tables (16)

| Table | Purpose |
|---|---|
| `Roles`, `Users` | Staff accounts (bcrypt hash, role, facility) |
| `Departments` | OPD departments + token series letter (A, B, C…) |
| `Facilities` | Hospitals/PHCs/CHCs + UHID codes (state/district/short) |
| `UhidSequences` | Per-facility per-year counter behind the UHID |
| `Patients` | Master record — UHID, ABHA, blood group, allergies (med/food), family/social history, conditions (all JSON columns) |
| `Symptoms` | Symptom → department mapping for self-service booking |
| `Tokens` | The queue: status, category, source, slot, fee, complaint, vitals flag |
| `Vitals` | Every triage reading (BP, pulse, temp, SpO₂, RR, weight, height, who/when) |
| `Consults` | Diagnosis (multi, `;`-joined), Rx/labs JSON, disposition, notes |
| `Prescriptions` | Pharmacy queue: items JSON, pending→dispensing→dispensed |
| `Medicines`, `FacilityMedicines`, `DoctorMedicines` | Formulary, per-facility stock list, per-doctor quick picks |
| `ConsultTemplates` | Reusable clinical templates (system + per-doctor) |
| `AuditLog` | Every state change: who, what, when |

Functions: `fn_NextTokenNumber`, `fn_DisplayToken`, `fn_QueuePosition`,
`fn_MaskName` (privacy on the public board), `fn_MergeJsonArray` (history
union-merge on consult save).

## Endpoints

### Auth (`/api/auth`)
| Endpoint | Who | Procedure(s) | Tables |
|---|---|---|---|
| `POST /login` | public (rate-limited 10/15 min) | `usp_User_GetByUsername` | Users, Roles, AuditLog |
| `POST /refresh` | refresh JWT | `usp_User_GetById` | Users, Roles, AuditLog |
| `GET /me` | any signed-in | — (JWT claims only) | — |

### Patient self-service (`/api/public`, no login, rate-limited, PHI-masked)
| Endpoint | Procedure(s) | Tables |
|---|---|---|
| `GET /departments` | `usp_Department_List` | Departments |
| `GET /symptoms` | `usp_Symptom_List` | Symptoms, Departments |
| `GET /queue` + `GET /queue/stream` (SSE) | `usp_Queue_PublicBoard`, `usp_Token_ExpireStale` | Tokens, Patients, Departments |
| `GET /slots` | `usp_Slot_List` | Tokens |
| `POST /otp/request` | — (cache/Redis, never stored in DB) | — |
| `POST /self-token` | `usp_Patient_GetByAbha` / `usp_Patient_GetByMobile` / `usp_Patient_Create` / `usp_Token_Issue` | Patients, Facilities, UhidSequences, Tokens, AuditLog |
| `POST /track` | `usp_Token_Track` | Tokens, Patients, Departments |
| `POST /my-tokens` (OTP-gated recovery) | `usp_Token_ListByMobile` | Tokens, Patients |
| `POST /check-in` | `usp_Token_CheckIn` | Tokens, AuditLog |
| `POST /prepone` | `usp_Token_Prepone` | Tokens, AuditLog |

### Patients (`/api/patients` — staff)
| Endpoint | Who | Procedure(s) | Tables |
|---|---|---|---|
| `GET ?query=` | reception/doctor/nurse/admin | `usp_Patient_Search` | Patients, Departments |
| `GET /:id` | same | `usp_Patient_GetByCode` | Patients, Departments |
| `POST /` (register + token) | reception/admin | `usp_Patient_Create` + `usp_Token_Issue` | Patients, UhidSequences, Tokens, AuditLog |

### Queue (`/api/queue` — staff)
| Endpoint | Who | Procedure(s) | Tables |
|---|---|---|---|
| `GET /` | staff (doctors see triage-cleared only) | `usp_Queue_ByDepartment` (+latest vitals via OUTER APPLY) | Tokens, Patients, Departments, Vitals |
| `POST /tokens` (revisit) | reception/admin | `usp_Token_Issue` | Tokens, AuditLog |
| `PATCH /tokens/:id/status` | doctor/nurse | `usp_Token_UpdateStatus` (vitals gate; emergency bypass; idempotent resume) | Tokens, AuditLog |
| `PATCH /tokens/:id/vitals` | nurse/doctor | `usp_Vitals_Save` | Vitals, Tokens, AuditLog |
| `PATCH /tokens/:id/triage-return` | doctor/nurse | `usp_Token_ReturnToTriage` | Tokens, AuditLog |

### Consultations (`/api/consults` — doctor)
| Endpoint | Procedure(s) | Tables |
|---|---|---|
| `POST /` | `usp_Consult_Save` (+`fn_MergeJsonArray`) | Consults, Tokens (→done), Patients (allergies/blood group/family/social/conditions merged), Prescriptions (auto-created for pharmacy), AuditLog |

### Medicines & templates (doctor)
| Endpoint | Procedure(s) | Tables |
|---|---|---|
| `GET /api/medicines/facilities` | `usp_Facilities_List` | Facilities |
| `GET /api/medicines` | `usp_Medicines_List` | Medicines, FacilityMedicines, DoctorMedicines |
| `GET /api/medicines/search` | `usp_Medicines_Search` | Medicines, FacilityMedicines |
| `GET/PUT /api/medicines/quick` | `usp_DoctorMedicines_Get` / `_Set` | DoctorMedicines, Medicines |
| `GET/POST/PUT/DELETE /api/templates` | `usp_ConsultTemplates_List/Get/Save/Delete` | ConsultTemplates |

### Pharmacy (`/api/pharmacy`)
| Endpoint | Who | Procedure(s) | Tables |
|---|---|---|---|
| `GET /prescriptions` | pharmacy/admin | `usp_Prescriptions_List` | Prescriptions, Patients, Tokens |
| `PATCH /prescriptions/:id/status` | pharmacy | `usp_Prescriptions_UpdateStatus` | Prescriptions, AuditLog |

### Admin (`/api/admin`)
| Endpoint | Procedure(s) | Tables |
|---|---|---|
| `GET /flow-stats` | `usp_Admin_FlowStats` | Tokens, Consults, Prescriptions |
| `GET /timeline` | `usp_Admin_QueueTimeline` | Tokens, Patients, Prescriptions |

## Keeping a live DB current

Schema and procedures ship together; a DB created from an older script fails
with 500s when the app calls newer procedures ("something went wrong").
The fix is always the same two commands, both idempotent:

```bash
sqlcmd -S <server> -d HMIS -i server/sql/04_migrate_consult_context.sql  # schema
sqlcmd -S <server> -d HMIS -i server/sql/02_procs.sql                    # all 36 procs
```
