$baseUrl = "http://localhost:8085"

# 1. Health Check
Write-Host "`n[1/5] Testing Health Check..." -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "SUCCESS: Backend is healthy" -ForegroundColor Green
    $health | ConvertTo-Json
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

# 2. Register Test User
Write-Host "`n[2/5] Testing User Registration..." -ForegroundColor Cyan
$rand = Get-Random -Minimum 1000 -Maximum 9999
$testEmail = "testuser$rand@example.com"
$regBody = @{
    email = $testEmail
    password = "Password123!"
    organization_name = "Test Corp"
}
try {
    $regResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method Post -Body ($regBody | ConvertTo-Json) -ContentType "application/json"
    Write-Host "SUCCESS: User registered" -ForegroundColor Green
    $regResponse | ConvertTo-Json
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { 
        $err = $_.ErrorDetails | ConvertFrom-Json
        Write-Host "Server Error: $($err.error)" -ForegroundColor Yellow 
    }
}

# 3. Login
Write-Host "`n[3/5] Testing Login..." -ForegroundColor Cyan
$loginBody = @{
    email = $testEmail
    password = "Password123!"
}
try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body ($loginBody | ConvertTo-Json) -ContentType "application/json"
    $token = $loginResponse.data.access_token
    Write-Host "SUCCESS: Logged in" -ForegroundColor Green
    Write-Host "Token received (first 20 chars): $($token.Substring(0, 20))..."
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { 
        $err = $_.ErrorDetails | ConvertFrom-Json
        Write-Host "Server Error: $($err.error)" -ForegroundColor Yellow 
    }
}

# 4. Get Profile (Auth Test)
Write-Host "`n[4/5] Testing Profile (Authorized)..." -ForegroundColor Cyan
try {
    $headers = @{ Authorization = "Bearer $token" }
    $profile = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers $headers
    Write-Host "SUCCESS: Profile retrieved" -ForegroundColor Green
    $profile | ConvertTo-Json
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) { 
        $err = $_.ErrorDetails | ConvertFrom-Json
        Write-Host "Server Error: $($err.error)" -ForegroundColor Yellow 
    }
}

# 5. List Receipts
Write-Host "`n[5/5] Testing List Receipts..." -ForegroundColor Cyan
try {
    $receipts = Invoke-RestMethod -Uri "$baseUrl/receipts" -Method Get -Headers $headers
    Write-Host "SUCCESS: Receipts listed ($($receipts.Count) found)" -ForegroundColor Green
} catch {
    Write-Host "FAILED: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nTests Completed." -ForegroundColor Gray
