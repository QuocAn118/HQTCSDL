$ErrorActionPreference = 'Stop'

$AdvancedRoot = Split-Path -Parent $PSScriptRoot
$LibPath = Join-Path $AdvancedRoot 'lib.ps1'
$Fixture = Join-Path $PSScriptRoot 'fixtures\needs-perf.ps1'
$DemoProcs = Join-Path $AdvancedRoot 'concurrency\demo-procs.sql'
$Runner = Join-Path $PSScriptRoot 'run-two-sessions.ps1'

if (-not (Test-Path $LibPath)) {
    Write-Host 'FAIL: thieu lib.ps1'
    exit 1
}

if (-not (Test-Path $Fixture)) {
    Write-Host 'FAIL: thieu fixtures\needs-perf.ps1'
    exit 1
}

$failed = 0

# Task 2: Database suffix guards
$cases = @(
    @('SwiftletCare_Perf', 0),
    @('swiftletcare_perf', 0),
    @('SwiftletCare_Performance', 2),
    @('SwiftletCare', 2),
    @('SwiftletCare_Perf_Dev', 2),
    @('x];DROP DATABASE master;--_Perf', 3)
)

foreach ($case in $cases) {
    $database = $case[0]
    $expected = $case[1]

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Fixture -Database $database
    $actual = $LASTEXITCODE

    if ($actual -eq $expected) {
        Write-Host "PASS: $database (exit $actual)"
    }
    else {
        Write-Host "FAIL: $database (expected $expected, got $actual)"
        $failed++
    }
}

# Task 5: Concurrency files
if (-not (Test-Path $DemoProcs)) {
    Write-Host 'FAIL: thieu concurrency\demo-procs.sql'
    $failed++
}
else {
    $sql = Get-Content $DemoProcs -Raw

    foreach ($procedure in @(
        'sp_SetActuatorNaive',
        'sp_SetActuatorSafe'
    )) {
        if ($sql -match [regex]::Escape($procedure)) {
            Write-Host "PASS: $procedure"
        }
        else {
            Write-Host "FAIL: thieu $procedure trong demo-procs.sql"
            $failed++
        }
    }

    if ($sql -match 'DemoLog') {
        Write-Host 'PASS: DemoLog logging'
    }
    else {
        Write-Host 'FAIL: demo-procs.sql chua co DemoLog'
        $failed++
    }
}

if (-not (Test-Path $Runner)) {
    Write-Host 'FAIL: thieu run-two-sessions.ps1'
    $failed++
}
else {
    $runnerContent = Get-Content $Runner -Raw

    foreach ($scenario in @(
        'lost-update-naive',
        'lost-update-safe'
    )) {
        if ($runnerContent -match [regex]::Escape($scenario)) {
            Write-Host "PASS: runner scenario $scenario"
        }
        else {
            Write-Host "FAIL: runner thieu scenario $scenario"
            $failed++
        }
    }
}

if ($failed -gt 0) {
    Write-Host "guards: FAIL ($failed)"
    exit 1
}

Write-Host 'guards: PASS'
exit 0
