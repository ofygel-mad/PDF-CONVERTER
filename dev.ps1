#!/usr/bin/env pwsh
# ─────────────────────────────────────────────────────────────────────────────
# dev.ps1 — запуск окружения для разработки
#
# Использование:
#   .\dev.ps1            → показывает инструкции
#   .\dev.ps1 infra      → поднимает только postgres + redis + minio (Docker)
#   .\dev.ps1 infra stop → останавливает инфраструктуру
# ─────────────────────────────────────────────────────────────────────────────

param([string]$Command = "help", [string]$Action = "")

$Red    = "`e[31m"
$Green  = "`e[32m"
$Yellow = "`e[33m"
$Blue   = "`e[34m"
$Cyan   = "`e[36m"
$Reset  = "`e[0m"
$Bold   = "`e[1m"

function Write-Step($msg) { Write-Host "${Cyan}▶ $msg${Reset}" }
function Write-Ok($msg)   { Write-Host "${Green}✓ $msg${Reset}" }
function Write-Warn($msg) { Write-Host "${Yellow}⚠ $msg${Reset}" }
function Write-Err($msg)  { Write-Host "${Red}✕ $msg${Reset}" }

# ── Commands ──────────────────────────────────────────────────────────────────

switch ($Command) {

  "infra" {
    if ($Action -eq "stop") {
      Write-Step "Stopping infrastructure..."
      docker compose down
      Write-Ok "Infrastructure stopped."
    } else {
      Write-Step "Starting infrastructure (postgres, redis, minio)..."
      if (-not (Test-Path ".env")) {
        Copy-Item ".env.example" ".env"
        Write-Ok "Created .env from .env.example"
      }
      docker compose up -d
      Write-Ok "Infrastructure running."
      Write-Host ""
      Write-Host "  postgres  → localhost:5433"
      Write-Host "  redis     → localhost:6379"
      Write-Host "  minio     → localhost:9000  (console: localhost:9001)"
    }
  }

  default {
    Write-Host ""
    Write-Host "${Bold}PDF Converter — Developer Guide${Reset}"
    Write-Host ""
    Write-Host "${Bold}STEP 1 — Install uv (Python package manager)${Reset}"
    Write-Host "  Run once:"
    Write-Host "${Yellow}  pip install uv${Reset}"
    Write-Host "  uv will download Python 3.12 automatically on first use."
    Write-Host ""
    Write-Host "${Bold}STEP 2 — Start infrastructure (Docker)${Reset}"
    Write-Host "${Yellow}  .\dev.ps1 infra${Reset}"
    Write-Host "  Starts postgres, redis, minio in Docker (background)."
    Write-Host ""
    Write-Host "${Bold}STEP 3 — Backend  (new terminal)${Reset}"
    Write-Host "${Yellow}  cd backend${Reset}"
    Write-Host "${Yellow}  uv run python main.py${Reset}"
    Write-Host "  API → http://localhost:8000   Docs → http://localhost:8000/docs"
    Write-Host ""
    Write-Host "${Bold}STEP 4 — Worker  (new terminal, optional)${Reset}"
    Write-Host "${Yellow}  cd backend${Reset}"
    Write-Host "${Yellow}  uv run celery -A app.core.celery_app:celery_app worker --loglevel=info --pool=solo${Reset}"
    Write-Host "  Needed only for async 'Queue Job' feature."
    Write-Host ""
    Write-Host "${Bold}STEP 5 — Frontend  (new terminal)${Reset}"
    Write-Host "${Yellow}  cd web${Reset}"
    Write-Host "${Yellow}  pnpm run dev${Reset}"
    Write-Host "  Frontend → http://localhost:3000"
    Write-Host ""
    Write-Host "─────────────────────────────────────────────────────────────────"
    Write-Host "${Bold}Full Docker stack (no local installs needed):${Reset}"
    Write-Host "${Yellow}  docker compose -f docker-compose.local.yml up --build -d${Reset}"
    Write-Host ""
    Write-Host "${Bold}Stop infrastructure:${Reset}"
    Write-Host "${Yellow}  .\dev.ps1 infra stop${Reset}"
    Write-Host ""
  }
}
