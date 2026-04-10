# PDF Converter

`PDF Converter` is a financial statement transformation workbench. It ingests bank PDFs, Excel statements, and scanned images, normalizes them into a structured domain model, runs quality heuristics, applies saved OCR mapping rules, and exports explainable Excel/CSV output.

## Stack

- **backend**: `FastAPI`, `SQLAlchemy` + Alembic, `Celery`, `Redis`, `PostgreSQL`, `MinIO`
- **document pipeline**: `PyMuPDF`, `openpyxl`, `RapidOCR`, optional `Azure Document Intelligence`
- **frontend**: `Next.js 16`, `React 19`, `TypeScript`, `Tailwind CSS 4`
- **infra**: Docker Compose, separate `api`, `worker`, `web`, `postgres`, `redis`, `minio`

## Quick start — local Docker Desktop

One command starts the entire stack (backend + worker + frontend + all infra):

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.local.yml up --build -d
```

| Service       | URL                             |
|---------------|---------------------------------|
| Frontend      | http://localhost:3000           |
| Backend API   | http://localhost:8000           |
| API Docs      | http://localhost:8000/docs      |
| MinIO console | http://localhost:9001           |

Follow logs:
```powershell
docker compose -f docker-compose.local.yml logs -f
```

Stop everything:
```powershell
docker compose -f docker-compose.local.yml down
```

## Separate repo deployment

The `backend/` and `web/` directories are designed to live in **independent repositories** and be deployed separately. Each has its own `docker-compose.yml` and `.env.example`.

### Backend repo

```powershell
cd backend
Copy-Item .env.example .env   # set ALLOWED_ORIGINS to your frontend URL
docker compose up -d
```

The API starts at `http://localhost:8000`. Runs postgres, redis, minio, api, and worker.

### Frontend repo

```powershell
cd web
Copy-Item .env.example .env   # set NEXT_PUBLIC_API_URL to your backend URL
docker compose up -d --build
```

The frontend starts at `http://localhost:3000`.

**Key variable**: the frontend resolves `NEXT_PUBLIC_API_URL` at runtime on the page server and passes it into the client app. `API_URL` is also accepted as a fallback. The value must be the backend URL reachable from the user's browser.

## Development (local processes, Docker infra only)

```powershell
# Start only postgres / redis / minio:
Copy-Item .env.example .env
docker compose up -d

# Backend:
cd backend
uv run python main.py

# Worker:
cd backend
uv run celery -A app.core.celery_app:celery_app worker --loglevel=info --pool=solo

# Frontend:
cd web
npm install
npm run dev
```

## Implemented features

- Parser auto-detection (Kaspi Gold PDF/Excel, generic bank statements, OCR fallback)
- Async preview/OCR jobs with Celery, job status API and toast notifications
- OCR raw review with reusable versioned mapping rules
- Rule manager with enable/disable, version diff, rollback
- Fuzzy + exact correction memory — auto-applied to future sessions
- Quality engine: confidence scoring, duplicate detection, round-number flags, anomaly score
- Multi-bank onboarding projects
- Explainable Excel export with `Audit Trail` sheet + CSV export
- Tabbed workbench UI: Overview · Transactions · Quality · OCR · Rules · History

## Main API endpoints

| Method | Path                                              | Purpose                          |
|--------|---------------------------------------------------|----------------------------------|
| POST   | `/api/v1/transforms/preview`                      | Synchronous parse                |
| POST   | `/api/v1/transforms/jobs/preview`                 | Async job submission             |
| GET    | `/api/v1/transforms/jobs/{job_id}`                | Job status                       |
| GET    | `/api/v1/transforms/sessions/{session_id}`        | Reload saved session             |
| PATCH  | `/api/v1/transforms/sessions/{id}/rows/{n}`       | Manual row correction            |
| POST   | `/api/v1/transforms/export`                       | Excel export                     |
| POST   | `/api/v1/transforms/export/csv`                   | CSV export                       |
| POST   | `/api/v1/transforms/ocr-reviews/{id}/materialize` | OCR review → statement           |
| GET    | `/api/v1/transforms/ocr-rule-manager`             | OCR template versions            |
| GET    | `/api/v1/health`                                  | Health + dependency status       |

## Tests

```powershell
cd backend
uv run pytest
```
