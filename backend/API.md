# API Reference

Base URL: `http://localhost:8000/api/v1` (dev) — set via `NEXT_PUBLIC_API_URL` on the frontend.

---

## Environment Variables

### Frontend (Next.js — `.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL — must be reachable from the **user's browser**, not from inside Docker. In production use your public domain, e.g. `https://api.yourdomain.com`. |

---

### Backend (`.env` in `/backend`)

#### Application

| Variable | Default | Description |
|---|---|---|
| `APP_NAME` | `PDF Converter API` | Service name shown in health endpoints. |
| `ENVIRONMENT` | `production` | `development` or `production`. |
| `LOG_LEVEL` | `INFO` | `DEBUG` / `INFO` / `WARNING` / `ERROR`. |
| `API_PORT` | `8000` | Host-side port the API container binds to. |
| `ALLOWED_ORIGINS` | `http://localhost:3000,...` | Comma-separated list of frontend origins allowed by CORS. Must match the frontend URL. |

#### Database (PostgreSQL)

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `pdf_converter` | Database name. |
| `POSTGRES_USER` | `postgres` | Database user. |
| `POSTGRES_PASSWORD` | `postgres` | Database password. **Change in production.** |
| `POSTGRES_PORT` | `5433` | Host-side port (container always uses `5432`). |
| `DATABASE_URL` | *(built from above)* | Optional override for external PostgreSQL: `postgresql+psycopg://user:pass@host:5432/db`. |

#### Redis

| Variable | Default | Description |
|---|---|---|
| `REDIS_PORT` | `6379` | Host-side port for the Redis container. |

#### Celery (background workers)

| Variable | Default | Description |
|---|---|---|
| `CELERY_POOL` | `prefork` | `prefork` for production multi-process; `solo` for single-process (dev / Windows). |
| `CELERY_CONCURRENCY` | `2` | Number of worker processes. |

#### MinIO (object storage)

| Variable | Default | Description |
|---|---|---|
| `MINIO_ROOT_USER` | `minioadmin` | MinIO admin user. **Change in production.** |
| `MINIO_ROOT_PASSWORD` | `minioadmin` | MinIO admin password. **Change in production.** |
| `MINIO_API_PORT` | `9000` | Host-side port for the MinIO S3 API. |
| `MINIO_CONSOLE_PORT` | `9001` | Host-side port for the MinIO web console. |
| `MINIO_BUCKET_RAW` | `raw-documents` | Bucket for uploaded PDF files. |
| `MINIO_BUCKET_EXPORTS` | `excel-exports` | Bucket for generated Excel/CSV exports. |

#### Azure Document Intelligence (optional OCR)

| Variable | Default | Description |
|---|---|---|
| `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` | *(empty)* | Azure endpoint URL. Leave blank to disable Azure OCR. |
| `AZURE_DOCUMENT_INTELLIGENCE_KEY` | *(empty)* | Azure API key. |

---

## Endpoints

All routes are prefixed with `/api/v1`.

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service info (name, environment). |
| `GET` | `/health/live` | Liveness probe — returns `{"status":"ok"}`. |
| `GET` | `/health/ready` | Readiness probe — checks DB, Redis, and MinIO. |

### Transforms (`/api/v1/transforms/...`)

#### Upload & Preview

| Method | Path | Description |
|---|---|---|
| `POST` | `/transforms/preview` | Upload a PDF, parse synchronously, return `PreviewResponse`. |
| `POST` | `/transforms/jobs/preview` | Upload a PDF, enqueue background job, return `job_id`. |
| `GET` | `/transforms/jobs` | List all background jobs. |
| `GET` | `/transforms/jobs/{job_id}` | Get status/result of a single job. |
| `GET` | `/transforms/sessions/{session_id}` | Load a previously parsed session. |

#### Export

| Method | Path | Description |
|---|---|---|
| `POST` | `/transforms/export` | Export session as `.xlsx` (streaming download). Body: `{session_id, variant_key}`. |
| `POST` | `/transforms/export/csv` | Export session as `.csv` (streaming download). Body: `{session_id, variant_key}`. |

#### Session editing

| Method | Path | Description |
|---|---|---|
| `PATCH` | `/transforms/sessions/{session_id}/rows/{row_number}` | Update a single transaction row in a session. |

#### OCR Reviews

| Method | Path | Description |
|---|---|---|
| `POST` | `/transforms/ocr-reviews/{review_id}/materialize` | Finalize an OCR review and return updated `PreviewResponse`. |

#### Preferences & Memory

| Method | Path | Description |
|---|---|---|
| `POST` | `/transforms/preferences` | Save a column-mapping preference. |
| `GET` | `/transforms/preferences` | List all saved preferences. |
| `GET` | `/transforms/correction-memory` | List learned correction memory entries. |
| `GET` | `/transforms/history` | List recent sessions. |

#### Parsers & Vision

| Method | Path | Description |
|---|---|---|
| `GET` | `/transforms/parsers` | List all registered PDF parsers. |
| `GET` | `/transforms/vision-status` | Check whether vision/AI models are loaded. |

#### Templates

| Method | Path | Description |
|---|---|---|
| `GET` | `/transforms/templates` | List transformation templates. |
| `POST` | `/transforms/templates` | Create a new template. |
| `PATCH` | `/transforms/templates/{template_id}` | Update an existing template. |
| `GET` | `/transforms/template-seed/{session_id}/{variant_key}` | Get seed data for building a template from a session. |

#### OCR Mapping Templates

| Method | Path | Description |
|---|---|---|
| `GET` | `/transforms/ocr-mapping-templates` | List OCR mapping templates. |
| `GET` | `/transforms/ocr-rule-manager` | Get OCR rule manager snapshot. |
| `PATCH` | `/transforms/ocr-mapping-templates/{template_id}/status` | Enable or disable a template. |
| `POST` | `/transforms/ocr-mapping-templates/{template_id}/rollback` | Roll back a template to a previous version. |
| `GET` | `/transforms/ocr-mapping-templates/{template_id}/compare` | Diff two versions of a template. |

#### Onboarding

| Method | Path | Description |
|---|---|---|
| `GET` | `/transforms/onboarding/projects` | List onboarding projects. |
| `POST` | `/transforms/onboarding/projects` | Create a new onboarding project. |
| `GET` | `/transforms/onboarding/projects/{project_id}` | Get a single onboarding project. |
| `POST` | `/transforms/onboarding/projects/{project_id}/samples` | Add a sample document to an onboarding project. |
