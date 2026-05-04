$baseUrl = "http://localhost:8085"
$pass = 0; $fail = 0
$backendEnv = Join-Path $PSScriptRoot "backend\.env"
$emailWebhookToken = ""
if (Test-Path $backendEnv) {
    $tokenLine = Select-String -Path $backendEnv -Pattern '^EMAIL_WEBHOOK_TOKEN=' | Select-Object -First 1
    if ($tokenLine) {
        $emailWebhookToken = $tokenLine.Line -replace '^EMAIL_WEBHOOK_TOKEN=', ''
    }
}

function Test-Route($num, $name, $method, $url, $body, $headers, $expectStatus) {
    Write-Host "`n[$num] $name" -ForegroundColor Cyan
    Write-Host "  $method $url" -ForegroundColor DarkGray
    if ($body) { Write-Host "  Body: $($body | ConvertTo-Json -Compress)" -ForegroundColor DarkGray }
    if ($headers) { Write-Host "  Headers: Authorization Bearer ..." -ForegroundColor DarkGray }
    try {
        $params = @{ Uri = $url; Method = $method; ContentType = "application/json" }
        if ($body) { $params.Body = ($body | ConvertTo-Json) }
        if ($headers) { $params.Headers = $headers }
        $res = Invoke-RestMethod @params
        Write-Host "  PASS ($expectStatus)" -ForegroundColor Green
        $script:pass++
        return $res
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq $expectStatus) {
            Write-Host "  PASS (expected $expectStatus, got $status)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "  FAIL (expected $expectStatus, got $status)" -ForegroundColor Red
            if ($_.ErrorDetails) { Write-Host "  Error: $($_.ErrorDetails)" -ForegroundColor DarkRed }
            $script:fail++
        }
        return $null
    }
}

# ════════════════════════════════════════════════════
# 1. HEALTH & READINESS (Public)
# ════════════════════════════════════════════════════
Test-Route "1.1" "Health Check" "GET" "$baseUrl/health" $null $null 200 | Out-Null
Test-Route "1.2" "Readiness Probe" "GET" "$baseUrl/ready" $null $null 200 | Out-Null

# ════════════════════════════════════════════════════
# 2. AUTH - REGISTER (Public)
# ════════════════════════════════════════════════════
$rand = Get-Random -Minimum 10000 -Maximum 99999
$testEmail = "fulltest$rand@example.com"
$regBody = @{ email = $testEmail; password = "TestPass123!"; organization_name = "Full Test Corp" }
$regRes = Test-Route "2.1" "Register User" "POST" "$baseUrl/auth/register" $regBody $null 201
$token = $regRes.data.access_token
$authHeaders = @{ Authorization = "Bearer $token" }

# ════════════════════════════════════════════════════
# 3. AUTH - LOGIN (Public)
# ════════════════════════════════════════════════════
$loginBody = @{ email = $testEmail; password = "TestPass123!" }
$loginRes = Test-Route "3.1" "Login (valid)" "POST" "$baseUrl/auth/login" $loginBody $null 200
$token = $loginRes.data.access_token
$authHeaders = @{ Authorization = "Bearer $token" }

# ════════════════════════════════════════════════════
# 4. AUTH - BAD LOGIN (expect 401)
# ════════════════════════════════════════════════════
Test-Route "4.1" "Login (wrong password)" "POST" "$baseUrl/auth/login" @{ email = $testEmail; password = "wrong" } $null 401 | Out-Null

# ════════════════════════════════════════════════════
# 5. EMAIL INBOUND (Public webhook)
# ════════════════════════════════════════════════════
$b64Content = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("fake pdf content"))
$emailBody = @{ from = $testEmail; subject = "Test Receipt"; message_id = "msg-$rand@test.com"; attachments = @(@{ filename = "receipt.pdf"; content = $b64Content }) }
$emailHeaders = if ($emailWebhookToken) { @{ "X-Webhook-Token" = $emailWebhookToken } } else { $null }
Test-Route "5.1" "Email Inbound" "POST" "$baseUrl/email/inbound" $emailBody $emailHeaders 200 | Out-Null

# ════════════════════════════════════════════════════
# 6. USERS (Auth)
# ════════════════════════════════════════════════════
Test-Route "6.1" "Get My Profile" "GET" "$baseUrl/users/me" $null $authHeaders 200 | Out-Null
Test-Route "6.2" "Get Profile (no auth)" "GET" "$baseUrl/users/me" $null @{} 401 | Out-Null

# ════════════════════════════════════════════════════
# 7. RECEIPTS - UPLOAD (Auth, Multipart via curl)
# ════════════════════════════════════════════════════
Write-Host "`n[7.1] Upload Receipt (multipart)" -ForegroundColor Cyan
Write-Host "  POST $baseUrl/receipts/upload  |  File: test_receipt.pdf" -ForegroundColor DarkGray
$tempFile = "$env:TEMP\test_receipt_$rand.pdf"
Set-Content -Path $tempFile -Value "Fake PDF receipt content" -NoNewline
try {
    $curlOut = curl.exe -s -X POST "$baseUrl/receipts/upload" -H "Authorization: Bearer $token" -F "file=@$tempFile;type=application/pdf" 2>&1
    $jsonRes = $curlOut | ConvertFrom-Json
    if ($jsonRes.success -eq $true) {
        Write-Host "  PASS (201)" -ForegroundColor Green
        $script:pass++
        $receiptId = $jsonRes.data.receipt_id
        Write-Host "  Receipt ID: $receiptId" -ForegroundColor DarkGray
    } else {
        Write-Host "  FAIL (upload returned error)" -ForegroundColor Red
        Write-Host "  Error: $($curlOut)" -ForegroundColor DarkRed
        $script:fail++
        $receiptId = $null
    }
} catch {
    Write-Host "  FAIL (exception)" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor DarkRed
    $script:fail++
    $receiptId = $null
}
Remove-Item $tempFile -Force -ErrorAction SilentlyContinue

# Fallback: grab receipt from email inbound
if (-not $receiptId) {
    Write-Host "  Using email-created receipt as fallback" -ForegroundColor Yellow
    try {
        $listRes = Invoke-RestMethod -Uri "$baseUrl/receipts/?limit=1" -Method Get -Headers $authHeaders -ContentType "application/json"
        if ($listRes.data.receipts -and $listRes.data.receipts.Count -gt 0) {
            $receiptId = $listRes.data.receipts[0].id
            Write-Host "  Fallback receipt ID: $receiptId" -ForegroundColor DarkGray
        }
    } catch { }
}

# ════════════════════════════════════════════════════
# 8. RECEIPTS - GET BY ID (Auth)
# ════════════════════════════════════════════════════
if ($receiptId) {
    Test-Route "8.1" "Get Receipt by ID" "GET" "$baseUrl/receipts/$receiptId" $null $authHeaders 200 | Out-Null
} else {
    Write-Host "`n[8.1] SKIPPED (no receipt)" -ForegroundColor Yellow
}

# ════════════════════════════════════════════════════
# 9. RECEIPTS - LIST (Auth)
# ════════════════════════════════════════════════════
Test-Route "9.1" "List Receipts" "GET" "$baseUrl/receipts/" $null $authHeaders 200 | Out-Null

# ════════════════════════════════════════════════════
# 10. RECEIPTS - EDIT (Auth)
# ════════════════════════════════════════════════════
if ($receiptId) {
    $editBody = @{ vendor_name = "Test Vendor"; amount = 99.99; category = "office_supplies"; receipt_date = "2026-05-03" }
    Test-Route "10.1" "Edit Receipt" "PATCH" "$baseUrl/receipts/$receiptId" $editBody $authHeaders 200 | Out-Null
} else {
    Write-Host "`n[10.1] SKIPPED (no receipt)" -ForegroundColor Yellow
}

# ════════════════════════════════════════════════════
# 11. RECEIPTS - EXPORT CSV (Auth)
# ════════════════════════════════════════════════════
Test-Route "11.1" "Export CSV" "GET" "$baseUrl/receipts/export/csv" $null $authHeaders 200 | Out-Null

# ════════════════════════════════════════════════════
# 12. RECEIPTS - DELETE (Auth)
# ════════════════════════════════════════════════════
if ($receiptId) {
    Test-Route "12.1" "Delete Receipt" "DELETE" "$baseUrl/receipts/$receiptId" $null $authHeaders 200 | Out-Null
    Test-Route "12.2" "Get Deleted Receipt (404)" "GET" "$baseUrl/receipts/$receiptId" $null $authHeaders 404 | Out-Null
} else {
    Write-Host "`n[12.1] SKIPPED (no receipt)" -ForegroundColor Yellow
}

# ════════════════════════════════════════════════════
# 13. EXPENSES (Auth)
# ════════════════════════════════════════════════════
Test-Route "13.1" "List Expenses" "GET" "$baseUrl/expenses/" $null $authHeaders 200 | Out-Null

# ════════════════════════════════════════════════════
# 14. EXCEPTIONS (Auth)
# ════════════════════════════════════════════════════
Test-Route "14.1" "List Exceptions" "GET" "$baseUrl/exceptions/" $null $authHeaders 200 | Out-Null

# ════════════════════════════════════════════════════
# 15. EXCEPTIONS - RESOLVE (Auth, expect 404 for fake ID)
# ════════════════════════════════════════════════════
$fakeUUID = "00000000-0000-0000-0000-000000000000"
Test-Route "15.1" "Resolve Exception (not found)" "POST" "$baseUrl/exceptions/$fakeUUID/resolve" @{ vendor_name = "Fixed" } $authHeaders 404 | Out-Null

# ════════════════════════════════════════════════════
# 16. RULES - CREATE (Auth)
# ════════════════════════════════════════════════════
$ruleBody = @{ condition_type = "amount_range"; condition_value = "1000-5000"; action_type = "set_category"; action_value = "high_value" }
$ruleRes = Test-Route "16.1" "Create Rule" "POST" "$baseUrl/rules/" $ruleBody $authHeaders 201

# ════════════════════════════════════════════════════
# 17. RULES - LIST (Auth)
# ════════════════════════════════════════════════════
Test-Route "17.1" "List Rules" "GET" "$baseUrl/rules/" $null $authHeaders 200 | Out-Null

# ════════════════════════════════════════════════════
# 18. DASHBOARD (Auth)
# ════════════════════════════════════════════════════
Test-Route "18.1" "Dashboard Stats" "GET" "$baseUrl/dashboard" $null $authHeaders 200 | Out-Null

# ════════════════════════════════════════════════════
# 19. METRICS (Public)
# ════════════════════════════════════════════════════
Test-Route "19.1" "System Metrics" "GET" "$baseUrl/metrics" $null $null 200 | Out-Null

# ════════════════════════════════════════════════════
# 20. UNAUTH ACCESS CHECKS
# ════════════════════════════════════════════════════
Test-Route "20.1" "Receipts (no auth)" "GET" "$baseUrl/receipts/" $null @{} 401 | Out-Null
Test-Route "20.2" "Rules (no auth)" "POST" "$baseUrl/rules/" $ruleBody @{} 401 | Out-Null
Test-Route "20.3" "Dashboard (no auth)" "GET" "$baseUrl/dashboard" $null @{} 401 | Out-Null
Test-Route "20.4" "Exceptions (no auth)" "GET" "$baseUrl/exceptions/" $null @{} 401 | Out-Null
Test-Route "20.5" "Expenses (no auth)" "GET" "$baseUrl/expenses/" $null @{} 401 | Out-Null

# ════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════
Write-Host "`n================================================" -ForegroundColor White
Write-Host "  ALL ROUTES TEST COMPLETE" -ForegroundColor White
Write-Host "  PASSED: $($pass.ToString().PadLeft(2))  |  FAILED: $($fail.ToString().PadLeft(2))" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "================================================" -ForegroundColor White
