param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host $Message
}

function Assert-Command([string]$Name, [string]$Message) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw $Message
  }
}

function Import-EnvFile([string]$Path) {
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    if ($trimmed -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      $name = $Matches[1]
      $value = $Matches[2]

      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        $value = $value.Substring(1, $value.Length - 2)
      }

      Set-Item -Path "Env:$name" -Value $value
    }
  }
}

function Get-PythonCommand {
  $python = Get-Command python -ErrorAction SilentlyContinue
  if ($python) {
    return [pscustomobject]@{
      Exe  = $python.Source
      Args = @()
    }
  }

  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) {
    return [pscustomobject]@{
      Exe  = $py.Source
      Args = @('-3')
    }
  }

  throw 'python 3.12 required'
}

Set-Location $PSScriptRoot

Write-Step '=== [1/6] Checking prerequisites ==='
Assert-Command docker 'docker required'
Assert-Command npm 'npm required'
Assert-Command node 'node 22+ required'
$null = & docker compose version *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'docker compose required'
}
$pythonCommand = Get-PythonCommand

Write-Step '=== [2/6] .env ==='
if (-not (Test-Path -LiteralPath '.env')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
Import-EnvFile -Path '.env'

$mysqlHostPort = if ($env:MYSQL_HOST_PORT) { $env:MYSQL_HOST_PORT } else { '33306' }
$localDatabaseUrl = "mysql+pymysql://pizza:pizza@127.0.0.1:$mysqlHostPort/pizzahust"
$databaseUrl = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { $localDatabaseUrl }
$databaseUrl = $databaseUrl -replace 'mysql:3306', "127.0.0.1:$mysqlHostPort"
$env:DATABASE_URL = $databaseUrl

Write-Step '=== [3/6] Booting MySQL + delivery-mock ==='
docker compose up -d mysql delivery-mock

Write-Host 'Waiting for MySQL...'
while ($true) {
  $ping = & docker compose exec -T mysql sh -lc 'mysqladmin ping -h127.0.0.1 -uroot -proot --silent' 2>$null
  if ($LASTEXITCODE -eq 0) {
    break
  }

  Start-Sleep -Seconds 2
}

Write-Step '=== [4/6] Backend deps + migrations + seed ==='
Push-Location backend
try {
  & $pythonCommand.Exe @($pythonCommand.Args + @('-m', 'venv', '.venv'))
  $venvPython = Join-Path -Path $PWD.Path -ChildPath '.venv\Scripts\python.exe'
  if (-not (Test-Path -LiteralPath $venvPython)) {
    throw 'failed to create backend virtual environment'
  }

  & $venvPython -m pip install --quiet --upgrade pip
  & $venvPython -m pip install --quiet -e '.[dev]'
  & $venvPython -m alembic upgrade head
  & $venvPython -m app.seeds.run
}
finally {
  Pop-Location
}

Write-Step '=== [5/6] Frontend deps ==='
Push-Location frontend
try {
  npm install --silent
  npx playwright install chromium | Out-Null
}
finally {
  Pop-Location
}

Write-Step '=== [6/6] Done. Bring up backend + frontend with: ==='
Write-Host '    docker compose up -d backend frontend'
Write-Host 'Or run them locally:'
Write-Host '    cd backend && .\.venv\Scripts\Activate.ps1 && uvicorn app.main:app --reload'
Write-Host '    cd frontend && npm run dev'
