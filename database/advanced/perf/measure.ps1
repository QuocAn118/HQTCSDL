[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('truoc', 'sau')]
    [string]$Phase,

    [string]$Database = 'SwiftletCare_Perf',

    [switch]$Cold,

    [ValidateRange(1, 100)]
    [int]$Runs = 5
)

$ErrorActionPreference = 'Stop'

# ------------------------------------------------------------
# 1. Load library and protect database
# ------------------------------------------------------------

$AdvancedRoot = Split-Path -Parent $PSScriptRoot
$LibPath = Join-Path $AdvancedRoot 'lib.ps1'

if (-not (Test-Path $LibPath)) {
    Write-Host 'FAIL: thieu lib.ps1'
    exit 1
}

. $LibPath

Assert-DbSuffix $Database '_Perf'

$QueryDir = Join-Path $PSScriptRoot 'queries'
$ResultsDir = Join-Path $AdvancedRoot 'results\perf'
$CsvPath = Join-Path $ResultsDir 'timing.csv'

New-Item -ItemType Directory -Force $ResultsDir | Out-Null

# ------------------------------------------------------------
# 2. SQLCMD helper
# ------------------------------------------------------------

function Invoke-SqlcmdCapture {
    param(
        [string]$Query,
        [string]$InputFile
    )

    $sqlArgs = @(
    '-S','tcp:127.0.0.1,1433',
    '-E','-C','-b','-I','-f','65001',
    '-y','0','-Y','0','-w','65535',
    '-d',$Database
)

    if ($InputFile) {
        $sqlArgs += @('-i', $InputFile)
    }
    else {
        $sqlArgs += @('-Q', $Query)
    }

    $output = & sqlcmd @sqlArgs 2>&1
    $exitCode = $LASTEXITCODE
    $outputText = $output | Out-String -Width 65535

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Text = $outputText
    }
}

# ------------------------------------------------------------
# 3. Initialize timing.csv
# ------------------------------------------------------------

$CsvHeader = 'pha,truy_van,lan,lanh_nong,logical_reads,physical_reads,cpu_ms,elapsed_ms'

if (-not (Test-Path $CsvPath)) {
    [System.IO.File]::WriteAllText(
        $CsvPath,
        $CsvHeader + [Environment]::NewLine,
        [System.Text.UTF8Encoding]::new($false)
    )
}
else {
    $existingHeader = (Get-Content $CsvPath -TotalCount 1).Trim()

    if ($existingHeader -ne $CsvHeader) {
        throw "Header timing.csv khong dung: $existingHeader"
    }
}

function Add-TimingRow {
    param(
        [string]$QueryName,
        [int]$Run,
        [string]$Kind,
        [long]$LogicalReads,
        [long]$PhysicalReads,
        [long]$CpuMs,
        [long]$ElapsedMs
    )

    $line = @(
        $Phase,
        $QueryName,
        $Run,
        $Kind,
        $LogicalReads,
        $PhysicalReads,
        $CpuMs,
        $ElapsedMs
    ) -join ','

    [System.IO.File]::AppendAllText(
        $CsvPath,
        $line + [Environment]::NewLine,
        [System.Text.UTF8Encoding]::new($false)
    )
}

# ------------------------------------------------------------
# 4. Cold-run safety guard
# ------------------------------------------------------------

$ColdEnabled = [bool]$Cold

if ($ColdEnabled) {
    $guardSql = @"
SET NOCOUNT ON;

SELECT CONCAT(
    COALESCE(IS_SRVROLEMEMBER('sysadmin'), 0),
    '|',
    (
        SELECT COUNT_BIG(*)
        FROM sys.dm_exec_sessions
        WHERE is_user_process = 1
          AND session_id <> @@SPID
          AND database_id <> DB_ID('SwiftletCare_Perf')
          AND login_name NOT LIKE N'NT SERVICE\%'
    )
);
"@

    $guardResult = Invoke-SqlcmdCapture -Query $guardSql

    if ($guardResult.ExitCode -ne 0) {
        Write-Host 'Bo do lanh: khong kiem tra duoc quyen va session.'
        $ColdEnabled = $false
    }
    else {
        $match = [regex]::Match(
            $guardResult.Text,
            '(?m)^\s*(\d+)\|(\d+)\s*$'
        )

        if (-not $match.Success) {
            Write-Host 'Bo do lanh: khong doc duoc ket qua kiem tra.'
            $ColdEnabled = $false
        }
        else {
            $isSysadmin = [int]$match.Groups[1].Value
            $otherSessions = [long]$match.Groups[2].Value

            if ($isSysadmin -ne 1) {
                Write-Host 'Bo do lanh: tai khoan khong co quyen sysadmin.'
                $ColdEnabled = $false
            }
            elseif ($otherSessions -ne 0) {
                Write-Host "Bo do lanh: dang co $otherSessions session tren database khac SwiftletCare_Perf."
                $ColdEnabled = $false
            }
            else {
                Write-Host 'Cold guard: PASS.'
            }
        }
    }
}

# ------------------------------------------------------------
# 5. Clear cache before each cold measurement
# ------------------------------------------------------------

function Clear-ColdCache {
    $clearSql = @"
SET NOCOUNT ON;

CHECKPOINT;
DBCC DROPCLEANBUFFERS WITH NO_INFOMSGS;

BEGIN TRY
    ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE;
END TRY
BEGIN CATCH
    DBCC FREEPROCCACHE WITH NO_INFOMSGS;
END CATCH;
"@

    $result = Invoke-SqlcmdCapture -Query $clearSql

    if ($result.ExitCode -ne 0) {
        throw "Khong the lam sach cache: $($result.Text)"
    }
}

# ------------------------------------------------------------
# 6. Execute one query and extract statistics / execution plan
# ------------------------------------------------------------

function Invoke-Measurement {
    param(
        [string]$QueryName,
        [string]$SqlFile,
        [bool]$SavePlan
    )

    $queryText = Get-Content -LiteralPath $SqlFile -Raw

    $tempSql = Join-Path $env:TEMP (
        'qtc_measure_{0}_{1}.sql' -f $PID, $QueryName
    )

    $wrappedSql = @"
SET NOCOUNT ON;
SET STATISTICS IO ON;
SET STATISTICS TIME ON;
SET STATISTICS XML ON;

$queryText
"@

    [System.IO.File]::WriteAllText(
        $tempSql,
        $wrappedSql,
        [System.Text.UTF8Encoding]::new($false)
    )

    try {
        $result = Invoke-SqlcmdCapture -InputFile $tempSql

        if ($result.ExitCode -ne 0) {
            $errorText = $result.Text
            if ($errorText.Length -gt 2000) {
                $errorText = $errorText.Substring($errorText.Length - 2000)
            }

            throw "Truy van $QueryName that bai: $errorText"
        }

        # Sum logical and physical reads from all table IO messages.
        $ioMatches = [regex]::Matches(
            $result.Text,
            '(?i)logical reads\s+([\d,]+)\s*,\s*physical reads\s+([\d,]+)'
        )

        if ($ioMatches.Count -eq 0) {
            throw "Khong tach duoc STATISTICS IO cua $QueryName."
        }

        [long]$logicalReads = 0
        [long]$physicalReads = 0

        foreach ($io in $ioMatches) {
            $logicalReads += [long]($io.Groups[1].Value -replace ',', '')
            $physicalReads += [long]($io.Groups[2].Value -replace ',', '')
        }

        # Use the last SQL Server Execution Times block.
        $timeMatches = [regex]::Matches(
            $result.Text,
            '(?is)SQL Server Execution Times:\s*CPU time\s*=\s*([\d,]+)\s*ms,\s*elapsed time\s*=\s*([\d,]+)\s*ms'
        )

        if ($timeMatches.Count -eq 0) {
            throw "Khong tach duoc SQL Server Execution Times cua $QueryName."
        }

        $lastTime = $timeMatches[$timeMatches.Count - 1]

        [long]$cpuMs = [long]($lastTime.Groups[1].Value -replace ',', '')
        [long]$elapsedMs = [long]($lastTime.Groups[2].Value -replace ',', '')

        # Save the real ShowPlanXML from the first measurement.
        if ($SavePlan) {
            $planMatches = [regex]::Matches(
                $result.Text,
                '(?is)<ShowPlanXML\b.*?</ShowPlanXML>'
            )

            if ($planMatches.Count -eq 0) {
                throw "Khong tim thay ShowPlanXML cua $QueryName."
            }

            # Q1/Q2: last plan is the main SensorReadings query.
            # Q3: only the view query.
            # Q4: first plan is the JSON-generation query.
            if ($QueryName -eq 'Q4') {
                $planText = $planMatches[0].Value
            }
            else {
                $planText = $planMatches[$planMatches.Count - 1].Value
            }

            $planPath = Join-Path $ResultsDir "$QueryName-$Phase.sqlplan"

            [System.IO.File]::WriteAllText(
                $planPath,
                $planText,
                [System.Text.UTF8Encoding]::new($false)
            )

            Write-Host "Saved plan: $planPath"
        }

        return [PSCustomObject]@{
            LogicalReads = $logicalReads
            PhysicalReads = $physicalReads
            CpuMs = $cpuMs
            ElapsedMs = $elapsedMs
        }
    }
    finally {
        if (Test-Path $tempSql) {
            Remove-Item $tempSql -Force
        }
    }
}

# ------------------------------------------------------------
# 7. Run Q1-Q4
# ------------------------------------------------------------

Write-Host '=== TASK 10: PERFORMANCE MEASUREMENT ==='
Write-Host "Database: $Database"
Write-Host "Phase: $Phase"
Write-Host "Cold requested: $Cold"
Write-Host "Cold enabled: $ColdEnabled"
Write-Host "Hot runs: $Runs"

$Queries = @('Q1', 'Q2', 'Q3', 'Q4')

foreach ($QueryName in $Queries) {
    $SqlFile = Join-Path $QueryDir "$QueryName.sql"

    if (-not (Test-Path $SqlFile)) {
        throw "Thieu truy van: $SqlFile"
    }

    Write-Host ''
    Write-Host "=== $QueryName ==="

    $planSaved = $false

    # Optional cold measurement.
    if ($ColdEnabled) {
        Write-Host 'Preparing cold cache...'
        Clear-ColdCache

        $coldResult = Invoke-Measurement `
            -QueryName $QueryName `
            -SqlFile $SqlFile `
            -SavePlan $true

        $planSaved = $true

        Add-TimingRow `
            -QueryName $QueryName `
            -Run 0 `
            -Kind 'lanh' `
            -LogicalReads $coldResult.LogicalReads `
            -PhysicalReads $coldResult.PhysicalReads `
            -CpuMs $coldResult.CpuMs `
            -ElapsedMs $coldResult.ElapsedMs

        Write-Host "Cold: logical=$($coldResult.LogicalReads), physical=$($coldResult.PhysicalReads), CPU=$($coldResult.CpuMs) ms, elapsed=$($coldResult.ElapsedMs) ms"
    }

    # One warm-up run is discarded.
    Write-Host 'Warm-up run (discarded)...'

    $null = Invoke-Measurement `
        -QueryName $QueryName `
        -SqlFile $SqlFile `
        -SavePlan (-not $planSaved)

    $planSaved = $true

    # Record the requested number of hot runs.
    for ($run = 1; $run -le $Runs; $run++) {
        $hotResult = Invoke-Measurement `
            -QueryName $QueryName `
            -SqlFile $SqlFile `
            -SavePlan $false

        Add-TimingRow `
            -QueryName $QueryName `
            -Run $run `
            -Kind 'nong' `
            -LogicalReads $hotResult.LogicalReads `
            -PhysicalReads $hotResult.PhysicalReads `
            -CpuMs $hotResult.CpuMs `
            -ElapsedMs $hotResult.ElapsedMs

        Write-Host "Hot $run/$Runs`: logical=$($hotResult.LogicalReads), physical=$($hotResult.PhysicalReads), CPU=$($hotResult.CpuMs) ms, elapsed=$($hotResult.ElapsedMs) ms"
    }
}

Write-Host ''
Write-Host '=== MEASUREMENT COMPLETED ==='
Write-Host "Timing CSV: $CsvPath"
Write-Host "Phase: $Phase"
Write-Host "Queries: 4"
Write-Host "Hot runs per query: $Runs"

if ($ColdEnabled) {
    Write-Host 'Cold runs per query: 1'
}
else {
    Write-Host 'Cold runs: 0'
}

exit 0
