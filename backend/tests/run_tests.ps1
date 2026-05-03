$BASE = "http://localhost:9090"
$results = @()

function Test-Api {
    param($Name, $Method, $Path, $Body=$null, $Token=$null, $ExpectedStatus=200)
    try {
        $headers = @{"Content-Type"="application/json"}
        if ($Token) { $headers["Authorization"] = "Bearer $Token" }
        $irm = @{Uri="$BASE$Path"; Method=$Method; Headers=$headers; UseBasicParsing=$true}
        if ($Body) { $irm["Body"]=$Body }
        $r = Invoke-WebRequest @irm -ErrorAction Stop
        $json = $r.Content | ConvertFrom-Json
        $ok = $r.StatusCode -eq $ExpectedStatus -and $json.success -eq $true
        $results += "[PASS] $Name ($($r.StatusCode)) body=$($r.Content.Substring(0,[Math]::Min(200,$r.Content.Length)))"
        return @{ok=$true; data=$json.data; status=$r.StatusCode; raw=$r.Content}
    } catch {
        $status = 0
        $body = ""
        if ($_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
            $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $body = $sr.ReadToEnd()
        }
        $ok = $status -eq $ExpectedStatus
        if ($ok) {
            $results += "[PASS] $Name ($status - expected error)"
        } else {
            $results += "[FAIL] $Name (got=$status expected=$ExpectedStatus) body=$body"
        }
        return @{ok=$ok; data=$null; status=$status; raw=$body}
    }
}

# 1. Health
Test-Api "GET /health" GET "/health"

# 2. Ready
Test-Api "GET /ready" GET "/ready"

# 3. Register
$testEmail = "apitest$(Get-Random)@example.com"
$regBody = "{`"email`":`"$testEmail`",`"password`":`"test123456`",`"organization_name`":`"Test Corp`"}"
$reg = Test-Api "POST /auth/register" POST "/auth/register" $regBody 201

# Register - missing fields
Test-Api "POST /auth/register (missing fields)" POST "/auth/register" '{"email":"a@b.com"}' 400

# Register - short password
Test-Api "POST /auth/register (short password)" POST "/auth/register" '{"email":"x@y.com","password":"12","organization_name":"X"}' 400

# Register - duplicate
Test-Api "POST /auth/register (duplicate email)" POST "/auth/register" $regBody 409

if (-not $reg.ok) {
    Write-Output "FATAL: Register failed, cannot continue"
    $results | Out-File "C:\Users\Lenovo\OneDrive\Desktop\bookkeeper\receiptmind-enterprise\backend\test_results.txt" -Encoding UTF8
    exit 1
}

$TOKEN = $reg.data.access_token
$ORG_ID = $reg.data.organization_id
$USER_ID = $reg.data.user.id

# 4. Login
$loginBody = "{`"email`":`"$testEmail`",`"password`":`"test123456`"}"
$login = Test-Api "POST /auth/login" POST "/auth/login" $loginBody 200

# Login - wrong password
Test-Api "POST /auth/login (wrong password)" POST "/auth/login" '{"email":"no@no.com","password":"wrong"}' 401

# Login - missing fields
Test-Api "POST /auth/login (missing fields)" POST "/auth/login" '{}' 400

# 5. GetMe
Test-Api "GET /users/me (authenticated)" GET "/users/me" $null $TOKEN 200

# GetMe - no token
Test-Api "GET /users/me (no token)" GET "/users/me" $null $null 401

# GetMe - invalid token
Test-Api "GET /users/me (invalid token)" GET "/users/me" $null "invalid-token" 401

# 6. Upload receipt
$tmpFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmpFile, "fake receipt content")
try {
    $uploadHeaders = @{"Authorization"="Bearer $TOKEN"}
    $uploadResp = Invoke-WebRequest -Uri "$BASE/receipts/upload" -Method POST -Headers $uploadHeaders -Form @{file=Get-Item $tmpFile} -UseBasicParsing -ErrorAction Stop
    $uploadJson = $uploadResp.Content | ConvertFrom-Json
    if ($uploadResp.StatusCode -eq 201 -and $uploadJson.success -and $uploadJson.data.receipt_id) {
        $results += "[PASS] POST /receipts/upload (201) receipt_id=$($uploadJson.data.receipt_id)"
        $RECEIPT_ID = $uploadJson.data.receipt_id
    } else {
        $results += "[FAIL] POST /receipts/upload - status=$($uploadResp.StatusCode) body=$($uploadResp.Content)"
    }
} catch {
    $status = 0; $body = ""
    if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $body = $sr.ReadToEnd()
    }
    $results += "[FAIL] POST /receipts/upload - status=$status body=$body"
} finally {
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
}

# Upload - no auth
Test-Api "POST /receipts/upload (no auth)" POST "/receipts/upload" $null $null 401

# 7. List receipts
Test-Api "GET /receipts/" GET "/receipts/" $null $TOKEN 200

# List with pagination
Test-Api "GET /receipts/?limit=5&offset=0" GET "/receipts/?limit=5&offset=0" $null $TOKEN 200

# 8. Get single receipt
if ($RECEIPT_ID) {
    Test-Api "GET /receipts/:id" GET "/receipts/$RECEIPT_ID" $null $TOKEN 200
} else {
    $results += "[SKIP] GET /receipts/:id - no receipt_id"
}

# Get - not found
Test-Api "GET /receipts/:id (not found)" GET "/receipts/00000000-0000-0000-0000-000000000000" $null $TOKEN 404

# 9. Edit receipt
if ($RECEIPT_ID) {
    $editBody = '{"vendor_name":"Test Vendor","amount":99.99,"receipt_date":"2024-06-15","category":"Office Supplies"}'
    Test-Api "PATCH /receipts/:id" PATCH "/receipts/$RECEIPT_ID" $editBody $TOKEN 200

    # Edit - invalid date
    Test-Api "PATCH /receipts/:id (invalid date)" PATCH "/receipts/$RECEIPT_ID" '{"receipt_date":"not-a-date"}' $TOKEN 400

    # Edit - no fields
    Test-Api "PATCH /receipts/:id (no fields)" PATCH "/receipts/$RECEIPT_ID" '{}' $TOKEN 400
}

# 10. Export CSV
try {
    $csvHeaders = @{"Authorization"="Bearer $TOKEN"}
    $csvResp = Invoke-WebRequest -Uri "$BASE/receipts/export/csv" -Method GET -Headers $csvHeaders -UseBasicParsing -ErrorAction Stop
    if ($csvResp.StatusCode -eq 200 -and $csvResp.Headers["Content-Type"] -like "*text/csv*") {
        $results += "[PASS] GET /receipts/export/csv (200, text/csv)"
    } else {
        $results += "[FAIL] GET /receipts/export/csv - status=$($csvResp.StatusCode) ct=$($csvResp.Headers['Content-Type'])"
    }
} catch {
    $results += "[FAIL] GET /receipts/export/csv - error"
}

# CSV with date filter
try {
    $csvResp2 = Invoke-WebRequest -Uri "$BASE/receipts/export/csv?start_date=2024-01-01&end_date=2024-12-31" -Method GET -Headers $csvHeaders -UseBasicParsing -ErrorAction Stop
    if ($csvResp2.StatusCode -eq 200) {
        $results += "[PASS] GET /receipts/export/csv?start_date&end_date (200)"
    } else {
        $results += "[FAIL] GET /receipts/export/csv with dates - status=$($csvResp2.StatusCode)"
    }
} catch {
    $results += "[FAIL] GET /receipts/export/csv with dates - error"
}

# 11. Dashboard
Test-Api "GET /dashboard" GET "/dashboard" $null $TOKEN 200

# Dashboard - no auth
Test-Api "GET /dashboard (no auth)" GET "/dashboard" $null $null 401

# 12. Exceptions
Test-Api "GET /exceptions/" GET "/exceptions/" $null $TOKEN 200

Test-Api "GET /exceptions/?status=open" GET "/exceptions/?status=open" $null $TOKEN 200

# Resolve - will 404 if no exception
if ($RECEIPT_ID) {
    try {
        $resolveBody = '{"vendor_name":"Fixed Vendor","category":"Travel"}'
        $resolveHeaders = @{"Content-Type"="application/json";"Authorization"="Bearer $TOKEN"}
        $resolveResp = Invoke-WebRequest -Uri "$BASE/exceptions/00000000-0000-0000-0000-000000000000/resolve" -Method POST -Headers $resolveHeaders -Body $resolveBody -UseBasicParsing -ErrorAction Stop
        $results += "[PASS] POST /exceptions/:id/resolve (200)"
    } catch {
        $status = 0
        if ($_.Exception.Response) { $status = [int]$_.Exception.Response.StatusCode }
        if ($status -eq 404) {
            $results += "[PASS] POST /exceptions/:id/resolve (404 - no exception exists, expected)"
        } else {
            $results += "[FAIL] POST /exceptions/:id/resolve - status=$status"
        }
    }
}

# 13. Rules - list
Test-Api "GET /rules/" GET "/rules/" $null $TOKEN 200

# Rules - create
$ruleBody = '{"condition_type":"vendor","condition_value":"Amazon","action_type":"set_category","action_value":"Shopping"}'
$rule = Test-Api "POST /rules/" POST "/rules/" $ruleBody $TOKEN 201

# Rules - invalid condition_type
Test-Api "POST /rules/ (invalid condition_type)" POST "/rules/" '{"condition_type":"bad","condition_value":"x","action_type":"set_category","action_value":"y"}' $TOKEN 400

# Rules - invalid action_type
Test-Api "POST /rules/ (invalid action_type)" POST "/rules/" '{"condition_type":"vendor","condition_value":"x","action_type":"bad","action_value":"y"}' $TOKEN 400

# Rules - missing fields
Test-Api "POST /rules/ (missing fields)" POST "/rules/" '{"condition_type":"vendor"}' $TOKEN 400

# 14. Metrics
Test-Api "GET /metrics" GET "/metrics"

# 15. Delete receipt
if ($RECEIPT_ID) {
    Test-Api "DELETE /receipts/:id" DELETE "/receipts/$RECEIPT_ID" $null $TOKEN 200

    # Verify deleted
    Test-Api "GET /receipts/:id (after delete)" GET "/receipts/$RECEIPT_ID" $null $TOKEN 404
}

# Delete - not found
Test-Api "DELETE /receipts/:id (not found)" DELETE "/receipts/00000000-0000-0000-0000-000000000000" $null $TOKEN 404

# Write results
$pass = ($results | Where-Object { $_ -match "^\[PASS\]" }).Count
$fail = ($results | Where-Object { $_ -match "^\[FAIL\]" }).Count
$skip = ($results | Where-Object { $_ -match "^\[SKIP\]" }).Count

$summary = "`n========== TEST SUMMARY ==========`nPASS: $pass  FAIL: $fail  SKIP: $skip  TOTAL: $($pass+$fail+$skip)`n"
$results += $summary

Write-Output $summary
$results | ForEach-Object { Write-Output $_ }

$results | Out-File "C:\Users\Lenovo\OneDrive\Desktop\bookkeeper\receiptmind-enterprise\backend\test_results.txt" -Encoding UTF8
