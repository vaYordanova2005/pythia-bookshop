# setup-db.ps1 — one-shot local database setup for Pythia.
#
#   powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
#
# Prompts for your local postgres password, creates the `pythia` database,
# loads the schema + books from pythia_pg.sql, seeds the demo users, and
# writes the connection string into .env.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
if (-not $psql) { throw "psql.exe not found under C:\Program Files\PostgreSQL" }
Write-Host "Using $psql"

$secure = Read-Host "Local postgres password (for user 'postgres')" -AsSecureString
$plain  = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$env:PGPASSWORD = $plain

# 1 · connection check
& $psql -U postgres -h localhost -d postgres -c "SELECT 1" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not connect — wrong password?" }
Write-Host "Connected." -ForegroundColor Green

# 2 · database
$exists = & $psql -U postgres -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='pythia'"
if ($exists -ne "1") {
  & $psql -U postgres -h localhost -d postgres -c "CREATE DATABASE pythia" | Out-Null
  Write-Host "Created database 'pythia'." -ForegroundColor Green
} else {
  Write-Host "Database 'pythia' already exists."
}

# 3 · schema + books
& $psql -U postgres -h localhost -d pythia -v ON_ERROR_STOP=1 -f pythia_pg.sql
if ($LASTEXITCODE -ne 0) { throw "Loading pythia_pg.sql failed" }
Write-Host "Schema and books loaded." -ForegroundColor Green

# 4 · .env
$escaped = [uri]::EscapeDataString($plain)
$url = "postgresql://postgres:$escaped@localhost:5432/pythia"
$env_lines = Get-Content .env | ForEach-Object {
  if ($_ -match '^DATABASE_URL=') { "DATABASE_URL=$url" } else { $_ }
}
$env_lines | Set-Content .env -Encoding utf8
Write-Host "Wrote DATABASE_URL into .env." -ForegroundColor Green

# 5 · demo users
node seed_pg.js

# 6 · report
$books = & $psql -U postgres -h localhost -d pythia -tAc "SELECT COUNT(*) FROM books"
$env:PGPASSWORD = $null
Write-Host ""
Write-Host "Done — $($books.Trim()) books in the catalogue. Run: npm start" -ForegroundColor Green
