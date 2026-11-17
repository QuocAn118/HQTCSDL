
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("lost-update-naive", "lost-update-safe")]
    [string]$Scenario
)

$ErrorActionPreference = "Stop"

$Server = "tcp:127.0.0.1,1433"
$Database = "SwiftletCare_Perf"
$DeviceCode = "H1-F1-FAN"
$UserId = 2

$sqlcmd = (Get-Command sqlcmd.exe -ErrorAction Stop).Source
$tempDir = Join-Path $env:TEMP ("task5-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

$procedure = if ($Scenario -eq "lost-update-naive") {
    "dbo.sp_SetActuatorNaive"
} else {
    "dbo.sp_SetActuatorSafe"
}

$original = $null
$runA = $null
$runB = $null

function Invoke-Query {
    param([string]$Query)

    $result = & $sqlcmd -S $Server -E -C -d $Database `
        -l 30 -b -h -1 -W -s "|" -Q $Query

    $exitCode = $LASTEXITCODE

    if ($exitCode -ne 0) {
        throw "SQL query failed with exit code $exitCode."
    }

    return $result
}

function Start-SqlSession {
    param([string]$SqlFile)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $sqlcmd
    $psi.Arguments = "-S `"$Server`" -E -C -d `"$Database`" -l 30 -b -i `"$SqlFile`""
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    [void]$process.Start()

    # Read both streams asynchronously to avoid blocking the process.
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()

    return [PSCustomObject]@{
        Process = $process
        Stdout  = $stdoutTask
        Stderr  = $stderrTask
    }
}

try {
    Write-Host "===== $Scenario =====" -ForegroundColor Cyan
    Write-Host "Database: $Database"
    Write-Host "Device: $DeviceCode"
    Write-Host "Procedure: $procedure"

    # 1. Save original actuator state.
    $stateRows = Invoke-Query @"
SET NOCOUNT ON;
SELECT CONCAT(
    Mode, '|',
    CONVERT(varchar(1), IsOn), '|',
    COALESCE(CONVERT(varchar(3), Level), 'NULL')
)
FROM dbo.Devices
WHERE Code = '$DeviceCode'
  AND IsActive = 1
  AND DeviceType = 'FAN';
"@

    $stateLine = $stateRows |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -match '^(AUTO|MANUAL)\|[01]\|' } |
        Select-Object -First 1

    if (-not $stateLine) {
        throw "Cannot find active device $DeviceCode."
    }

    $original = $stateLine.Split("|")
    Write-Host "Original state: $stateLine"

    # 2. Establish a known AUTO baseline.
    Invoke-Query @"
SET NOCOUNT ON;
UPDATE dbo.Devices
SET Mode = 'AUTO', IsOn = 1
WHERE Code = '$DeviceCode'
  AND IsActive = 1
  AND DeviceType = 'FAN';

IF @@ROWCOUNT <> 1
    THROW 51000, 'Could not prepare actuator baseline.', 1;
"@ | Out-Null

    # 3. Prepare Session A: AUTO turns OFF after a 5-second delay.
    $fileA = Join-Path $tempDir "session-A.sql"

    @"
SET NOCOUNT ON;
EXEC $procedure
    @DeviceCode = '$DeviceCode',
    @IsOn = 0,
    @Source = 'AUTO',
    @UserId = NULL,
    @DelaySeconds = 5;
"@ | Set-Content -Path $fileA -Encoding UTF8

    # 4. Prepare Session B: MANUAL turns ON.
    $fileB = Join-Path $tempDir "session-B.sql"

    @"
SET NOCOUNT ON;
EXEC $procedure
    @DeviceCode = '$DeviceCode',
    @IsOn = 1,
    @Source = 'MANUAL',
    @UserId = $UserId,
    @DelaySeconds = 0;
"@ | Set-Content -Path $fileB -Encoding UTF8

    # 5. Launch two independent SQL processes.
    Write-Host "`nStarting Session A (AUTO)..."
    $runA = Start-SqlSession $fileA

    Start-Sleep -Seconds 1

    Write-Host "Starting Session B (MANUAL)..."
    $runB = Start-SqlSession $fileB

    # 6. Wait for both sessions.
    $runA.Process.WaitForExit()
    $runB.Process.WaitForExit()

    $runA.Stdout.Wait()
    $runA.Stderr.Wait()
    $runB.Stdout.Wait()
    $runB.Stderr.Wait()

    $exitA = [int]$runA.Process.ExitCode
    $exitB = [int]$runB.Process.ExitCode

    $outputA = [string]$runA.Stdout.Result
    $errorA = [string]$runA.Stderr.Result
    $outputB = [string]$runB.Stdout.Result
    $errorB = [string]$runB.Stderr.Result

    # 7. Preserve diagnostic output.
    Set-Content -Path (Join-Path $tempDir "session-A.out") -Value $outputA
    Set-Content -Path (Join-Path $tempDir "session-A.err") -Value $errorA
    Set-Content -Path (Join-Path $tempDir "session-B.out") -Value $outputB
    Set-Content -Path (Join-Path $tempDir "session-B.err") -Value $errorB

    Write-Host "`n--- Session A: AUTO ---"
    Write-Host $outputA
    if ($errorA.Trim()) {
        Write-Host $errorA -ForegroundColor Red
    }

    Write-Host "`n--- Session B: MANUAL ---"
    Write-Host $outputB
    if ($errorB.Trim()) {
        Write-Host $errorB -ForegroundColor Red
    }

    Write-Host "`nProcess exit codes: Session A=$exitA, Session B=$exitB"

    if ($exitA -ne 0 -or $exitB -ne 0) {
        throw "SQL session failed. See diagnostic logs in $tempDir"
    }

    # 8. Check final state.
    $finalRows = Invoke-Query @"
SET NOCOUNT ON;
SELECT CONCAT(Mode, '|', CONVERT(varchar(1), IsOn))
FROM dbo.Devices
WHERE Code = '$DeviceCode'
  AND IsActive = 1;
"@

    $finalState = $finalRows |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_ -match '^(AUTO|MANUAL)\|[01]$' } |
        Select-Object -First 1

    Write-Host "`nFinal test state: $finalState"

    $expected = if ($Scenario -eq "lost-update-naive") {
        "AUTO|0"
    } else {
        "MANUAL|1"
    }

    if ($finalState -ne $expected) {
        throw "Unexpected result. Expected $expected, got $finalState."
    }

    Write-Host "PASS: Expected state observed ($expected)." -ForegroundColor Green
}
finally {
    # 9. Ensure processes have ended.
    foreach ($run in @($runA, $runB)) {
        if ($null -ne $run) {
            try {
                if (-not $run.Process.HasExited) {
                    $run.Process.WaitForExit()
                }
            } catch {}
        }
    }

    # 10. Restore original device state.
    if ($null -ne $original) {
        $mode = $original[0]
        $isOn = [int]$original[1]

        $level = if ($original[2] -eq "NULL") {
            "NULL"
        } else {
            [string][int]$original[2]
        }

        try {
            Invoke-Query @"
SET NOCOUNT ON;
UPDATE dbo.Devices
SET Mode = '$mode',
    IsOn = $isOn,
    Level = $level
WHERE Code = '$DeviceCode'
  AND IsActive = 1;
"@ | Out-Null

            Write-Host "`nOriginal actuator state restored." -ForegroundColor Yellow
        } catch {
            Write-Warning "Could not restore original state: $_"
        }
    }

    Write-Host "Diagnostic logs: $tempDir" -ForegroundColor Yellow

    foreach ($run in @($runA, $runB)) {
        if ($null -ne $run) {
            $run.Process.Dispose()
        }
    }
}
