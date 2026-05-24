$baseUrl = "http://localhost:3001"
$email = "test@example.com"
$password = "password123"

# Colors for output
$Green = "[32m"
$Red = "[31m"
$Reset = "[0m"

function Log-Success($msg) { Write-Host "${Green}[PASS]${Reset} $msg" }
function Log-Error($msg) { Write-Host "${Red}[FAIL]${Reset} $msg" }

Write-Host "--- Starting API Tests (Node.js Backend) ---"

# 1. Login
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    if ($loginResp.success) {
        $token = $loginResp.data.access_token
        Log-Success "Login successful"
    } else {
        Log-Error "Login failed: $($loginResp.error)"
        exit 1
    }
} catch {
    Log-Error "Login failed: $($_.Exception.Message)"
    exit 1
}

$headers = @{ Authorization = "Bearer $token" }

# 2. Test User Me
try {
    $me = Invoke-RestMethod -Uri "$baseUrl/users/me" -Method Get -Headers $headers
    if ($me.success) { Log-Success "Get /users/me" } else { Log-Error "Get /users/me: $($me.error)" }
} catch { Log-Error "Get /users/me: $($_.Exception.Message)" }

# 3. Test Dashboard Stats
try {
    $stats = Invoke-RestMethod -Uri "$baseUrl/dashboard" -Method Get -Headers $headers
    if ($stats.success) { Log-Success "Get /dashboard" } else { Log-Error "Get /dashboard: $($stats.error)" }
} catch { Log-Error "Get /dashboard: $($_.Exception.Message)" }

# 4. Test Receipts List
try {
    $receipts = Invoke-RestMethod -Uri "$baseUrl/receipts" -Method Get -Headers $headers
    if ($receipts.success) { Log-Success "Get /receipts" } else { Log-Error "Get /receipts: $($receipts.error)" }
} catch { Log-Error "Get /receipts: $($_.Exception.Message)" }

# 5. Test Expenses List
try {
    $expenses = Invoke-RestMethod -Uri "$baseUrl/expenses" -Method Get -Headers $headers
    if ($expenses.success) { Log-Success "Get /expenses" } else { Log-Error "Get /expenses: $($expenses.error)" }
} catch { Log-Error "Get /expenses: $($_.Exception.Message)" }

# 6. Test Rules List
try {
    $rules = Invoke-RestMethod -Uri "$baseUrl/rules" -Method Get -Headers $headers
    if ($rules.success) { Log-Success "Get /rules" } else { Log-Error "Get /rules: $($rules.error)" }
} catch { Log-Error "Get /rules: $($_.Exception.Message)" }

# 7. Test Exceptions List
try {
    $exceptions = Invoke-RestMethod -Uri "$baseUrl/exceptions" -Method Get -Headers $headers
    if ($exceptions.success) { Log-Success "Get /exceptions" } else { Log-Error "Get /exceptions: $($exceptions.error)" }
} catch { Log-Error "Get /exceptions: $($_.Exception.Message)" }

# 8. Test Metrics Processing Times
try {
    $metrics = Invoke-RestMethod -Uri "$baseUrl/metrics/processing-times" -Method Get -Headers $headers
    if ($metrics.success) { Log-Success "Get /metrics/processing-times" } else { Log-Error "Get /metrics/processing-times: $($metrics.error)" }
} catch { Log-Error "Get /metrics/processing-times: $($_.Exception.Message)" }

# 9. Test Export History
try {
    $history = Invoke-RestMethod -Uri "$baseUrl/receipts/exports/history" -Method Get -Headers $headers
    if ($history.success) { Log-Success "Get /receipts/exports/history" } else { Log-Error "Get /receipts/exports/history: $($history.error)" }
} catch { Log-Error "Get /receipts/exports/history: $($_.Exception.Message)" }

Write-Host "--- API Tests Completed ---"
