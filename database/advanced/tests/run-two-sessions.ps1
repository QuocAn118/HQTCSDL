param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("lost-update-naive", "lost-update-safe", "isolation-rc", "isolation-rr", "isolation-snapshot")]
    [string]$Scenario
)

$ErrorActionPreference = "Stop"
$Server = "tcp:127.0.0.1,1433"
$Database = "SwiftletCare_Perf"
$sqlcmd = (Get-Command sqlcmd.exe -ErrorAction Stop).Source
$tempDir = Join-Path $env:TEMP ("advanced-concurrency-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

function Invoke-Query {
    param([string]$Query)
    $result = & $sqlcmd -S $Server -E -C -d $Database -l 30 -b -h -1 -W -s "|" -Q $Query
    if ($LASTEXITCODE -ne 0) { throw "SQL query failed with exit code $LASTEXITCODE." }
    return $result
}
function Invoke-SqlFile {
    param([string]$Path)
    $result = & $sqlcmd -S $Server -E -C -d $Database -l 60 -b -i $Path
    if ($LASTEXITCODE -ne 0) { throw "SQL file failed: $Path (exit $LASTEXITCODE)." }
    return $result
}
function Start-SqlSession {
    param([string]$SqlFile)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $sqlcmd
    $psi.Arguments = "-S `"$Server`" -E -C -d `"$Database`" -l 60 -b -i `"$SqlFile`""
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    return [PSCustomObject]@{
        Process = $process
        Stdout = $process.StandardOutput.ReadToEndAsync()
        Stderr = $process.StandardError.ReadToEndAsync()
    }
}

if ($Scenario -like "isolation-*") {
    $repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $scenarioDir = Join-Path $repoRoot "database\advanced\concurrency\$Scenario"
    foreach ($name in @("setup.sql", "session-a.sql", "session-b.sql", "check.sql")) {
        if (-not (Test-Path (Join-Path $scenarioDir $name))) { throw "Missing file: $(Join-Path $scenarioDir $name)" }
    }

    $originalText = Invoke-Query @"
SET NOCOUNT ON;
SELECT CONVERT(varchar(50), TargetValue)
FROM dbo.Thresholds WHERE ZoneId=2 AND MetricCode='TEMP';
"@
    $originalText = ($originalText | ForEach-Object { $_.Trim() } | Where-Object { $_ }) | Select-Object -First 1
    if (-not $originalText) { throw "Cannot read original H1-F1 TEMP TargetValue." }

    $runA = $null
    $runB = $null
    try {
        Write-Host "===== $Scenario =====" -ForegroundColor Cyan
        Write-Host "Database: $Database | H1-F1 TEMP: ZoneId=2"
        Invoke-SqlFile (Join-Path $scenarioDir "setup.sql") | Write-Host

        Write-Host "`nStarting Session A..."
        $runA = Start-SqlSession (Join-Path $scenarioDir "session-a.sql")
        Start-Sleep -Seconds 1
        Write-Host "Starting Session B..."
        $runB = Start-SqlSession (Join-Path $scenarioDir "session-b.sql")

        $runA.Process.WaitForExit()
        $runB.Process.WaitForExit()
        $runA.Stdout.Wait(); $runA.Stderr.Wait()
        $runB.Stdout.Wait(); $runB.Stderr.Wait()

        $outA = [string]$runA.Stdout.Result
        $errA = [string]$runA.Stderr.Result
        $outB = [string]$runB.Stdout.Result
        $errB = [string]$runB.Stderr.Result
        Set-Content (Join-Path $tempDir "session-A.out") $outA
        Set-Content (Join-Path $tempDir "session-A.err") $errA
        Set-Content (Join-Path $tempDir "session-B.out") $outB
        Set-Content (Join-Path $tempDir "session-B.err") $errB

        Write-Host "`n--- Session A ---"; Write-Host $outA
        if ($errA.Trim()) { Write-Host $errA -ForegroundColor Red }
        Write-Host "`n--- Session B ---"; Write-Host $outB
        if ($errB.Trim()) { Write-Host $errB -ForegroundColor Red }
        if ($runA.Process.ExitCode -ne 0 -or $runB.Process.ExitCode -ne 0) {
            throw "A/B session failed. See $tempDir"
        }

        Write-Host "`n--- Check ---"
        Invoke-SqlFile (Join-Path $scenarioDir "check.sql") | Write-Host
        Write-Host "PASS: $Scenario" -ForegroundColor Green
    }
    finally {
        foreach ($run in @($runA, $runB)) {
            if ($null -ne $run) {
                try { if (-not $run.Process.HasExited) { $run.Process.WaitForExit() } } catch {}
            }
        }
        # Restore the pre-test threshold value; DemoLog remains as evidence.
        try {
            Invoke-Query @"
SET NOCOUNT ON;
UPDATE dbo.Thresholds
SET TargetValue = $originalText, UpdatedAt = SYSUTCDATETIME()
WHERE ZoneId=2 AND MetricCode='TEMP';
"@ | Out-Null
            Write-Host "`nOriginal H1-F1 TEMP TargetValue restored: $originalText" -ForegroundColor Yellow
        } catch {
            Write-Warning "Could not restore original TargetValue: $_"
        }
        foreach ($run in @($runA, $runB)) { if ($null -ne $run) { $run.Process.Dispose() } }
        Write-Host "Diagnostic logs: $tempDir" -ForegroundColor Yellow
    }
    exit 0
}

# Existing Task 5 lost-update runner: unchanged behavior.
$DeviceCode = "H1-F1-FAN"
$UserId = 2
$procedure = if ($Scenario -eq "lost-update-naive") { "dbo.sp_SetActuatorNaive" } else { "dbo.sp_SetActuatorSafe" }
$original = $null
$runA = $null
$runB = $null
try {
    Write-Host "===== $Scenario =====" -ForegroundColor Cyan
    Write-Host "Database: $Database"
    Write-Host "Device: $DeviceCode"
    Write-Host "Procedure: $procedure"
    $stateRows = Invoke-Query @"
SET NOCOUNT ON;
SELECT CONCAT(Mode, '|', CONVERT(varchar(1), IsOn), '|', COALESCE(CONVERT(varchar(3), Level), 'NULL'))
FROM dbo.Devices
WHERE Code = '$DeviceCode' AND IsActive = 1 AND DeviceType = 'FAN';
"@
    $stateLine = $stateRows | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^(AUTO|MANUAL)\|[01]\|' } | Select-Object -First 1
    if (-not $stateLine) { throw "Cannot find active device $DeviceCode." }
    $original = $stateLine.Split("|")
    Write-Host "Original state: $stateLine"
    Invoke-Query @"
SET NOCOUNT ON;
UPDATE dbo.Devices SET Mode='AUTO', IsOn=1
WHERE Code='$DeviceCode' AND IsActive=1 AND DeviceType='FAN';
IF @@ROWCOUNT <> 1 THROW 51000, 'Could not prepare actuator baseline.', 1;
"@ | Out-Null
    $fileA = Join-Path $tempDir "session-A.sql"
    @"
SET NOCOUNT ON;
EXEC $procedure @DeviceCode='$DeviceCode', @IsOn=0, @Source='AUTO', @UserId=NULL, @DelaySeconds=5;
"@ | Set-Content -Path $fileA -Encoding UTF8
    $fileB = Join-Path $tempDir "session-B.sql"
    @"
SET NOCOUNT ON;
EXEC $procedure @DeviceCode='$DeviceCode', @IsOn=1, @Source='MANUAL', @UserId=$UserId, @DelaySeconds=0;
"@ | Set-Content -Path $fileB -Encoding UTF8
    Write-Host "`nStarting Session A (AUTO)..."
    $runA = Start-SqlSession $fileA
    Start-Sleep -Seconds 1
    Write-Host "Starting Session B (MANUAL)..."
    $runB = Start-SqlSession $fileB
    $runA.Process.WaitForExit(); $runB.Process.WaitForExit()
    $runA.Stdout.Wait(); $runA.Stderr.Wait(); $runB.Stdout.Wait(); $runB.Stderr.Wait()
    $exitA = [int]$runA.Process.ExitCode
    $exitB = [int]$runB.Process.ExitCode
    $outputA = [string]$runA.Stdout.Result
    $errorA = [string]$runA.Stderr.Result
    $outputB = [string]$runB.Stdout.Result
    $errorB = [string]$runB.Stderr.Result
    Set-Content (Join-Path $tempDir "session-A.out") $outputA
    Set-Content (Join-Path $tempDir "session-A.err") $errorA
    Set-Content (Join-Path $tempDir "session-B.out") $outputB
    Set-Content (Join-Path $tempDir "session-B.err") $errorB
    Write-Host "`n--- Session A: AUTO ---"; Write-Host $outputA
    if ($errorA.Trim()) { Write-Host $errorA -ForegroundColor Red }
    Write-Host "`n--- Session B: MANUAL ---"; Write-Host $outputB
    if ($errorB.Trim()) { Write-Host $errorB -ForegroundColor Red }
    if ($exitA -ne 0 -or $exitB -ne 0) { throw "SQL session failed. See $tempDir" }
    $finalRows = Invoke-Query @"
SET NOCOUNT ON;
SELECT CONCAT(Mode, '|', CONVERT(varchar(1), IsOn))
FROM dbo.Devices WHERE Code='$DeviceCode' AND IsActive=1;
"@
    $finalState = $finalRows | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^(AUTO|MANUAL)\|[01]$' } | Select-Object -First 1
    Write-Host "`nFinal test state: $finalState"
    $expected = if ($Scenario -eq "lost-update-naive") { "AUTO|0" } else { "MANUAL|1" }
    if ($finalState -ne $expected) { throw "Unexpected result. Expected $expected, got $finalState." }
    Write-Host "PASS: Expected state observed ($expected)." -ForegroundColor Green
}
finally {
    foreach ($run in @($runA, $runB)) {
        if ($null -ne $run) { try { if (-not $run.Process.HasExited) { $run.Process.WaitForExit() } } catch {} }
    }
    if ($null -ne $original) {
        $mode = $original[0]; $isOn = [int]$original[1]
        $level = if ($original[2] -eq "NULL") { "NULL" } else { [string][int]$original[2] }
        try {
            Invoke-Query @"
SET NOCOUNT ON;
UPDATE dbo.Devices SET Mode='$mode', IsOn=$isOn, Level=$level WHERE Code='$DeviceCode' AND IsActive=1;
"@ | Out-Null
            Write-Host "`nOriginal actuator state restored." -ForegroundColor Yellow
        } catch { Write-Warning "Could not restore original state: $_" }
    }
    foreach ($run in @($runA, $runB)) { if ($null -ne $run) { $run.Process.Dispose() } }
    Write-Host "Diagnostic logs: $tempDir" -ForegroundColor Yellow
}
