# ReceiptMind Backend Integration Test Script
# Prerequisites: Backend running on $BASE_URL with Postgres + Redis connected
# Run: pwsh -File tests/integration_test.ps1

$ErrorActionPreference = "Continue"
$BASE_URL = "http://localhost:8080"
$PASS = 0
$FAIL = 0
$RESULTS = @()

function Test-Route {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [string]$Body = "",
        [string]$Token = "",
        [int]$ExpectedStatus = 200,
        [hashtable]$ExpectedFields = @{},
        [string]$ContentType = "application/json"
    )

    $headers = @{ "Content-Type" = $ContentType }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }

    try {
        $irmParams = @{
            Uri = "$BASE_URL$Path"
            Method = $Method
            Headers = $headers
            UseBasicParsing = $true
        }
        if ($ContentType -eq "multipart/form-data") {
            # Can't easily do multipart in Invoke-RestMethod, skip body
            $irmParams["Headers"].Remove("Content-Type")
        } elseif ($Body) {
            $irmParams["Body"] = $Body
        }

        $resp = Invoke-WebRequest @irmParams -ErrorAction Stop
        $status = $resp.StatusCode
        $json = $resp.Content | ConvertFrom-Json

        $ok = $status -eq $ExpectedStatus
        $missing = @()
        foreach ($key in $ExpectedFields.Keys) {
            $val = $json
            foreach ($part in $key.Split(".")) {
                $val = $val.$part
            }
            if ($null -eq $val) {
                $missing += $key
                $ok = $false
            } elseif ($ExpectedFields[$key] -ne "" -and "$val" -ne $ExpectedFields[$key]) {
                $missing += "$key=$val (expected $($ExpectedFields[$key]))"
                $ok = $false
            }
        }

        if ($ok) {
            $PASS++
            $RESULTS += "[PASS] $Name ($status)"
        } else {
            $FAIL++
            $detail = if ($status -ne $ExpectedStatus) { "status=$status expected=$ExpectedStatus" } else { "missing: $($missing -join ', ')" }
            $RESULTS += "[FAIL] $Name - $detail"
        }

        return $json
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq $ExpectedStatus) {
            $PASS++
            $RESULTS += "[PASS] $Name ($status - expected error)"
        } else {
            $FAIL++
            $RESULTS += "[FAIL] $Name - Exception: $($_.Exception.Message)"
        }
        return $null
    }
}

Write-Host "`n========== ReceiptMind Backend Integration Tests ==========`n"

# ---- 1. Health ----
Write-Host "--- Health & Readiness ---"
Test-Route -Name "GET /health" -Method GET -Path "/health" -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.status"="ok"}
Test-Route -Name "GET /ready" -Method GET -Path "/ready" -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.status"="ready"}

# ---- 2. Auth: Register ----
Write-Host "`n--- Auth: Register ---"
$testEmail = "test_$(Get-Random)@example.com"
$registerBody = "{`"email`":`"$testEmail`",`"password`":`"test123456`",`"organization_name`":`"Test Corp`"}"
$regResp = Test-Route -Name "POST /auth/register" -Method POST -Path "/auth/register" -Body $registerBody -ExpectedStatus 201 -ExpectedFields @{"success"="True"; "data.access_token"=""; "data.refresh_token"=""; "data.organization_id"=""; "data.user.id"=""; "data.user.email"=$testEmail}

# Register with missing fields
Test-Route -Name "POST /auth/register (missing fields)" -Method POST -Path "/auth/register" -Body '{"email":"a@b.com"}' -ExpectedStatus 400

# Register duplicate
Test-Route -Name "POST /auth/register (duplicate email)" -Method POST -Path "/auth/register" -Body $registerBody -ExpectedStatus 409

# Register short password
Test-Route -Name "POST /auth/register (short password)" -Method POST -Path "/auth/register" -Body '{"email":"x@y.com","password":"12","organization_name":"X"}' -ExpectedStatus 400

if ($null -eq $regResp) {
    Write-Host "`nFATAL: Registration failed, cannot continue tests." -ForegroundColor Red
    Write-Host ($RESULTS -join "`n")
    exit 1
}

$TOKEN = $regResp.data.access_token
$ORG_ID = $regResp.data.organization_id
$USER_ID = $regResp.data.user.id

# ---- 3. Auth: Login ----
Write-Host "`n--- Auth: Login ---"
$loginBody = "{`"email`":`"$testEmail`",`"password`":`"test123456`"}"
$loginResp = Test-Route -Name "POST /auth/login" -Method POST -Path "/auth/login" -Body $loginBody -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.access_token"=""; "data.refresh_token"=""; "data.user.email"=$testEmail}

# Login with wrong password
Test-Route -Name "POST /auth/login (wrong password)" -Method POST -Path "/auth/login" -Body '{"email":"no@no.com","password":"wrong"}' -ExpectedStatus 401

# Login with missing fields
Test-Route -Name "POST /auth/login (missing fields)" -Method POST -Path "/auth/login" -Body '{}' -ExpectedStatus 400

# ---- 4. Users: GetMe ----
Write-Host "`n--- Users: GetMe ---"
Test-Route -Name "GET /users/me (authenticated)" -Method GET -Path "/users/me" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.id"=$USER_ID; "data.email"=$testEmail; "data.organization_id"=$ORG_ID}

Test-Route -Name "GET /users/me (no token)" -Method GET -Path "/users/me" -ExpectedStatus 401

Test-Route -Name "GET /users/me (invalid token)" -Method GET -Path "/users/me" -Token "invalid-token" -ExpectedStatus 401

# ---- 5. Receipts: Upload ----
Write-Host "`n--- Receipts: Upload ---"
# Create a temp test file for upload
$tmpFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmpFile, "fake receipt content for testing")

try {
    $uploadHeaders = @{ "Authorization" = "Bearer $TOKEN" }
    $uploadResp = Invoke-WebRequest -Uri "$BASE_URL/receipts/upload" -Method POST -Headers $uploadHeaders -Form @{file=Get-Item -Path $tmpFile} -UseBasicParsing -ErrorAction Stop
    $uploadJson = $uploadResp.Content | ConvertFrom-Json
    if ($uploadResp.StatusCode -eq 201 -and $uploadJson.success -eq $true -and $uploadJson.data.receipt_id) {
        $PASS++
        $RESULTS += "[PASS] POST /receipts/upload (201, receipt_id=$($uploadJson.data.receipt_id))"
        $RECEIPT_ID = $uploadJson.data.receipt_id
    } else {
        $FAIL++
        $RESULTS += "[FAIL] POST /receipts/upload - status=$($uploadResp.StatusCode) success=$($uploadJson.success)"
    }
} catch {
    $FAIL++
    $RESULTS += "[FAIL] POST /receipts/upload - Exception: $($_.Exception.Message)"
}
finally {
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
}

# Upload without file
Test-Route -Name "POST /receipts/upload (no file)" -Method POST -Path "/receipts/upload" -Token $TOKEN -ExpectedStatus 400

# Upload without auth
Test-Route -Name "POST /receipts/upload (no auth)" -Method POST -Path "/receipts/upload" -ExpectedStatus 401

# ---- 6. Receipts: List ----
Write-Host "`n--- Receipts: List ---"
$listResp = Test-Route -Name "GET /receipts/" -Method GET -Path "/receipts/" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.receipts"=""; "data.total"=""; "data.limit"=""; "data.offset"=""}

Test-Route -Name "GET /receipts/?limit=5&offset=0" -Method GET -Path "/receipts/?limit=5&offset=0" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.limit"="5"; "data.offset"="0"}

Test-Route -Name "GET /receipts/ (no auth)" -Method GET -Path "/receipts/" -ExpectedStatus 401

# ---- 7. Receipts: Get Single ----
Write-Host "`n--- Receipts: Get Single ---"
if ($RECEIPT_ID) {
    $detailResp = Test-Route -Name "GET /receipts/:id" -Method GET -Path "/receipts/$RECEIPT_ID" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.id"=$RECEIPT_ID; "data.file_url"=""; "data.exceptions"=""}
} else {
    $FAIL++
    $RESULTS += "[SKIP] GET /receipts/:id - no receipt_id from upload"
}

Test-Route -Name "GET /receipts/:id (not found)" -Method GET -Path "/receipts/00000000-0000-0000-0000-000000000000" -Token $TOKEN -ExpectedStatus 404

# ---- 8. Receipts: Edit ----
Write-Host "`n--- Receipts: Edit ---"
if ($RECEIPT_ID) {
    $editBody = '{"vendor_name":"Test Vendor","amount":99.99,"receipt_date":"2024-06-15","category":"Office Supplies"}'
    Test-Route -Name "PATCH /receipts/:id" -Method PATCH -Path "/receipts/$RECEIPT_ID" -Token $TOKEN -Body $editBody -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.updated"="True"}

    # Edit with invalid date
    Test-Route -Name "PATCH /receipts/:id (invalid date)" -Method PATCH -Path "/receipts/$RECEIPT_ID" -Token $TOKEN -Body '{"receipt_date":"not-a-date"}' -ExpectedStatus 400

    # Edit with no fields
    Test-Route -Name "PATCH /receipts/:id (no fields)" -Method PATCH -Path "/receipts/$RECEIPT_ID" -Token $TOKEN -Body '{}' -ExpectedStatus 400
}

# ---- 9. Receipts: Export CSV ----
Write-Host "`n--- Receipts: Export CSV ---"
try {
    $csvHeaders = @{ "Authorization" = "Bearer $TOKEN" }
    $csvResp = Invoke-WebRequest -Uri "$BASE_URL/receipts/export/csv" -Method GET -Headers $csvHeaders -UseBasicParsing -ErrorAction Stop
    if ($csvResp.StatusCode -eq 200 -and $csvResp.Headers["Content-Type"] -like "*text/csv*") {
        $PASS++
        $RESULTS += "[PASS] GET /receipts/export/csv (200, text/csv)"
    } else {
        $FAIL++
        $RESULTS += "[FAIL] GET /receipts/export/csv - status=$($csvResp.StatusCode) content-type=$($csvResp.Headers['Content-Type'])"
    }
} catch {
    $FAIL++
    $RESULTS += "[FAIL] GET /receipts/export/csv - Exception: $($_.Exception.Message)"
}

# CSV with date filters
try {
    $csvResp2 = Invoke-WebRequest -Uri "$BASE_URL/receipts/export/csv?start_date=2024-01-01&end_date=2024-12-31" -Method GET -Headers $csvHeaders -UseBasicParsing -ErrorAction Stop
    if ($csvResp2.StatusCode -eq 200) {
        $PASS++
        $RESULTS += "[PASS] GET /receipts/export/csv?start_date&end_date (200)"
    } else {
        $FAIL++
        $RESULTS += "[FAIL] GET /receipts/export/csv with dates - status=$($csvResp2.StatusCode)"
    }
} catch {
    $FAIL++
    $RESULTS += "[FAIL] GET /receipts/export/csv with dates - Exception: $($_.Exception.Message)"
}

# ---- 10. Dashboard ----
Write-Host "`n--- Dashboard ---"
Test-Route -Name "GET /dashboard" -Method GET -Path "/dashboard" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.total_receipts"=""; "data.total_amount"=""; "data.processed_count"=""; "data.pending_count"=""; "data.needs_review_count"=""}

Test-Route -Name "GET /dashboard (no auth)" -Method GET -Path "/dashboard" -ExpectedStatus 401

# ---- 11. Exceptions ----
Write-Host "`n--- Exceptions ---"
Test-Route -Name "GET /exceptions/" -Method GET -Path "/exceptions/" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"}

Test-Route -Name "GET /exceptions/?status=open" -Method GET -Path "/exceptions/?status=open" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"}

Test-Route -Name "GET /exceptions/ (no auth)" -Method GET -Path "/exceptions/" -ExpectedStatus 401

# Resolve exception (will 404 if no exception exists, that's OK)
if ($RECEIPT_ID) {
    $resolveBody = '{"vendor_name":"Fixed Vendor","category":"Travel"}'
    try {
        $resolveResp = Invoke-WebRequest -Uri "$BASE_URL/exceptions/00000000-0000-0000-0000-000000000000/resolve" -Method POST -Headers @{"Authorization"="Bearer $TOKEN"; "Content-Type"="application/json"} -Body $resolveBody -UseBasicParsing -ErrorAction Stop
        # If we get here it was 200
        $PASS++
        $RESULTS += "[PASS] POST /exceptions/:id/resolve (200)"
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 404) {
            $PASS++
            $RESULTS += "[PASS] POST /exceptions/:id/resolve (404 - no exception, expected)"
        } else {
            $FAIL++
            $RESULTS += "[FAIL] POST /exceptions/:id/resolve - status=$status"
        }
    }
}

# ---- 12. Rules ----
Write-Host "`n--- Rules ---"
Test-Route -Name "GET /rules/" -Method GET -Path "/rules/" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"}

$ruleBody = '{"condition_type":"vendor","condition_value":"Amazon","action_type":"set_category","action_value":"Shopping"}'
$createRuleResp = Test-Route -Name "POST /rules/" -Method POST -Path "/rules/" -Token $TOKEN -Body $ruleBody -ExpectedStatus 201 -ExpectedFields @{"success"="True"; "data.condition_type"="vendor"; "data.action_type"="set_category"; "data.is_active"="True"}

# Invalid condition_type
Test-Route -Name "POST /rules/ (invalid condition_type)" -Method POST -Path "/rules/" -Token $TOKEN -Body '{"condition_type":"bad","condition_value":"x","action_type":"set_category","action_value":"y"}' -ExpectedStatus 400

# Invalid action_type
Test-Route -Name "POST /rules/ (invalid action_type)" -Method POST -Path "/rules/" -Token $TOKEN -Body '{"condition_type":"vendor","condition_value":"x","action_type":"bad","action_value":"y"}' -ExpectedStatus 400

# Missing fields
Test-Route -Name "POST /rules/ (missing fields)" -Method POST -Path "/rules/" -Token $TOKEN -Body '{"condition_type":"vendor"}' -ExpectedStatus 400

# No auth
Test-Route -Name "POST /rules/ (no auth)" -Method POST -Path "/rules/" -ExpectedStatus 401

# ---- 13. Metrics ----
Write-Host "`n--- Metrics ---"
Test-Route -Name "GET /metrics" -Method GET -Path "/metrics" -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.request_count"=""; "data.error_count"=""; "data.error_rate_percent"=""; "data.job_queue_size"=""; "data.dead_letter_size"=""}

# ---- 14. Receipts: Delete ----
Write-Host "`n--- Receipts: Delete ---"
if ($RECEIPT_ID) {
    Test-Route -Name "DELETE /receipts/:id" -Method DELETE -Path "/receipts/$RECEIPT_ID" -Token $TOKEN -ExpectedStatus 200 -ExpectedFields @{"success"="True"; "data.deleted"="True"}

    # Verify deleted
    Test-Route -Name "GET /receipts/:id (after delete)" -Method GET -Path "/receipts/$RECEIPT_ID" -Token $TOKEN -ExpectedStatus 404
}

Test-Route -Name "DELETE /receipts/:id (not found)" -Method DELETE -Path "/receipts/00000000-0000-0000-0000-000000000000" -Token $TOKEN -ExpectedStatus 404

# ---- Summary ----
Write-Host "`n========== Test Summary =========="
Write-Host "PASSED: $PASS"
Write-Host "FAILED: $FAIL"
Write-Host "TOTAL:  $($PASS + $FAIL)"
Write-Host "`nDetails:`n"
$RESULTS | ForEach-Object { Write-Host $_ }
Write-Host "`n=================================="

if ($FAIL -gt 0) { exit 1 } else { exit 0 }
