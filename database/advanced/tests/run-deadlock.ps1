param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("deadlock", "deadlock-fixed", "deadlock-retry")]
    [string]$Scenario
)

$ErrorActionPreference = "Stop"

$Server = "tcp:127.0.0.1,1433"
$Database = "SwiftletCare_Perf"
$Root = Split-Path -Parent $PSScriptRoot
$SqlDir = Join-Path $Root "deadlock"
$sqlcmd = (Get-Command sqlcmd.exe -ErrorAction Stop).Source
$tempDir = Join-Path $env:TEMP ("task6-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir | Out-Null

function Start-SqlSession {
    param([string]$SqlFile, [string]$Name)

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $sqlcmd
    $psi.Arguments = "-S `"$Server`" -E -C -d `"$Database`" -l 30 -b -r 1 -i `"$SqlFile`""
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()

    return [PSCustomObject]@{
        Name = $Name
        Process = $process
        Stdout = $process.StandardOutput.ReadToEndAsync()
        Stderr = $process.StandardError.ReadToEndAsync()
    }
}

function Invoke-SqlFile {
    param([string]$Path)

    & $sqlcmd -S $Server -E -C -d $Database -l 30 -b -i $Path
    if ($LASTEXITCODE -ne 0) {
        throw "SQL setup failed: $Path"
    }
}

$runA = $null
$runB = $null

try {
    Write-Host "===== $Scenario =====" -ForegroundColor Cyan
    Write-Host "Database: $Database"

    # Prepare only the dedicated demo table and retry procedure.
    Invoke-SqlFile (Join-Path $SqlDir "setup.sql")

    # Reset demo values before each scenario.
    & $sqlcmd -S $Server -E -C -d $Database -l 30 -b -Q @"
UPDATE dbo.DeadlockDemoRows SET Value = 0 WHERE Id IN (1, 2);
"@
    if ($LASTEXITCODE -ne 0) { throw "Could not reset demo rows." }

    switch ($Scenario) {
        "deadlock" {
            $fileA = Join-Path $SqlDir "deadlock-session-a.sql"
            $fileB = Join-Path $SqlDir "deadlock-session-b.sql"
        }
        "deadlock-fixed" {
            $fileA = Join-Path $SqlDir "fixed-session-a.sql"
            $fileB = Join-Path $SqlDir "fixed-session-b.sql"
        }
        "deadlock-retry" {
            $fileA = Join-Path $SqlDir "retry-session-a.sql"
            $fileB = Join-Path $SqlDir "retry-session-b.sql"
        }
    }

    Write-Host "Starting Session A..."
    $runA = Start-SqlSession $fileA "A"

    Start-Sleep -Milliseconds 500

    Write-Host "Starting Session B..."
    $runB = Start-SqlSession $fileB "B"

    $runA.Process.WaitForExit()
    $runB.Process.WaitForExit()

    $runA.Stdout.Wait()
    $runA.Stderr.Wait()
    $runB.Stdout.Wait()
    $runB.Stderr.Wait()

    $exitA = [int]$runA.Process.ExitCode
    $exitB = [int]$runB.Process.ExitCode
    $outA = [string]$runA.Stdout.Result
    $errA = [string]$runA.Stderr.Result
    $outB = [string]$runB.Stdout.Result
    $errB = [string]$runB.Stderr.Result

    Set-Content (Join-Path $tempDir "session-A.out") $outA
    Set-Content (Join-Path $tempDir "session-A.err") $errA
    Set-Content (Join-Path $tempDir "session-B.out") $outB
    Set-Content (Join-Path $tempDir "session-B.err") $errB

    Write-Host "`n--- Session A ---"
    Write-Host $outA
    if ($errA.Trim()) { Write-Host $errA -ForegroundColor Red }

    Write-Host "`n--- Session B ---"
    Write-Host $outB
    if ($errB.Trim()) { Write-Host $errB -ForegroundColor Red }

    Write-Host "`nExit codes: A=$exitA, B=$exitB"

    switch ($Scenario) {
        "deadlock" {
            $hasVictim = (($exitA -ne 0) -and (($errA + $outA) -match "1205")) -or
                         (($exitB -ne 0) -and (($errB + $outB) -match "1205"))
            $oneSucceeded = (($exitA -eq 0) -and ($exitB -ne 0)) -or
                            (($exitB -eq 0) -and ($exitA -ne 0))

            if (-not ($hasVictim -and $oneSucceeded)) {
                throw "Expected one session to be chosen as deadlock victim (error 1205)."
            }
            Write-Host "PASS: Deadlock reproduced; one session was the victim." -ForegroundColor Green
        }
        "deadlock-fixed" {
            if ($exitA -ne 0 -or $exitB -ne 0) {
                throw "Expected both sessions to complete without deadlock."
            }
            Write-Host "PASS: Both sessions completed with a consistent lock order." -ForegroundColor Green
        }
        "deadlock-retry" {
            if ($exitA -ne 0 -or $exitB -ne 0) {
                throw "Expected both transactions to complete using retry."
            }
            $combinedOutput = $outA + $errA + $outB + $errB

            if (($combinedOutput -notmatch "Transaction completed") -or
                (($exitA -ne 0) -or ($exitB -ne 0))) {
                throw "Retry procedure did not report successful completion."
            }
            Write-Host "PASS: Both transactions completed using retry handling." -ForegroundColor Green
        }
    }

    Write-Host "`nFinal demo rows:"
    & $sqlcmd -S $Server -E -C -d $Database -l 30 -Q "
        SET NOCOUNT ON;
        SELECT Id, Value FROM dbo.DeadlockDemoRows ORDER BY Id;
    "

    if ($LASTEXITCODE -ne 0) { throw "Could not read final demo rows." }
}
finally {
    foreach ($run in @($runA, $runB)) {
        if ($null -ne $run) {
            try {
                if (-not $run.Process.HasExited) { $run.Process.WaitForExit() }
            } catch {}
            $run.Process.Dispose()
        }
    }
    Write-Host "`nDiagnostic logs: $tempDir" -ForegroundColor Yellow
}

