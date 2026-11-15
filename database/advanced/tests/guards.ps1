$ErrorActionPreference = 'Stop'

$AdvancedRoot = Split-Path -Parent $PSScriptRoot
$LibPath = Join-Path $AdvancedRoot 'lib.ps1'
$Fixture = Join-Path $PSScriptRoot 'fixtures\needs-perf.ps1'

if (-not (Test-Path $LibPath)) {
    Write-Host 'FAIL: thieu lib.ps1'
    exit 1
}

if (-not (Test-Path $Fixture)) {
    Write-Host 'FAIL: thieu fixtures\needs-perf.ps1'
    exit 1
}

$cases = @(
    @('SwiftletCare_Perf', 0),
    @('swiftletcare_perf', 0),
    @('SwiftletCare_Performance', 2),
    @('SwiftletCare', 2),
    @('SwiftletCare_Perf_Dev', 2),
    @('x];DROP DATABASE master;--_Perf', 3)
)

$failed = 0

foreach ($case in $cases) {
    $database = $case[0]
    $expected = $case[1]

    & powershell -NoProfile -ExecutionPolicy Bypass -File $Fixture -Database $database
    $actual = $LASTEXITCODE

    if ($actual -eq $expected) {
        Write-Host "PASS: $database (exit $actual)"
    }
    else {
        Write-Host "FAIL: $database (expected $expected, got $actual)"
        $failed++
    }
}

if ($failed -gt 0) {
    Write-Host "guards: FAIL ($failed)"
    exit 1
}

Write-Host 'guards: PASS'
exit 0
