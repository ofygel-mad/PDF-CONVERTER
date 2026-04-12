# PDF Converter

`PDF Converter` is a statement conversion tool for finance workflows. Upload a bank PDF, Excel statement, or scan, inspect the normalized preview, and export the result to Excel or CSV.

## Stack

- backend: `FastAPI`, `SQLAlchemy` + Alembic, `PostgreSQL`
- document pipeline: `PyMuPDF`, `openpyxl`, `RapidOCR`, optional `Azure Document Intelligence`
- frontend: `Next.js 16`, `React 19`, `TypeScript`, `Tailwind CSS 4`
- infra: Docker Compose, separate `api`, `web`, `postgres`

## Quick start

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.local.yml up --build -d
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

Logs:

```powershell
docker compose -f docker-compose.local.yml logs -f
```

Stop:

```powershell
docker compose -f docker-compose.local.yml down
```

## Deployment split

The frontend and backend are designed to be deployed as separate repositories/services.

### Frontend env

```env
API_URL=https://your-backend.up.railway.app
```

### Backend env

```env
APP_NAME=PDF Converter API
ENVIRONMENT=production
LOG_LEVEL=INFO
APP_HOST=0.0.0.0
APP_PORT=8000
API_V1_PREFIX=/api/v1
ALLOWED_ORIGINS=https://your-frontend.up.railway.app
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname
```

Optional OCR env:

```env
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=
AZURE_DOCUMENT_INTELLIGENCE_KEY=
```

## Main API endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/transforms/preview` | Parse and build preview |
| GET | `/api/v1/transforms/sessions/{session_id}` | Reload saved session |
| PATCH | `/api/v1/transforms/sessions/{id}/rows/{n}` | Manual row correction |
| POST | `/api/v1/transforms/export` | Excel export |
| POST | `/api/v1/transforms/export/csv` | CSV export |
| POST | `/api/v1/transforms/ocr-reviews/{id}/materialize` | Confirm OCR mapping |
| GET | `/api/v1/transforms/history` | Recent sessions |
| GET | `/api/v1/transforms/parsers` | Supported input formats |
| GET | `/api/v1/health/ready` | Database readiness |

## Tests

```powershell
cd backend
uv run pytest
```
