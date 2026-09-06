#!/usr/bin/env pwsh

$ErrorActionPreference = "Stop"
$BackendDir = $PSScriptRoot

Set-Location $BackendDir

$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

if (Test-Path $VenvPython) {
    & $VenvPython "main.py" @args
    exit $LASTEXITCODE
}

if (Get-Command uv -ErrorAction SilentlyContinue) {
    & uv run python "main.py" @args
    exit $LASTEXITCODE
}

throw "Не найден Python в backend\.venv и команда uv. Установите зависимости или выполните: pip install uv"