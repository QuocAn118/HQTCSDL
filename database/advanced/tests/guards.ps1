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

# Task 8: Point-in-Time Recovery (PITR)
$BackupDir = Join-Path $AdvancedRoot 'backup'
$PitrDemo = Join-Path $BackupDir 'pitr-demo.ps1'
$RestorePitr = Join-Path $BackupDir 'restore-pitr.ps1'
$BackupReport = Join-Path $AdvancedRoot 'results\backup.md'
$Readme = Join-Path $AdvancedRoot 'README.md'

foreach ($path in @(
    $PitrDemo,
    $RestorePitr,
    $BackupReport
)) {
    if (Test-Path $path) {
        Write-Host "PASS: $(Split-Path $path -Leaf)"
    }
    else {
        Write-Host "FAIL: thieu $path"
        $failed++
    }
}

if (Test-Path $Readme) {
    $readmeContent = Get-Content $Readme -Raw

    if ($readmeContent -match '(?m)^## 12\.\s+Point-in-Time Recovery \(PITR\)') {
        Write-Host 'PASS: README Task 8'
    }
    else {
        Write-Host 'FAIL: README thieu muc Task 8'
        $failed++
    }
}
else {
    Write-Host 'FAIL: thieu README.md'
    $failed++
}

# Task 8: Database suffix guards
if (Test-Path $PitrDemo) {
    $null = & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File $PitrDemo -Target SwiftletCare 2>&1
    $actual = $LASTEXITCODE

    if ($actual -eq 2) {
        Write-Host 'PASS: PITR target suffix guard'
    }
    else {
        Write-Host "FAIL: PITR target suffix guard (expected 2, got $actual)"
        $failed++
    }

    $null = & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File $PitrDemo `
        -Source SwiftletCare `
        -Target SwiftletCare_Restore 2>&1
    $actual = $LASTEXITCODE

    if ($actual -eq 2) {
        Write-Host 'PASS: PITR source suffix guard'
    }
    else {
        Write-Host "FAIL: PITR source suffix guard (expected 2, got $actual)"
        $failed++
    }
}

if (Test-Path $RestorePitr) {
    $null = & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File $RestorePitr `
        -Target SwiftletCare_Dev `
        -Full 'C:\dummy.bak' `
        -Log 'C:\dummy.trn' `
        -StopAtLocal '2026-11-17T17:08:02.810' 2>&1
    $actual = $LASTEXITCODE

    if ($actual -eq 2) {
        Write-Host 'PASS: restore target suffix guard'
    }
    else {
        Write-Host "FAIL: restore target suffix guard (expected 2, got $actual)"
        $failed++
    }
}

# Task 10: INCLUDE performance guards
$PerfRoot = Join-Path $AdvancedRoot 'perf'
$PerfQueries = Join-Path $PerfRoot 'queries'
$PerfResults = Join-Path $AdvancedRoot 'results\perf'
$MeasureScript = Join-Path $PerfRoot 'measure.ps1'
$TimingCsv = Join-Path $PerfResults 'timing.csv'

# Required measurement script and query files
foreach ($path in @(
    $MeasureScript,
    (Join-Path $PerfQueries 'Q1.sql'),
    (Join-Path $PerfQueries 'Q2.sql'),
    (Join-Path $PerfQueries 'Q3.sql'),
    (Join-Path $PerfQueries 'Q4.sql')
)) {
    if (Test-Path $path) {
        Write-Host "PASS: Task 10 file $(Split-Path $path -Leaf)"
    }
    else {
        Write-Host "FAIL: Task 10 thieu $path"
        $failed++
    }
}

# Required execution plans before and after INCLUDE
foreach ($query in @('Q1', 'Q2', 'Q3', 'Q4')) {
    foreach ($phase in @('truoc', 'sau')) {
        $plan = Join-Path $PerfResults "$query-$phase.sqlplan"

        if (Test-Path $plan) {
            Write-Host "PASS: execution plan $query-$phase"
        }
        else {
            Write-Host "FAIL: thieu execution plan $query-$phase"
            $failed++
        }
    }
}

# Timing CSV structure (timing.csv co the co them lan do lai, xem perf.md)
if (-not (Test-Path $TimingCsv)) {
    Write-Host 'FAIL: thieu timing.csv'
    $failed++
}
else {
    try {
        $timingRows = @(Import-Csv $TimingCsv -ErrorAction Stop)
        $requiredColumns = @(
            'pha',
            'truy_van',
            'lan',
            'lanh_nong',
            'logical_reads',
            'physical_reads',
            'cpu_ms',
            'elapsed_ms'
        )

        $actualColumns = @($timingRows[0].PSObject.Properties.Name)

        foreach ($column in $requiredColumns) {
            if ($actualColumns -contains $column) {
                Write-Host "PASS: timing.csv column $column"
            }
            else {
                Write-Host "FAIL: timing.csv thieu cot $column"
                $failed++
            }
        }
    }
    catch {
        Write-Host "FAIL: khong doc duoc timing.csv - $($_.Exception.Message)"
        $failed++
    }
}

# Task 10: README documentation
if (Test-Path $Readme) {
    $readmeContent = Get-Content $Readme -Raw

    if ($readmeContent -match '(?im)^## .*Task 10|(?im)^## .*INCLUDE') {
        Write-Host 'PASS: README Task 10'
    }
    else {
        Write-Host 'FAIL: README chua co muc Task 10 / INCLUDE'
        $failed++
    }
}
if ($failed -gt 0) {
    Write-Host "guards: FAIL ($failed)"
    exit 1
}

Write-Host 'guards: PASS'
exit 0

