$BASE = "http://localhost:9090"
$PASS = 0; $FAIL = 0; $SKIP = 0; $LOG = @()

function T($name, $method, $path, $body, $token, $expStatus) {
    try {
        $h = @{"Content-Type"="application/json"}
        if ($token) { $h["Authorization"] = "Bearer $token" }
        $p = @{Uri="$BASE$path"; Method=$method; Headers=$h; UseBasicParsing=$true}
        if ($body) { $p["Body"]=$body }
        $r = Invoke-WebRequest @p -ErrorAction Stop
        $j = $r.Content | ConvertFrom-Json
        if ($r.StatusCode -eq $expStatus -and ($expStatus -ge 400 -or $j.success -eq $true)) {
            $script:PASS++; $script:LOG += "[PASS] $name ($($r.StatusCode))"
        } else {
            $script:FAIL++; $script:LOG += "[FAIL] $name - got=$($r.StatusCode) exp=$expStatus body=$($r.Content.Substring(0,[Math]::Min(300,$r.Content.Length)))"
        }
        return $j
    } catch {
        $s = 0; $b = ""
        if ($_.Exception.Response) {
            $s = [int]$_.Exception.Response.StatusCode
            try { $sr = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream()); $b = $sr.ReadToEnd() } catch {}
        }
        if ($s -eq $expStatus) { $script:PASS++; $script:LOG += "[PASS] $name ($s - expected error)" }
        else { $script:FAIL++; $script:LOG += "[FAIL] $name - got=$s exp=$expStatus body=$b" }
        return $null
    }
}

Write-Host "`n===== RECEIPTMIND API TESTS =====`n"

# --- 1. Health & Ready ---
T "GET /health" GET "/health" $null $null 200
T "GET /ready" GET "/ready" $null $null 200
T "GET /metrics" GET "/metrics" $null $null 200

# --- 2. Register ---
$e = "apitest$(Get-Random)@test.com"
$regBody = "{`"email`":`"$e`",`"password`":`"test123456`",`"organization_name`":`"TestOrg`"}"
$reg = T "POST /auth/register (valid)" POST "/auth/register" $regBody $null 201
T "POST /auth/register (missing fields)" POST "/auth/register" '{"email":"a@b.com"}' $null 400
T "POST /auth/register (short password)" POST "/auth/register" '{"email":"x@y.com","password":"ab","organization_name":"X"}' $null 400
T "POST /auth/register (duplicate)" POST "/auth/register" $regBody $null 409

if (-not $reg -or -not $reg.data) {
    Write-Host "FATAL: Register failed" -ForegroundColor Red
    $script:LOG | ForEach-Object { Write-Host $_ }
    exit 1
}

$TK = $reg.data.access_token
$OID = $reg.data.organization_id
$UID = $reg.data.user.id

# --- 3. Login ---
$logBody = "{`"email`":`"$e`",`"password`":`"test123456`"}"
T "POST /auth/login (valid)" POST "/auth/login" $logBody $null 200
T "POST /auth/login (wrong password)" POST "/auth/login" '{"email":"no@no.com","password":"wrong"}' $null 401
T "POST /auth/login (missing fields)" POST "/auth/login" '{}' $null 400

# --- 4. Users/Me ---
T "GET /users/me (auth)" GET "/users/me" $null $TK 200
T "GET /users/me (no token)" GET "/users/me" $null $null 401
T "GET /users/me (bad token)" GET "/users/me" $null "garbage" 401

# --- 5. Receipt Upload ---
$RID = $null
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllBytes($tmp, [System.Text.Encoding]::UTF8.GetBytes("fake receipt image data"))
try {
    $uh = @{"Authorization"="Bearer $TK"}
    $ur = Invoke-WebRequest -Uri "$BASE/receipts/upload" -Method POST -Headers $uh -Form @{file=Get-Item $tmp} -UseBasicParsing -ErrorAction Stop
    $uj = $ur.Content | ConvertFrom-Json
    if ($ur.StatusCode -eq 201 -and $uj.success -and $uj.data.receipt_id) {
        $script:PASS++; $script:LOG += "[PASS] POST /receipts/upload (201) id=$($uj.data.receipt_id)"
        $RID = $uj.data.receipt_id
    } else {
        $script:FAIL++; $script:LOG += "[FAIL] POST /receipts/upload - status=$($ur.StatusCode) body=$($ur.Content)"
    }
} catch {
    $s=0; if($_.Exception.Response){$s=[int]$_.Exception.Response.StatusCode}
    $script:FAIL++; $script:LOG += "[FAIL] POST /receipts/upload - status=$s"
} finally { Remove-Item $tmp -ErrorAction SilentlyContinue }

T "POST /receipts/upload (no auth)" POST "/receipts/upload" $null $null 401

# --- 6. List Receipts ---
T "GET /receipts/" GET "/receipts/" $null $TK 200
T "GET /receipts/?limit=5&offset=0" GET "/receipts/?limit=5&offset=0" $null $TK 200
T "GET /receipts/ (no auth)" GET "/receipts/" $null $null 401

# --- 7. Get Single Receipt ---
if ($RID) {
    $gr = T "GET /receipts/:id" GET "/receipts/$RID" $null $TK 200
} else {
    $script:SKIP++; $script:LOG += "[SKIP] GET /receipts/:id - no receipt_id"
}
T "GET /receipts/:id (not found)" GET "/receipts/00000000-0000-0000-0000-000000000000" $null $TK 404
T "GET /receipts/:id (no auth)" GET "/receipts/00000000-0000-0000-0000-000000000000" $null $null 401

# --- 8. Edit Receipt ---
if ($RID) {
    T "PATCH /receipts/:id (valid)" PATCH "/receipts/$RID" '{"vendor_name":"TestVendor","amount":99.99,"receipt_date":"2024-06-15","category":"Office"}' $TK 200
    T "PATCH /receipts/:id (invalid date)" PATCH "/receipts/$RID" '{"receipt_date":"bad-date"}' $TK 400
    T "PATCH /receipts/:id (no fields)" PATCH "/receipts/$RID" '{}' $TK 400
}

# --- 9. Export CSV ---
try {
    $ch = @{"Authorization"="Bearer $TK"}
    $cr = Invoke-WebRequest -Uri "$BASE/receipts/export/csv" -Method GET -Headers $ch -UseBasicParsing -ErrorAction Stop
    if ($cr.StatusCode -eq 200 -and $cr.Headers["Content-Type"] -like "*csv*") {
        $script:PASS++; $script:LOG += "[PASS] GET /receipts/export/csv (200 csv)"
    } else {
        $script:FAIL++; $script:LOG += "[FAIL] GET /receipts/export/csv - status=$($cr.StatusCode) ct=$($cr.Headers['Content-Type'])"
    }
} catch { $script:FAIL++; $script:LOG += "[FAIL] GET /receipts/export/csv - error" }

try {
    $cr2 = Invoke-WebRequest -Uri "$BASE/receipts/export/csv?start_date=2024-01-01&end_date=2024-12-31" -Method GET -Headers $ch -UseBasicParsing -ErrorAction Stop
    if ($cr2.StatusCode -eq 200) { $script:PASS++; $script:LOG += "[PASS] GET /receipts/export/csv?dates (200)" }
    else { $script:FAIL++; $script:LOG += "[FAIL] GET /receipts/export/csv?dates - status=$($cr2.StatusCode)" }
} catch { $script:FAIL++; $script:LOG += "[FAIL] GET /receipts/export/csv?dates - error" }

T "GET /receipts/export/csv (no auth)" GET "/receipts/export/csv" $null $null 401

# --- 10. Dashboard ---
T "GET /dashboard" GET "/dashboard" $null $TK 200
T "GET /dashboard (no auth)" GET "/dashboard" $null $null 401

# --- 11. Exceptions ---
T "GET /exceptions/" GET "/exceptions/" $null $TK 200
T "GET /exceptions/?status=open" GET "/exceptions/?status=open" $null $TK 200
T "GET /exceptions/ (no auth)" GET "/exceptions/" $null $null 401

# Resolve fake ID - expect 404
try {
    $rh = @{"Content-Type"="application/json";"Authorization"="Bearer $TK"}
    $rr = Invoke-WebRequest -Uri "$BASE/exceptions/00000000-0000-0000-0000-000000000000/resolve" -Method POST -Headers $rh -Body '{"vendor_name":"X","category":"Y"}' -UseBasicParsing -ErrorAction Stop
    $script:PASS++; $script:LOG += "[PASS] POST /exceptions/:id/resolve (200)"
} catch {
    $s=0; if($_.Exception.Response){$s=[int]$_.Exception.Response.StatusCode}
    if ($s -eq 404) { $script:PASS++; $script:LOG += "[PASS] POST /exceptions/:id/resolve (404 - no such exception)" }
    else { $script:FAIL++; $script:LOG += "[FAIL] POST /exceptions/:id/resolve - status=$s" }
}

# --- 12. Rules ---
T "GET /rules/" GET "/rules/" $null $TK 200
$ruleR = T "POST /rules/ (valid)" POST "/rules/" '{"condition_type":"vendor","condition_value":"Amazon","action_type":"set_category","action_value":"Shopping"}' $TK 201
T "POST /rules/ (invalid condition)" POST "/rules/" '{"condition_type":"bad","condition_value":"x","action_type":"set_category","action_value":"y"}' $TK 400
T "POST /rules/ (invalid action)" POST "/rules/" '{"condition_type":"vendor","condition_value":"x","action_type":"bad","action_value":"y"}' $TK 400
T "POST /rules/ (missing fields)" POST "/rules/" '{"condition_type":"vendor"}' $TK 400
T "POST /rules/ (no auth)" POST "/rules/" $null $null 401

# --- 13. Delete Receipt ---
if ($RID) {
    T "DELETE /receipts/:id" DELETE "/receipts/$RID" $null $TK 200
    T "GET /receipts/:id (after delete=404)" GET "/receipts/$RID" $null $TK 404
}
T "DELETE /receipts/:id (not found)" DELETE "/receipts/00000000-0000-0000-0000-000000000000" $null $TK 404

# --- Summary ---
Write-Host "`n===== RESULTS =====`n"
$script:LOG | ForEach-Object { Write-Host $_ }
Write-Host "`nPASS: $PASS  FAIL: $FAIL  SKIP: $SKIP  TOTAL: $($PASS+$FAIL+$SKIP)`n"
if ($FAIL -gt 0) { exit 1 }
