$ErrorActionPreference = "Stop"

param(
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "DATABASE_URL is required"
}

$schemaPath = Join-Path $PSScriptRoot "..\db\schema.sql"
if (!(Test-Path $schemaPath)) {
  throw "Schema file not found at $schemaPath"
}

psql $DatabaseUrl -f $schemaPath
