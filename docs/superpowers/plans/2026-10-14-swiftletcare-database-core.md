# SwiftletCare database-core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Người thực thi:** TV1, theo cách Native (`superpowers:executing-plans`) trên máy mình — không dùng subagent-driven.

## Trước khi chạy

Chạy trong PowerShell, mọi lệnh phải đạt trước khi bắt đầu Task 1:

```powershell
sqlcmd -?                 # có sẵn (bản 17 trở lên); không có -> cài "Microsoft Command Line Utilities for SQL Server"
node -v                   # Prisma 7.10.0 yêu cầu ^20.19 || ^22.12 || >=24.0
npm view prisma@7.10.0 version   # phải in 7.10.0
```

- Nếu Prisma báo lỗi về phiên bản Node (lúc `npm install` hoặc `npx prisma …`), cài Node **LTS** (hiện là 24.x) rồi chạy lại; không hạ Prisma.
- Không cài Prisma không ghi phiên bản: `latest` trên npm đang là bản thử nghiệm 8.0.0-rc (kiểm ngày 14/10/2026).

## Mốc 20/10

- Mốc 20/10 gồm **Task 1–6**: backend (TV2) và simulator (TV5) nối được vào `sp_IngestReadings` và `sp_SetActuator`.
- **Nếu hết 17/10 mà Task 4–5 chưa xong**, TV1 báo nhóm và chuyển phần còn lại cho người hỗ trợ làm tiếp (roadmap: người hỗ trợ chuyển sang giúp module đang chậm), để mốc 20/10 không trễ.

**Goal:** Dựng package `database/` gồm schema SQL Server (Prisma 7 migrate), các SP/trigger/view nghiệp vụ, dữ liệu mẫu cố định và bộ test T-SQL chạy bằng `npm test`, đúng spec database-core.

**Architecture:** Bảng do `prisma/schema.prisma` định nghĩa; phần Prisma không biểu diễn được (CHECK, chỉ mục lọc, khóa ngoại ghép) viết tay trong migration hoặc `sql/00-schema-extras/` tùy kết quả kiểm chứng R2/R5. SP/trigger/view là file `CREATE OR ALTER` trong `sql/`, `scripts/deploy.ps1` chạy theo thứ tự: migrate deploy → extras → views → procs → triggers → seed. Test là script T-SQL, mỗi ca một transaction ROLLBACK, chạy trên `SwiftletCare_Test` tạo lại mỗi lần.

**Tech Stack:** SQL Server Express (≥ 2016 SP1, máy hiện có 2025), T-SQL, Prisma **7.10.0** + `@prisma/adapter-mssql` **7.10.0**, Node.js 25, PowerShell 5.1, `sqlcmd`.

**Spec:** [docs/superpowers/specs/2026-10-12-swiftletcare-database-core-design.md](../specs/2026-10-12-swiftletcare-database-core-design.md) · hợp đồng liên quan: [integration-contract](../specs/2026-10-13-swiftletcare-integration-contract-design.md)

## Global Constraints

- CSDL: `SwiftletCare_Dev` (phát triển), `SwiftletCare_Test` (test, tạo lại mỗi lần), `SwiftletCare` (demo, không bao giờ reset).
- `deploy.ps1 -Reset` chỉ chạy khi tên CSDL kết thúc `_Test` hoặc `_Dev` (không phân biệt hoa thường); tên khác → thoát mã khác 0 trước khi gửi lệnh SQL nào; không có cờ bỏ qua.
- Phiên bản SQL Server `SERVERPROPERTY('ProductVersion')` ≥ 13.0.4001; `compatibility_level` ≥ 130; `deploy.ps1` tự kiểm tra và dừng nếu không đạt.
- **Cấm** `GREATEST`, `LEAST`, `DATE_BUCKET`, `DATETRUNC`, `GENERATE_SERIES`, `STRING_SPLIT(…, enable_ordinal)`. Dùng `CASE WHEN`, `DATEADD`/`DATEDIFF`, bảng số bằng `CROSS JOIN`.
- Thời gian: `DATETIME2(0)` UTC; mặc định `@default(dbgenerated("sysutcdatetime()"))`; SP/trigger dùng `SYSUTCDATETIME()`, không `GETDATE()`/`SYSDATETIME()`. Ngày giờ Việt Nam: `AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time'`; lọc theo ngày Việt Nam thì đổi mốc sang UTC rồi so trực tiếp với cột (SARGable).
- Mỗi SP: `SET NOCOUNT ON; SET XACT_ABORT ON;`, trả **đúng 1 tập kết quả**; `FOR JSON` chỉ trong truy vấn con thành một cột, luôn `FOR JSON PATH, INCLUDE_NULL_VALUES`; thời gian trong JSON `CONCAT(CONVERT(CHAR(19), col, 126), 'Z')`.
- Danh sách trường cảnh báo trong JSON (14 khóa, đúng thứ tự): `AlertId, HouseId, ZoneId, DeviceId, AlertType, Severity, MetricCode, Value, DetectedClass, Confidence, HasSnapshot, Message, Status, CreatedAt`.
- SP hệ thống (`sp_IngestReadings`, `sp_CreatePredatorAlert`, `sp_DetectAnomalies`, `sp_RecordHeartbeat`) đặt `SESSION_CONTEXT` `UserId`/`Note` = NULL trước khi ghi `Alerts`.
- Mã lỗi: 50001 Source sai; 50002 MANUAL thiếu UserId; 50003 thiết bị không điều khiển được; 50010 camera không hợp lệ; 50012 số đếm âm; 50013 loài lạ; 50014 windowStart sai mốc; 50020 cảnh báo không tồn tại; 50021 chuyển trạng thái sai; 50030 JSON sai; 50040 BucketMinutes ≤ 0; 50041 From ≥ To; 50042 tham số ngoài miền.
- Khóa ngoại `NO ACTION`; ngừng dùng bằng `IsActive = 0`.
- Khóa lộ ra API là INT; chỉ `SensorReadings.ReadingId` là BIGINT.
- Dữ liệu mẫu cố định (không `RAND()`/`NEWID()`), neo `@AnchorDateVn` mặc định `2026-10-12`, kết thúc 20:00 giờ Việt Nam ngày neo.
- Mật khẩu dev ghi trong README database (`database/README.md`, Task 13); seed chỉ chứa hash bcrypt `$2a$10$M/DxgzTqClpNLyz2TDREfuIq8x2OHTobFhaeNPRbb4wfw.xhCp05K` (đã kiểm `compareSync = true`). README ghi rõ chỉ dùng phát triển.
- `.env` không commit; chỉ commit `.env.example`.
- Commit message tiếng Việt, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **JSON đầu vào sai kiểu từng phần tử** (VD `"value":"abc"`, `"value":null`, thiếu khóa `metric`) — người dùng mong phần tử đó bị tính vào `Rejected`, cả lô không lỗi. Test thêm ở Task 4.
2. **Một lô có hai số đo cùng (khu vực, chỉ số) khác thời điểm** — chỉ số đo mới nhất quyết định mở/đóng cảnh báo, không phụ thuộc thứ tự trong mảng. Test thêm ở Task 4.
3. **`@Level` ngoài 0–100 trong `sp_SetActuator`** — mong lỗi ràng buộc 547 và không có dòng ControlLogs nào được ghi. Test thêm ở Task 5.
4. **Ghi chú tiếng Việt có dấu** (`N'Đã kiểm tra'`) đi qua `SESSION_CONTEXT` vào `AlertHistory.Note` — mong giữ nguyên dấu. Test thêm ở Task 7.
5. **Khoảng lịch sử không có dữ liệu** trong `sp_GetReadingHistory` — mong 0 dòng, không lỗi. Test thêm ở Task 8.

## Cấu trúc file

```
database/
  package.json                 # scripts: deploy, test; pin prisma 7.10.0
  prisma.config.ts             # Prisma 7: đường dẫn schema/migrations, DATABASE_URL
  prisma/schema.prisma         # 12 bảng (+ NestLogs nếu làm Nên có)
  prisma/migrations/<ts>_init/migration.sql   # Prisma sinh + SQL viết tay (CHECK, …)
  sql/00-schema-extras/        # chỉ dùng nếu R2/R5 buộc đưa SQL tay ra khỏi migration
  sql/01-views/                # vw_*.sql
  sql/02-functions-procs/      # sp_*.sql
  sql/03-triggers/             # trg_*.sql
  sql/seed/                    # 01-reference.sql, 02-readings.sql, 03-birdcounts.sql, 04-alerts.sql, 90-harvests.sql
  tests/                       # *.test.sql, deploy-guard.ps1
  scripts/deploy.ps1           # triển khai một CSDL
  scripts/test.ps1             # npm test: reset _Test, guard test, chạy *.test.sql
  scripts/lib.ps1              # đọc .env, dựng chuỗi kết nối, gọi sqlcmd
  spikes/                      # script kiểm chứng R1, R6 (giữ lại làm bằng chứng)
  .env.example
  README.md
.gitignore                     # thêm database/.env, database/node_modules, database/generated
```

## Quy ước viết test (mọi task dùng)

Mỗi file `tests/*.test.sql` bắt đầu bằng:

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
```

**Ca thành công** — một batch, một transaction, luôn ROLLBACK:

```sql
PRINT N'<tên ca>';
BEGIN TRY
    BEGIN TRAN;
    -- chuẩn bị, EXEC, kiểm tra:
    IF (<điều kiện sai>) THROW 59999, N'<tên ca>: <mô tả lỗi>', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO
```

**Ca mong đợi lỗi** — bắt lỗi, ROLLBACK, rồi mới kiểm số lỗi:

```sql
PRINT N'<tên ca>';
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.<sp> ...;
    THROW 59999, N'<tên ca>: mong đợi lỗi 500xx nhưng không có lỗi', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 500xx THROW;
END CATCH
GO
```

- Đọc kết quả SP bằng `INSERT INTO #r EXEC dbo.<sp> …` với `#r` khai báo đủ cột đúng thứ tự.
- Không hard-code id; tra id theo mã: `SELECT @dev = DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-SENSOR'`.
- Mốc thời gian của test dùng `SYSUTCDATETIME()` (sau dữ liệu mẫu, không trùng seed).
- `sqlcmd -b` làm lỗi chưa bắt (`THROW`) trả mã thoát khác 0.
- `sqlcmd` luôn chạy với `-I` (QUOTED_IDENTIFIER ON — bắt buộc khi tạo SP/trigger ghi vào bảng có chỉ mục lọc, giá trị này được lưu cùng SP) và `-f 65001` (đọc file UTF-8 có tiếng Việt).
- File `.ps1` chỉ dùng **chữ ASCII không dấu** trong chuỗi và chú thích: PowerShell 5.1 đọc file không BOM theo bảng mã ANSI, tiếng Việt có dấu sẽ hỏng.

---

### Task 1: Khung package, deploy.ps1 có chặn reset, npm test

**Files:**
- Create: `database/package.json`, `database/prisma.config.ts`, `database/prisma/schema.prisma` (tạm, chỉ generator + datasource), `database/.env.example`, `database/scripts/lib.ps1`, `database/scripts/deploy.ps1`, `database/scripts/test.ps1`, `database/tests/deploy-guard.ps1`
- Modify: `.gitignore` (tạo mới nếu chưa có)

**Interfaces:**
- Produces: `scripts/deploy.ps1 -Database <tên> [-Reset] [-AnchorDateVn yyyy-MM-dd] [-SkipSeed]`; thoát mã **2** khi từ chối reset, **3** khi tên CSDL chứa ký tự ngoài `[A-Za-z0-9_]`. `scripts/lib.ps1` cung cấp `Read-DotEnv`, `Get-DatabaseUrl $cfg $db`, `Invoke-Sql -Cfg -Database (-File|-Query) [-Variables]`, `Get-SqlScalar $cfg $db $query`. `npm test` chạy toàn bộ.

- [ ] **Step 1: Thiết lập môi trường theo checklist spec (một lần mỗi máy)**

Làm đủ 8 bước checklist ở spec Phần 1 (Mixed Mode, TCP/IP 1433, login `swiftlet_dev` có `dbcreator`). Tạo login bằng SSMS hoặc `sqlcmd -E` (Windows auth):

```sql
CREATE LOGIN swiftlet_dev WITH PASSWORD = N'<mat khau dev>', CHECK_POLICY = ON;
ALTER SERVER ROLE dbcreator ADD MEMBER swiftlet_dev;
```

Kiểm tra: `sqlcmd -S localhost,1433 -U swiftlet_dev -P <mat khau> -Q "SELECT @@VERSION"` in ra phiên bản. CSDL do `swiftlet_dev` tạo (qua `deploy.ps1`) thì login này là chủ sở hữu, đủ quyền xóa/tạo lại.

- [ ] **Step 2: Tạo `.gitignore` ở gốc repo**

```gitignore
database/.env
database/node_modules/
database/generated/
infra/mosquitto/passwd
infra/mosquitto/data/
backend/storage/
```

- [ ] **Step 3: Tạo `database/package.json`**

```json
{
  "name": "swiftletcare-database",
  "private": true,
  "type": "module",
  "scripts": {
    "deploy:dev": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Database SwiftletCare_Dev",
    "reset:dev": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy.ps1 -Database SwiftletCare_Dev -Reset",
    "test": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test.ps1"
  },
  "dependencies": {
    "@prisma/adapter-mssql": "7.10.0",
    "@prisma/client": "7.10.0"
  },
  "devDependencies": {
    "dotenv": "16.4.5",
    "prisma": "7.10.0",
    "tsx": "4.19.2"
  }
}
```

Chạy `cd database; npm install`. Kiểm tra `npx prisma --version` in `prisma : 7.10.0`.

- [ ] **Step 4: Tạo `database/prisma.config.ts` và schema tạm**

```ts
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// DATABASE_URL do deploy.ps1 dat cho tung CSDL; dotenv khong ghi de bien da co.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

`database/prisma/schema.prisma` (tạm, Task 2 thêm model):

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "sqlserver"
}
```

Nếu `npx prisma validate` báo lỗi cú pháp `prisma.config.ts`/`datasource` (Prisma đổi API giữa các bản 7.x), đối chiếu tài liệu Prisma 7.10 "prisma.config.ts reference" và sửa đúng tên khóa; không đổi phiên bản Prisma.

- [ ] **Step 5: Tạo `database/.env.example`, sao chép thành `.env` và điền mật khẩu**

```dotenv
DB_SERVER=localhost
DB_PORT=1433
DB_USER=swiftlet_dev
DB_PASSWORD=
# Prisma CLI (migrate dev/diff) tro vao CSDL phat trien. Mat khau dat trong {} de chua duoc ky tu dac biet.
DATABASE_URL="sqlserver://localhost:1433;database=SwiftletCare_Dev;user=swiftlet_dev;password={<mat khau>};trustServerCertificate=true"
# R6: backend cau hinh @prisma/adapter-mssql voi options.useUTC = true co dinh trong code
# (khong phai bien moi truong) de DATETIME2 duoc hieu la UTC. Xem spec database-core R6.
```

- [ ] **Step 6: Viết test chặn reset (chưa có deploy.ps1 → phải fail)**

`database/tests/deploy-guard.ps1`:

```powershell
$ErrorActionPreference = 'Stop'
$deploy = Join-Path $PSScriptRoot '..\scripts\deploy.ps1'
if (-not (Test-Path $deploy)) { Write-Host 'FAIL: chua co scripts/deploy.ps1'; exit 1 }

# Moi ten khong ket thuc _Test/_Dev phai bi tu choi voi ma 2, truoc khi doc .env hay goi SQL.
foreach ($name in @('SwiftletCare', 'SwiftletCare_Prod', 'Test', 'master', 'SwiftletCare_Testing')) {
    $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $deploy -Database $name -Reset 2>&1
    if ($LASTEXITCODE -ne 2) { Write-Host "FAIL: -Reset voi '$name' tra ma $LASTEXITCODE (mong 2). $out"; exit 1 }
}

# Ten chua ky tu la bi tu choi voi ma 3 (chong chen SQL vao ten CSDL).
$out = & powershell -NoProfile -ExecutionPolicy Bypass -File $deploy -Database 'x];DROP DATABASE master;--_Test' -Reset 2>&1
if ($LASTEXITCODE -ne 3) { Write-Host "FAIL: ten la tra ma $LASTEXITCODE (mong 3). $out"; exit 1 }

Write-Host 'deploy-guard: PASS'
exit 0
```

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/deploy-guard.ps1` (trong `database/`)
Expected: `FAIL: chua co scripts/deploy.ps1`, mã thoát 1.

- [ ] **Step 7: Viết `database/scripts/lib.ps1`**

```powershell
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot

function Read-DotEnv {
    $path = Join-Path $Root '.env'
    if (-not (Test-Path $path)) { throw '.env khong ton tai. Sao chep .env.example thanh .env roi dien mat khau.' }
    $vars = @{}
    foreach ($line in Get-Content $path) {
        if ($line -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$') { $vars[$Matches[1]] = $Matches[2].Trim('"') }
    }
    foreach ($k in 'DB_SERVER', 'DB_PORT', 'DB_USER', 'DB_PASSWORD') {
        if (-not $vars[$k]) { throw "Thieu $k trong .env" }
    }
    return $vars
}

function Get-DatabaseUrl($Cfg, [string]$Database) {
    "sqlserver://$($Cfg.DB_SERVER):$($Cfg.DB_PORT);database=$Database;user=$($Cfg.DB_USER);password={$($Cfg.DB_PASSWORD)};trustServerCertificate=true"
}

function Invoke-Sql {
    param([hashtable]$Cfg, [string]$Database, [string]$File, [string]$Query, [string[]]$Variables = @())
    # -I: QUOTED_IDENTIFIER ON; -f 65001: doc file UTF-8; -b: loi -> ma thoat khac 0
    $sqlArgs = @('-S', "$($Cfg.DB_SERVER),$($Cfg.DB_PORT)", '-U', $Cfg.DB_USER, '-d', $Database, '-b', '-I', '-f', '65001')
    if ($File) { $sqlArgs += @('-i', $File) } else { $sqlArgs += @('-Q', $Query) }
    foreach ($v in $Variables) { $sqlArgs += @('-v', $v) }
    $env:SQLCMDPASSWORD = $Cfg.DB_PASSWORD
    & sqlcmd @sqlArgs
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd loi (ma $LASTEXITCODE): $File$Query" }
}

function Get-SqlScalar($Cfg, [string]$Database, [string]$Query) {
    $env:SQLCMDPASSWORD = $Cfg.DB_PASSWORD
    $out = & sqlcmd -S "$($Cfg.DB_SERVER),$($Cfg.DB_PORT)" -U $Cfg.DB_USER -d $Database -b -I -h -1 -W -Q "SET NOCOUNT ON; $Query"
    if ($LASTEXITCODE -ne 0) { throw "sqlcmd loi: $Query" }
    return (($out | Where-Object { $_ -and $_.Trim() }) | Select-Object -First 1).Trim()
}
```

- [ ] **Step 8: Viết `database/scripts/deploy.ps1`**

```powershell
param(
    [Parameter(Mandatory = $true)][string]$Database,
    [switch]$Reset,
    [string]$AnchorDateVn = '2026-10-12',
    [switch]$SkipSeed
)
$ErrorActionPreference = 'Stop'

# Chan TRUOC moi viec khac (ke ca doc .env): khong co co nao bo qua.
if ($Database -notmatch '^[A-Za-z0-9_]+$') {
    Write-Host "Tu choi: ten CSDL '$Database' chi duoc gom chu, so, dau gach duoi."
    exit 3
}
if ($Reset -and ($Database -notmatch '(?i)_(Test|Dev)$')) {
    Write-Host "Tu choi -Reset: '$Database' khong ket thuc bang _Test hoac _Dev."
    exit 2
}
if ($AnchorDateVn -notmatch '^\d{4}-\d{2}-\d{2}$') { Write-Host 'AnchorDateVn phai co dang yyyy-MM-dd'; exit 3 }

. (Join-Path $PSScriptRoot 'lib.ps1')
$cfg = Read-DotEnv

$ver = Get-SqlScalar $cfg 'master' "SELECT CAST(SERVERPROPERTY('ProductVersion') AS NVARCHAR(50))"
if ([version]$ver -lt [version]'13.0.4001') { throw "SQL Server $ver thap hon 13.0.4001 (2016 SP1)." }

if ($Reset) {
    Invoke-Sql -Cfg $cfg -Database 'master' -Query "IF DB_ID(N'$Database') IS NOT NULL BEGIN ALTER DATABASE [$Database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$Database]; END; CREATE DATABASE [$Database];"
} else {
    Invoke-Sql -Cfg $cfg -Database 'master' -Query "IF DB_ID(N'$Database') IS NULL CREATE DATABASE [$Database];"
}

$compat = Get-SqlScalar $cfg 'master' "SELECT compatibility_level FROM sys.databases WHERE name = N'$Database'"
if ([int]$compat -lt 130) { throw "compatibility_level $compat < 130 (can cho OPENJSON)." }

$env:DATABASE_URL = Get-DatabaseUrl $cfg $Database
Push-Location $Root
try {
    & npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy loi' }
} finally { Pop-Location }

foreach ($dir in '00-schema-extras', '01-views', '02-functions-procs', '03-triggers') {
    $path = Join-Path $Root "sql\$dir"
    if (Test-Path $path) {
        foreach ($f in (Get-ChildItem $path -Filter '*.sql' | Sort-Object Name)) {
            Write-Host "-> $dir/$($f.Name)"
            Invoke-Sql -Cfg $cfg -Database $Database -File $f.FullName
        }
    }
}

if (-not $SkipSeed) {
    $seedDir = Join-Path $Root 'sql\seed'
    if (Test-Path $seedDir) {
        foreach ($f in (Get-ChildItem $seedDir -Filter '*.sql' | Sort-Object Name)) {
            Write-Host "-> seed/$($f.Name)"
            Invoke-Sql -Cfg $cfg -Database $Database -File $f.FullName -Variables @("AnchorDateVn=$AnchorDateVn")
        }
    }
}
Write-Host "Trien khai xong: $Database"
exit 0
```

- [ ] **Step 9: Chạy lại test chặn reset**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File tests/deploy-guard.ps1`
Expected: `deploy-guard: PASS`, mã thoát 0. (Không cần `.env` — chặn xảy ra trước khi đọc.)

- [ ] **Step 10: Viết `database/scripts/test.ps1`**

```powershell
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib.ps1')

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'deploy.ps1') -Database 'SwiftletCare_Test' -Reset
if ($LASTEXITCODE -ne 0) { Write-Host 'Trien khai SwiftletCare_Test that bai'; exit 1 }

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'tests\deploy-guard.ps1')
if ($LASTEXITCODE -ne 0) { exit 1 }

$cfg = Read-DotEnv
$failed = @()
foreach ($f in (Get-ChildItem (Join-Path $Root 'tests') -Filter '*.test.sql' | Sort-Object Name)) {
    Write-Host "== $($f.Name)"
    try { Invoke-Sql -Cfg $cfg -Database 'SwiftletCare_Test' -File $f.FullName }
    catch { $failed += $f.Name }
}
if ($failed.Count -gt 0) { Write-Host "THAT BAI: $($failed -join ', ')"; exit 1 }
Write-Host 'Tat ca test dat'
exit 0
```

- [ ] **Step 11: Chạy `npm test` trên CSDL rỗng**

Run: `npm test` (trong `database/`)
Expected: tạo `SwiftletCare_Test`, `prisma migrate deploy` báo không có migration, `deploy-guard: PASS`, `Tat ca test dat`. Kiểm thêm: `npm run reset:dev` tạo được `SwiftletCare_Dev`.

- [ ] **Step 12: Commit**

```bash
git add .gitignore database/package.json database/package-lock.json database/prisma.config.ts database/prisma/schema.prisma database/.env.example database/scripts database/tests/deploy-guard.ps1
git commit -m "feat(database): khung package, deploy.ps1 chặn reset ngoài _Test/_Dev, npm test

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Schema bảng lõi, ràng buộc, kiểm chứng R2/R4/R5

**Files:**
- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/<timestamp>_init/migration.sql` (Prisma sinh, thêm SQL tay cuối file)
- Create (chỉ nếu R2/R5 buộc): `database/sql/00-schema-extras/01-hand-written.sql`
- Create: `database/spikes/RESULTS.md`, `database/tests/constraints.test.sql`

**Interfaces:**
- Produces: 10 bảng lõi đúng tên cột spec Phần 2 (`Users, Houses, Zones, Devices, Metrics, Thresholds, SensorReadings, ControlLogs, Alerts, AlertHistory`); ràng buộc tên `CK_<Bảng>_<Ý nghĩa>`; chỉ mục `UX_Alerts_OpenThreshold`; khóa ngoại `FK_Alerts_Zone_House`. Model Prisma đặt **đúng tên bảng và tên cột PascalCase** (không `@map`), để `$queryRaw` và Prisma Client dùng cùng một tên.

- [ ] **Step 1: Viết `database/prisma/schema.prisma` đầy đủ bảng lõi (thử cả quan hệ ghép R5)**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "sqlserver"
}

model Users {
  UserId       Int      @id @default(autoincrement())
  Username     String   @unique @db.VarChar(50)
  PasswordHash String   @db.VarChar(255)
  FullName     String   @db.NVarChar(100)
  Email        String   @unique @db.VarChar(255)
  Phone        String?  @db.VarChar(20)
  Role         String   @db.VarChar(10)
  IsActive     Boolean  @default(true)
  CreatedAt    DateTime @default(dbgenerated("sysutcdatetime()")) @db.DateTime2(0)

  Houses         Houses[]
  Thresholds     Thresholds[]
  ControlLogs    ControlLogs[]
  AlertsResolved Alerts[]       @relation("AlertResolvedBy")
  AlertHistory   AlertHistory[]
}

model Houses {
  HouseId   Int      @id @default(autoincrement())
  OwnerId   Int
  Name      String   @db.NVarChar(100)
  Address   String?  @db.NVarChar(255)
  IsActive  Boolean  @default(true)
  CreatedAt DateTime @default(dbgenerated("sysutcdatetime()")) @db.DateTime2(0)

  Owner  Users    @relation(fields: [OwnerId], references: [UserId], onDelete: NoAction, onUpdate: NoAction)
  Zones  Zones[]
  Alerts Alerts[]

  @@unique([OwnerId, Name])
}

model Zones {
  ZoneId  Int    @id @default(autoincrement())
  HouseId Int
  Name    String @db.NVarChar(50)
  FloorNo Int    @db.TinyInt

  House      Houses       @relation(fields: [HouseId], references: [HouseId], onDelete: NoAction, onUpdate: NoAction)
  Devices    Devices[]
  Thresholds Thresholds[]
  Alerts     Alerts[]

  @@unique([HouseId, Name])
  @@unique([ZoneId, HouseId])
}

model Devices {
  DeviceId   Int       @id @default(autoincrement())
  ZoneId     Int
  Code       String    @unique @db.VarChar(50)
  Name       String    @db.NVarChar(100)
  DeviceType String    @db.VarChar(10)
  Status     String    @default("OFFLINE") @db.VarChar(10)
  LastSeenAt DateTime? @db.DateTime2(0)
  Mode       String?   @db.VarChar(6)
  IsOn       Boolean?
  Level      Int?      @db.TinyInt
  IsActive   Boolean   @default(true)
  CreatedAt  DateTime  @default(dbgenerated("sysutcdatetime()")) @db.DateTime2(0)

  Zone           Zones            @relation(fields: [ZoneId], references: [ZoneId], onDelete: NoAction, onUpdate: NoAction)
  SensorReadings SensorReadings[]
  ControlLogs    ControlLogs[]
  Alerts         Alerts[]

  @@index([ZoneId])
}

model Metrics {
  MetricCode String  @id @db.VarChar(10)
  Name       String  @db.NVarChar(50)
  Unit       String  @db.NVarChar(10)
  ValidMin   Decimal @db.Decimal(9, 2)
  ValidMax   Decimal @db.Decimal(9, 2)
  Hysteresis Decimal @db.Decimal(9, 2)

  Thresholds     Thresholds[]
  SensorReadings SensorReadings[]
  Alerts         Alerts[]
}

model Thresholds {
  ZoneId      Int
  MetricCode  String   @db.VarChar(10)
  MinValue    Decimal? @db.Decimal(9, 2)
  MaxValue    Decimal? @db.Decimal(9, 2)
  TargetValue Decimal? @db.Decimal(9, 2)
  UpdatedBy   Int?
  UpdatedAt   DateTime @default(dbgenerated("sysutcdatetime()")) @db.DateTime2(0)

  Zone    Zones   @relation(fields: [ZoneId], references: [ZoneId], onDelete: NoAction, onUpdate: NoAction)
  Metric  Metrics @relation(fields: [MetricCode], references: [MetricCode], onDelete: NoAction, onUpdate: NoAction)
  Updater Users?  @relation(fields: [UpdatedBy], references: [UserId], onDelete: NoAction, onUpdate: NoAction)

  @@id([ZoneId, MetricCode])
}

model SensorReadings {
  ReadingId  BigInt   @id(clustered: false) @default(autoincrement())
  DeviceId   Int
  MetricCode String   @db.VarChar(10)
  Value      Decimal  @db.Decimal(9, 2)
  RecordedAt DateTime @db.DateTime2(0)

  Device Devices @relation(fields: [DeviceId], references: [DeviceId], onDelete: NoAction, onUpdate: NoAction)
  Metric Metrics @relation(fields: [MetricCode], references: [MetricCode], onDelete: NoAction, onUpdate: NoAction)

  @@unique([DeviceId, MetricCode, RecordedAt])
  @@index([RecordedAt], clustered: true)
}

model ControlLogs {
  LogId     Int      @id @default(autoincrement())
  DeviceId  Int
  IsOn      Boolean
  Level     Int?     @db.TinyInt
  Mode      String   @db.VarChar(6)
  Source    String   @db.VarChar(6)
  UserId    Int?
  Reason    String?  @db.NVarChar(200)
  CreatedAt DateTime @default(dbgenerated("sysutcdatetime()")) @db.DateTime2(0)

  Device Devices @relation(fields: [DeviceId], references: [DeviceId], onDelete: NoAction, onUpdate: NoAction)
  User   Users?  @relation(fields: [UserId], references: [UserId], onDelete: NoAction, onUpdate: NoAction)

  @@index([DeviceId, CreatedAt(sort: Desc)])
}

model Alerts {
  AlertId       Int       @id @default(autoincrement())
  HouseId       Int
  ZoneId        Int?
  DeviceId      Int?
  AlertType     String    @db.VarChar(20)
  Severity      String    @db.VarChar(10)
  MetricCode    String?   @db.VarChar(10)
  Value         Decimal?  @db.Decimal(9, 2)
  DetectedClass String?   @db.VarChar(10)
  Confidence    Decimal?  @db.Decimal(4, 3)
  SnapshotPath  String?   @db.NVarChar(260)
  Message       String    @db.NVarChar(500)
  Status        String    @default("NEW") @db.VarChar(10)
  CreatedAt     DateTime  @default(dbgenerated("sysutcdatetime()")) @db.DateTime2(0)
  ResolvedAt    DateTime? @db.DateTime2(0)
  ResolvedBy    Int?

  House    Houses         @relation(fields: [HouseId], references: [HouseId], onDelete: NoAction, onUpdate: NoAction)
  // R5: thu quan he ghep. Neu prisma validate bao loi -> xoa dong nay (Step 3).
  Zone     Zones?         @relation(fields: [ZoneId, HouseId], references: [ZoneId, HouseId], onDelete: NoAction, onUpdate: NoAction)
  Device   Devices?       @relation(fields: [DeviceId], references: [DeviceId], onDelete: NoAction, onUpdate: NoAction)
  Metric   Metrics?       @relation(fields: [MetricCode], references: [MetricCode], onDelete: NoAction, onUpdate: NoAction)
  Resolver Users?         @relation("AlertResolvedBy", fields: [ResolvedBy], references: [UserId], onDelete: NoAction, onUpdate: NoAction)
  History  AlertHistory[]

  @@index([HouseId, Status, CreatedAt(sort: Desc)])
  @@index([DeviceId, AlertType, DetectedClass, CreatedAt(sort: Desc)])
}

model AlertHistory {
  HistoryId Int      @id @default(autoincrement())
  AlertId   Int
  OldStatus String?  @db.VarChar(10)
  NewStatus String   @db.VarChar(10)
  UserId    Int?
  Note      String?  @db.NVarChar(500)
  ChangedAt DateTime @default(dbgenerated("sysutcdatetime()")) @db.DateTime2(0)

  Alert Alerts @relation(fields: [AlertId], references: [AlertId], onDelete: NoAction, onUpdate: NoAction)
  User  Users? @relation(fields: [UserId], references: [UserId], onDelete: NoAction, onUpdate: NoAction)

  @@index([AlertId])
}
```

- [ ] **Step 2: Kiểm chứng R5**

Run: `npx prisma validate`
Expected (một trong hai):
- **Hợp lệ** → R5 không xảy ra; giữ quan hệ `Zone`, bỏ khối `FK_Alerts_Zone_House` ở Step 6.
- **Lỗi** dạng "At least one of those fields is required. Hence the relation field must be required as well" → R5 xảy ra; sang Step 3.

Ghi kết quả (nguyên văn thông báo) vào `database/spikes/RESULTS.md` mục `R5`.

- [ ] **Step 3: (Chỉ khi R5 xảy ra) bỏ quan hệ ghép khỏi schema**

Xóa hai dòng chú thích `// R5…` và `Zone Zones? @relation(fields: [ZoneId, HouseId] …)` trong model `Alerts`, và dòng `Alerts Alerts[]` trong model `Zones`. `ZoneId Int?` vẫn là cột thường; khóa ngoại ghép do SQL tay ở Step 6 tạo. Chạy lại `npx prisma validate` → hợp lệ.

- [ ] **Step 4: Tạo migration (chưa áp dụng)**

Run (trong `database/`, `.env` trỏ `SwiftletCare_Dev`):

```powershell
npm run reset:dev -- -SkipSeed
npx prisma migrate dev --create-only --name init
```

Expected: tạo `prisma/migrations/<timestamp>_init/migration.sql`.

- [ ] **Step 5: Kiểm chứng R4 trong SQL sinh ra**

Mở `migration.sql`, tìm phần `SensorReadings`. Mong đợi có `CONSTRAINT [SensorReadings_pkey] PRIMARY KEY NONCLUSTERED ([ReadingId])` và `CREATE CLUSTERED INDEX [SensorReadings_RecordedAt_idx] ON [dbo].[SensorReadings]([RecordedAt])`.
- Có đủ → R4 không xảy ra.
- Thiếu → R4 xảy ra: sửa tay trong chính `migration.sql` (đổi `PRIMARY KEY` thành `PRIMARY KEY NONCLUSTERED`, đổi `CREATE INDEX … ([RecordedAt])` thành `CREATE CLUSTERED INDEX`).

Ghi kết quả vào `spikes/RESULTS.md` mục `R4`.

- [ ] **Step 6: Thêm SQL viết tay vào cuối `migration.sql`**

Mọi câu viết dạng **chạy lại an toàn** (có `IF NOT EXISTS`), để nếu R2 buộc chuyển ra `sql/00-schema-extras/` thì dời nguyên khối, không sửa nội dung.

```sql
-- ===== SQL viet tay: CHECK, chi muc loc, khoa ngoai ghep (spec database-core Phan 2) =====
IF OBJECT_ID(N'dbo.CK_Users_Role', N'C') IS NULL
    ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role CHECK (Role IN ('ADMIN', 'OWNER'));

IF OBJECT_ID(N'dbo.CK_Devices_Type', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_Type CHECK (DeviceType IN ('SENSOR', 'MIST', 'FAN', 'HEATER', 'SPEAKER', 'CAMERA'));
IF OBJECT_ID(N'dbo.CK_Devices_Status', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_Status CHECK (Status IN ('ONLINE', 'OFFLINE', 'ERROR'));
IF OBJECT_ID(N'dbo.CK_Devices_Mode', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_Mode CHECK (Mode IN ('AUTO', 'MANUAL'));
IF OBJECT_ID(N'dbo.CK_Devices_Level', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_Level CHECK (Level BETWEEN 0 AND 100);
IF OBJECT_ID(N'dbo.CK_Devices_ActuatorState', N'C') IS NULL
    ALTER TABLE dbo.Devices ADD CONSTRAINT CK_Devices_ActuatorState CHECK (
        (DeviceType IN ('MIST', 'FAN', 'HEATER', 'SPEAKER') AND Mode IS NOT NULL AND IsOn IS NOT NULL)
        OR (DeviceType IN ('SENSOR', 'CAMERA') AND Mode IS NULL AND IsOn IS NULL AND Level IS NULL));

IF OBJECT_ID(N'dbo.CK_Metrics_Range', N'C') IS NULL
    ALTER TABLE dbo.Metrics ADD CONSTRAINT CK_Metrics_Range CHECK (ValidMin < ValidMax);
IF OBJECT_ID(N'dbo.CK_Metrics_Hysteresis', N'C') IS NULL
    ALTER TABLE dbo.Metrics ADD CONSTRAINT CK_Metrics_Hysteresis CHECK (Hysteresis >= 0);

IF OBJECT_ID(N'dbo.CK_Thresholds_AnyBound', N'C') IS NULL
    ALTER TABLE dbo.Thresholds ADD CONSTRAINT CK_Thresholds_AnyBound CHECK (MinValue IS NOT NULL OR MaxValue IS NOT NULL);
IF OBJECT_ID(N'dbo.CK_Thresholds_MinMax', N'C') IS NULL
    ALTER TABLE dbo.Thresholds ADD CONSTRAINT CK_Thresholds_MinMax CHECK (MinValue IS NULL OR MaxValue IS NULL OR MinValue < MaxValue);
IF OBJECT_ID(N'dbo.CK_Thresholds_Target', N'C') IS NULL
    ALTER TABLE dbo.Thresholds ADD CONSTRAINT CK_Thresholds_Target CHECK (
        TargetValue IS NULL
        OR ((MinValue IS NULL OR TargetValue >= MinValue) AND (MaxValue IS NULL OR TargetValue <= MaxValue)));

IF OBJECT_ID(N'dbo.CK_ControlLogs_Mode', N'C') IS NULL
    ALTER TABLE dbo.ControlLogs ADD CONSTRAINT CK_ControlLogs_Mode CHECK (Mode IN ('AUTO', 'MANUAL'));
IF OBJECT_ID(N'dbo.CK_ControlLogs_Source', N'C') IS NULL
    ALTER TABLE dbo.ControlLogs ADD CONSTRAINT CK_ControlLogs_Source CHECK (Source IN ('AUTO', 'MANUAL'));
IF OBJECT_ID(N'dbo.CK_ControlLogs_ManualUser', N'C') IS NULL
    ALTER TABLE dbo.ControlLogs ADD CONSTRAINT CK_ControlLogs_ManualUser CHECK (Source <> 'MANUAL' OR UserId IS NOT NULL);
IF OBJECT_ID(N'dbo.CK_ControlLogs_Level', N'C') IS NULL
    ALTER TABLE dbo.ControlLogs ADD CONSTRAINT CK_ControlLogs_Level CHECK (Level BETWEEN 0 AND 100);

IF OBJECT_ID(N'dbo.CK_Alerts_Type', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Type CHECK (AlertType IN ('THRESHOLD', 'PREDATOR', 'DEVICE_OFFLINE', 'POPULATION_DROP'));
IF OBJECT_ID(N'dbo.CK_Alerts_Severity', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Severity CHECK (Severity IN ('INFO', 'WARNING', 'CRITICAL'));
IF OBJECT_ID(N'dbo.CK_Alerts_Status', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Status CHECK (Status IN ('NEW', 'ACK', 'RESOLVED'));
IF OBJECT_ID(N'dbo.CK_Alerts_Resolved', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Resolved CHECK (
        (Status = 'RESOLVED' AND ResolvedAt IS NOT NULL) OR (Status <> 'RESOLVED' AND ResolvedAt IS NULL));
IF OBJECT_ID(N'dbo.CK_Alerts_Confidence', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_Confidence CHECK (Confidence BETWEEN 0 AND 1);
IF OBJECT_ID(N'dbo.CK_Alerts_ByType', N'C') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT CK_Alerts_ByType CHECK (
        (AlertType = 'THRESHOLD' AND ZoneId IS NOT NULL AND MetricCode IS NOT NULL AND Value IS NOT NULL
            AND DetectedClass IS NULL AND Confidence IS NULL AND SnapshotPath IS NULL)
        OR (AlertType = 'PREDATOR' AND DeviceId IS NOT NULL AND ZoneId IS NOT NULL
            AND DetectedClass IN ('rat', 'snake', 'owl') AND Confidence IS NOT NULL AND SnapshotPath IS NOT NULL
            AND MetricCode IS NULL AND Value IS NULL)
        OR (AlertType = 'DEVICE_OFFLINE' AND DeviceId IS NOT NULL AND ZoneId IS NOT NULL
            AND MetricCode IS NULL AND Value IS NULL AND DetectedClass IS NULL AND Confidence IS NULL AND SnapshotPath IS NULL)
        OR (AlertType = 'POPULATION_DROP' AND ZoneId IS NULL AND DeviceId IS NULL
            AND MetricCode IS NULL AND Value IS NULL AND DetectedClass IS NULL AND Confidence IS NULL AND SnapshotPath IS NULL));

IF OBJECT_ID(N'dbo.CK_AlertHistory_Status', N'C') IS NULL
    ALTER TABLE dbo.AlertHistory ADD CONSTRAINT CK_AlertHistory_Status CHECK (
        NewStatus IN ('NEW', 'ACK', 'RESOLVED') AND (OldStatus IS NULL OR OldStatus IN ('NEW', 'ACK', 'RESOLVED')));

-- Luoi an toan chong mo trung canh bao nguong. Bo loc PHAI co AlertType = 'THRESHOLD'
-- (chi muc unique coi cac NULL la bang nhau).
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Alerts_OpenThreshold' AND object_id = OBJECT_ID(N'dbo.Alerts'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_Alerts_OpenThreshold ON dbo.Alerts (ZoneId, MetricCode)
        WHERE AlertType = 'THRESHOLD' AND Status <> 'RESOLVED';

-- Chi khi R5 xay ra (Step 3): khoa ngoai ghep dam bao HouseId khop ZoneId.
IF OBJECT_ID(N'dbo.FK_Alerts_Zone_House', N'F') IS NULL
    ALTER TABLE dbo.Alerts ADD CONSTRAINT FK_Alerts_Zone_House
        FOREIGN KEY (ZoneId, HouseId) REFERENCES dbo.Zones (ZoneId, HouseId);
```

- [ ] **Step 7: Áp dụng migration**

Run: `npx prisma migrate dev`
Expected: "The following migration(s) have been applied: …_init". Kiểm tra nhanh:

```powershell
sqlcmd -S localhost,1433 -U swiftlet_dev -d SwiftletCare_Dev -Q "SELECT name FROM sys.check_constraints ORDER BY name; SELECT name, has_filter FROM sys.indexes WHERE name = 'UX_Alerts_OpenThreshold'"
```

Expected: 22 dòng `CK_*`; `UX_Alerts_OpenThreshold` với `has_filter = 1`.

- [ ] **Step 8: Kiểm chứng R2 (Prisma có coi SQL tay là lệch không)**

Run: `npx prisma migrate dev --create-only --name r2_probe`
Expected (một trong hai):
- "Already in sync" / không tạo thư mục migration mới → **R2 không xảy ra**: giữ SQL tay trong migration. Xóa thư mục `r2_probe` nếu có mà rỗng.
- Báo "Drift detected", đòi reset, hoặc tạo migration `r2_probe` chứa `DROP INDEX [UX_Alerts_OpenThreshold]` / `DROP CONSTRAINT [FK_Alerts_Zone_House]` → **R2 xảy ra**: xóa thư mục `r2_probe`, rồi làm Step 9.

Ghi kết quả và nguyên văn thông báo vào `spikes/RESULTS.md` mục `R2`.

- [ ] **Step 9: (Chỉ khi R2 xảy ra) dời phần bị coi là lệch ra `sql/00-schema-extras/`**

1. Cắt **khối chỉ mục lọc** và **khối `FK_Alerts_Zone_House`** (những đối tượng Prisma thấy được; CHECK không bị Prisma so sánh nên ở lại migration) khỏi `migration.sql`, dán nguyên văn vào `database/sql/00-schema-extras/01-hand-written.sql` (đã có `IF NOT EXISTS`, chạy lại an toàn; `deploy.ps1` chạy thư mục này ngay sau `migrate deploy`).
2. Từ nay **không chạy `prisma migrate dev`** trên CSDL đã có extras (sẽ báo drift). Tạo migration mới bằng:

   ```powershell
   npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script --shadow-database-url "<DATABASE_URL cua mot CSDL ten SwiftletCare_Shadow_Dev>" > prisma/migrations/<yyyyMMddHHmmss>_<ten>/migration.sql
   ```

   rồi áp dụng bằng `npm run deploy:dev`. Ghi quy trình này vào `spikes/RESULTS.md` và README (Task 13).
3. `npm run reset:dev -- -SkipSeed` → chạy sạch không lỗi.

- [ ] **Step 10: Viết `database/tests/constraints.test.sql`**

File này là **ngoại lệ có chủ ý** của quy ước test: dùng `SET XACT_ABORT OFF` để lỗi ràng buộc chỉ hủy câu lệnh, transaction vẫn tiếp tục — kiểm nhiều ràng buộc trong một transaction rồi ROLLBACK một lần.

```sql
SET NOCOUNT ON;
SET XACT_ABORT OFF;
GO
BEGIN TRAN;
DECLARE @u INT, @h1 INT, @h2 INT, @z1 INT, @z2 INT, @sensor INT, @fan INT, @cam INT, @expected NVARCHAR(50), @case NVARCHAR(200);

INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role) VALUES ('ck_user', 'x', N'Kiểm thử', 'ck@example.com', 'OWNER');
SET @u = SCOPE_IDENTITY();
INSERT dbo.Houses (OwnerId, Name) VALUES (@u, N'CK nhà 1'); SET @h1 = SCOPE_IDENTITY();
INSERT dbo.Houses (OwnerId, Name) VALUES (@u, N'CK nhà 2'); SET @h2 = SCOPE_IDENTITY();
INSERT dbo.Zones (HouseId, Name, FloorNo) VALUES (@h1, N'Tầng 1', 1); SET @z1 = SCOPE_IDENTITY();
INSERT dbo.Zones (HouseId, Name, FloorNo) VALUES (@h2, N'Tầng 1', 1); SET @z2 = SCOPE_IDENTITY();
IF NOT EXISTS (SELECT 1 FROM dbo.Metrics WHERE MetricCode = 'TEMP')
    INSERT dbo.Metrics (MetricCode, Name, Unit, ValidMin, ValidMax, Hysteresis) VALUES ('TEMP', N'Nhiệt độ', N'°C', -10, 60, 0.5);
INSERT dbo.Devices (ZoneId, Code, Name, DeviceType) VALUES (@z1, 'CK-SENSOR', N'Cảm biến', 'SENSOR'); SET @sensor = SCOPE_IDENTITY();
INSERT dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn) VALUES (@z1, 'CK-FAN', N'Quạt', 'FAN', 'AUTO', 0); SET @fan = SCOPE_IDENTITY();
INSERT dbo.Devices (ZoneId, Code, Name, DeviceType) VALUES (@z1, 'CK-CAM', N'Camera', 'CAMERA'); SET @cam = SCOPE_IDENTITY();

-- Moi ca: chay cau vi pham trong TRY; khong loi -> that bai; loi khac ma mong doi -> that bai.
SET @case = N'Users.Role ngoai mien'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role) VALUES ('x1', 'x', N'x', 'x1@e.com', 'GUEST'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Users.Username trung'; SET @expected = N'2601,2627';
BEGIN TRY INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role) VALUES ('ck_user', 'x', N'x', 'x2@e.com', 'OWNER'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'SENSOR co Mode'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Devices (ZoneId, Code, Name, DeviceType, Mode) VALUES (@z1, 'CK-X1', N'x', 'SENSOR', 'AUTO'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'FAN thieu Mode/IsOn'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Devices (ZoneId, Code, Name, DeviceType) VALUES (@z1, 'CK-X2', N'x', 'FAN'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Devices.Level 101'; SET @expected = N'547';
BEGIN TRY UPDATE dbo.Devices SET Level = 101 WHERE DeviceId = @fan; THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Devices.Mode ngoai mien'; SET @expected = N'547';
BEGIN TRY UPDATE dbo.Devices SET Mode = 'SEMI' WHERE DeviceId = @fan; THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Devices.Code trung'; SET @expected = N'2601,2627';
BEGIN TRY INSERT dbo.Devices (ZoneId, Code, Name, DeviceType) VALUES (@z1, 'CK-SENSOR', N'x', 'SENSOR'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Metrics ValidMin >= ValidMax'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Metrics (MetricCode, Name, Unit, ValidMin, ValidMax, Hysteresis) VALUES ('CKX', N'x', N'x', 10, 10, 0); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Thresholds khong co nguong nao'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Thresholds (ZoneId, MetricCode) VALUES (@z1, 'TEMP'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Thresholds Min >= Max'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Thresholds (ZoneId, MetricCode, MinValue, MaxValue) VALUES (@z1, 'TEMP', 30, 26); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Thresholds Target ngoai [Min,Max]'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Thresholds (ZoneId, MetricCode, MinValue, MaxValue, TargetValue) VALUES (@z1, 'TEMP', 26, 30, 31); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'ControlLogs MANUAL thieu UserId'; SET @expected = N'547';
BEGIN TRY INSERT dbo.ControlLogs (DeviceId, IsOn, Mode, Source) VALUES (@fan, 1, 'MANUAL', 'MANUAL'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Alerts THRESHOLD thieu MetricCode'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, Value, Message) VALUES (@h1, @z1, 'THRESHOLD', 'WARNING', 31, N'x'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Alerts POPULATION_DROP co ZoneId'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, Message) VALUES (@h1, @z1, 'POPULATION_DROP', 'CRITICAL', N'x'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Alerts PREDATOR loai la'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Alerts (HouseId, ZoneId, DeviceId, AlertType, Severity, DetectedClass, Confidence, SnapshotPath, Message) VALUES (@h1, @z1, @cam, 'PREDATOR', 'CRITICAL', 'cat', 0.9, N'a.jpg', N'x'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Alerts ZoneId cua nha khac (khoa ngoai ghep)'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message) VALUES (@h1, @z2, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'x'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

SET @case = N'Alerts RESOLVED thieu ResolvedAt'; SET @expected = N'547';
BEGIN TRY INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message, Status) VALUES (@h1, @z1, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'x', 'RESOLVED'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

-- Chi muc loc: mot THRESHOLD dang mo + mot da dong cung (zone, metric) -> hop le; hai dang mo -> 2601.
INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message, Status, ResolvedAt)
    VALUES (@h1, @z1, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'da dong', 'RESOLVED', SYSUTCDATETIME());
INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message) VALUES (@h1, @z1, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'dang mo');
SET @case = N'Hai THRESHOLD dang mo cung (zone, metric)'; SET @expected = N'2601';
BEGIN TRY INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message) VALUES (@h1, @z1, 'THRESHOLD', 'WARNING', 'TEMP', 32, N'trung'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

-- Hai PREDATOR dang mo cung khu vuc KHONG bi chi muc loc chan (MetricCode NULL).
INSERT dbo.Alerts (HouseId, ZoneId, DeviceId, AlertType, Severity, DetectedClass, Confidence, SnapshotPath, Message) VALUES (@h1, @z1, @cam, 'PREDATOR', 'CRITICAL', 'rat', 0.9, N'a.jpg', N'x');
INSERT dbo.Alerts (HouseId, ZoneId, DeviceId, AlertType, Severity, DetectedClass, Confidence, SnapshotPath, Message) VALUES (@h1, @z1, @cam, 'PREDATOR', 'CRITICAL', 'owl', 0.8, N'b.jpg', N'y');

SET @case = N'SensorReadings trung (Device, Metric, RecordedAt)'; SET @expected = N'2601,2627';
INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt) VALUES (@sensor, 'TEMP', 28, '2026-10-12T10:00:00');
BEGIN TRY INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt) VALUES (@sensor, 'TEMP', 29, '2026-10-12T10:00:00'); THROW 59999, N'khong bi chan', 1; END TRY
BEGIN CATCH IF CHARINDEX(CAST(ERROR_NUMBER() AS NVARCHAR(10)), @expected) = 0 BEGIN ROLLBACK; THROW 59998, @case, 1; END END CATCH;

ROLLBACK;
PRINT N'constraints: PASS';
GO
```

- [ ] **Step 11: Chạy test**

Run: `npm test`
Expected: `== constraints.test.sql` … `constraints: PASS`, `Tat ca test dat`. Nếu một ca báo `THROW 59998 <tên ca>`: ràng buộc tương ứng ở Step 6 viết sai — sửa migration (hoặc file extras), `npm test` lại.

- [ ] **Step 12: Commit**

```bash
git add database/prisma database/sql database/spikes/RESULTS.md database/tests/constraints.test.sql
git commit -m "feat(database): schema bảng lõi, CHECK, chỉ mục lọc, khóa ngoại ghép; kiểm chứng R2/R4/R5

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Dữ liệu mẫu tham chiếu và kiểm chứng R1

**Files:**
- Create: `database/sql/seed/01-reference.sql`, `database/tests/seed.test.sql`, `database/spikes/r1-trigger-output.ts`
- Modify: `database/spikes/RESULTS.md`

**Interfaces:**
- Consumes: bảng của Task 2.
- Produces: dữ liệu tham chiếu cố định mọi test sau dùng — người dùng `admin`/`owner1`/`owner2`; nhà `H1` (owner1), `H2` (owner2); khu vực tên `F0..F3` (H1), `F0..F1` (H2) với `FloorNo` tương ứng; thiết bị mã `<Nhà>-F<tầng>-<LOẠI>` (VD `H1-F1-SENSOR`, `H1-F2-FAN`, `H1-F0-CAMERA`, `H2-F0-SPEAKER`); ngưỡng mọi khu vực TEMP 26–30 (đích 28), HUMID 75–90 (đích 82), CO2 Max 1000, LIGHT Max 10. Kết luận R1 ghi trong `spikes/RESULTS.md`.

- [ ] **Step 1: Viết test số lượng dữ liệu tham chiếu (phải fail vì chưa có seed)**

`database/tests/seed.test.sql`:

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
PRINT N'seed: du lieu tham chieu';
IF (SELECT COUNT(*) FROM dbo.Users) <> 3 THROW 59999, N'seed: Users phai co 3 dong', 1;
IF (SELECT COUNT(*) FROM dbo.Houses) <> 2 THROW 59999, N'seed: Houses phai co 2 dong', 1;
IF (SELECT COUNT(*) FROM dbo.Zones) <> 6 THROW 59999, N'seed: Zones phai co 6 dong', 1;
IF (SELECT COUNT(*) FROM dbo.Devices) <> 28 THROW 59999, N'seed: Devices phai co 28 dong', 1;
IF (SELECT COUNT(*) FROM dbo.Devices WHERE DeviceType = 'SENSOR') <> 6 THROW 59999, N'seed: phai co 6 cam bien', 1;
IF (SELECT COUNT(*) FROM dbo.Metrics) <> 4 THROW 59999, N'seed: Metrics phai co 4 dong', 1;
IF (SELECT COUNT(*) FROM dbo.Thresholds) <> 24 THROW 59999, N'seed: Thresholds phai co 24 dong', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Devices d JOIN dbo.Zones z ON z.ZoneId = d.ZoneId JOIN dbo.Houses h ON h.HouseId = z.HouseId
               WHERE d.Code = 'H1-F0-CAMERA' AND h.Name = N'H1' AND z.FloorNo = 0)
    THROW 59999, N'seed: thieu H1-F0-CAMERA o tang 0 nha H1', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Devices WHERE Code = 'H2-F1-SENSOR') THROW 59999, N'seed: thieu H2-F1-SENSOR', 1;
IF EXISTS (SELECT 1 FROM dbo.Users WHERE PasswordHash <> '$2a$10$M/DxgzTqClpNLyz2TDREfuIq8x2OHTobFhaeNPRbb4wfw.xhCp05K')
    THROW 59999, N'seed: PasswordHash phai la hash dev co dinh', 1;
PRINT N'seed tham chieu: PASS';
GO
```

Run: `npm test` → Expected: FAIL tại `seed: Users phai co 3 dong`.

- [ ] **Step 2: Viết `database/sql/seed/01-reference.sql`**

Một batch duy nhất (không `GO`) để `RETURN` thoát được cả file khi đã có dữ liệu.

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'admin')
BEGIN
    PRINT N'seed 01: da co du lieu, bo qua';
    RETURN;
END

BEGIN TRAN;

-- Mat khau dev ghi trong README database (CHI dung phat trien), seed chi chua hash bcrypt.
DECLARE @hash VARCHAR(255) = '$2a$10$M/DxgzTqClpNLyz2TDREfuIq8x2OHTobFhaeNPRbb4wfw.xhCp05K';

INSERT dbo.Users (Username, PasswordHash, FullName, Email, Role) VALUES
    ('admin',  @hash, N'Quản trị viên',  'admin@swiftletcare.local',  'ADMIN'),
    ('owner1', @hash, N'Chủ nhà yến H1', 'owner1@swiftletcare.local', 'OWNER'),
    ('owner2', @hash, N'Chủ nhà yến H2', 'owner2@swiftletcare.local', 'OWNER');

INSERT dbo.Houses (OwnerId, Name, Address)
SELECT u.UserId, v.Name, v.Address
FROM (VALUES ('owner1', N'H1', N'Kiên Giang'), ('owner2', N'H2', N'Khánh Hòa')) v (Username, Name, Address)
JOIN dbo.Users u ON u.Username = v.Username;

INSERT dbo.Zones (HouseId, Name, FloorNo)
SELECT h.HouseId, v.ZoneName, v.FloorNo
FROM (VALUES (N'H1', N'F0', 0), (N'H1', N'F1', 1), (N'H1', N'F2', 2), (N'H1', N'F3', 3),
             (N'H2', N'F0', 0), (N'H2', N'F1', 1)) v (HouseName, ZoneName, FloorNo)
JOIN dbo.Houses h ON h.Name = v.HouseName;

-- Moi tang: SENSOR, MIST, FAN, HEATER. Co cau chap hanh bat dau AUTO, tat.
INSERT dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn, Level)
SELECT z.ZoneId,
       CONCAT(h.Name, '-F', z.FloorNo, '-', t.DeviceType),
       CONCAT(t.Label, N' ', h.Name, N' tầng ', z.FloorNo),
       t.DeviceType,
       CASE WHEN t.IsActuator = 1 THEN 'AUTO' END,
       CASE WHEN t.IsActuator = 1 THEN CAST(0 AS BIT) END,
       CASE WHEN t.DeviceType = 'FAN' THEN 0 END
FROM dbo.Zones z
JOIN dbo.Houses h ON h.HouseId = z.HouseId
CROSS JOIN (VALUES ('SENSOR', N'Cảm biến', 0), ('MIST', N'Phun sương', 1), ('FAN', N'Quạt', 1), ('HEATER', N'Sưởi', 1)) t (DeviceType, Label, IsActuator);

-- Moi nha: 1 loa dan du (AUTO, bat) va 1 camera o tang 0.
INSERT dbo.Devices (ZoneId, Code, Name, DeviceType, Mode, IsOn, Level)
SELECT z.ZoneId,
       CONCAT(h.Name, '-F0-', t.DeviceType),
       CONCAT(t.Label, N' ', h.Name),
       t.DeviceType,
       CASE WHEN t.DeviceType = 'SPEAKER' THEN 'AUTO' END,
       CASE WHEN t.DeviceType = 'SPEAKER' THEN CAST(1 AS BIT) END,
       NULL
FROM dbo.Zones z
JOIN dbo.Houses h ON h.HouseId = z.HouseId AND z.FloorNo = 0
CROSS JOIN (VALUES ('SPEAKER', N'Loa dẫn dụ'), ('CAMERA', N'Camera cửa')) t (DeviceType, Label);

INSERT dbo.Metrics (MetricCode, Name, Unit, ValidMin, ValidMax, Hysteresis) VALUES
    ('TEMP',  N'Nhiệt độ', N'°C',  -10, 60,     0.5),
    ('HUMID', N'Độ ẩm',    N'%',     0, 100,    2),
    ('CO2',   N'CO2',      N'ppm',   0, 10000,  50),
    ('LIGHT', N'Ánh sáng', N'lux',   0, 100000, 2);

INSERT dbo.Thresholds (ZoneId, MetricCode, MinValue, MaxValue, TargetValue, UpdatedBy)
SELECT z.ZoneId, v.MetricCode, v.MinValue, v.MaxValue, v.TargetValue, (SELECT UserId FROM dbo.Users WHERE Username = 'admin')
FROM dbo.Zones z
CROSS JOIN (VALUES ('TEMP', 26, 30, 28), ('HUMID', 75, 90, 82), ('CO2', NULL, 1000, NULL), ('LIGHT', NULL, 10, NULL)) v (MetricCode, MinValue, MaxValue, TargetValue);

COMMIT;
PRINT N'seed 01: xong';
```

Lưu ý: hash chứa `$2a$10$M/…` — `sqlcmd` chỉ thay biến dạng `$(Ten)`, chuỗi `$2a$` không bị đụng tới.

- [ ] **Step 3: Chạy test**

Run: `npm test`
Expected: `seed tham chieu: PASS`, `constraints: PASS`, `Tat ca test dat`.

- [ ] **Step 4: Viết script kiểm chứng R1 `database/spikes/r1-trigger-output.ts`**

```ts
// Kiem chung R1: Prisma create/update sinh OUTPUT khong INTO; SQL Server co tu choi khi bang
// chi co trigger AFTER UPDATE khong? Chay tren SwiftletCare_Dev da seed.
import 'dotenv/config';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaMssql({
  server: process.env.DB_SERVER!,
  port: Number(process.env.DB_PORT),
  database: 'SwiftletCare_Dev',
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: { encrypt: false, trustServerCertificate: true, useUTC: true },
});
const prisma = new PrismaClient({ adapter, log: ['query'] });

async function attempt(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`R1 ${label}: OK`);
  } catch (e) {
    console.log(`R1 ${label}: LOI -> ${(e as Error).message}`);
  }
}

async function main() {
  await prisma.$executeRawUnsafe(
    `CREATE OR ALTER TRIGGER dbo.trg_R1Probe ON dbo.Devices AFTER UPDATE AS BEGIN SET NOCOUNT ON; END`,
  );
  const zone = await prisma.zones.findFirstOrThrow({ where: { Name: 'F1', House: { Name: 'H1' } } });
  try {
    await attempt('create (bang chi co trigger AFTER UPDATE)', () =>
      prisma.devices.create({ data: { ZoneId: zone.ZoneId, Code: 'R1-PROBE', Name: 'R1 probe', DeviceType: 'SENSOR' } }),
    );
    await attempt('update (bang co trigger AFTER UPDATE)', () =>
      prisma.devices.update({ where: { Code: 'H1-F1-SENSOR' }, data: { Name: 'R1 probe update' } }),
    );
    await attempt('$executeRaw UPDATE khong OUTPUT', () =>
      prisma.$executeRaw`UPDATE dbo.Devices SET Name = ${'R1 raw update'} WHERE Code = ${'H1-F1-SENSOR'}`,
    );
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS dbo.trg_R1Probe`);
    await prisma.$executeRaw`DELETE FROM dbo.Devices WHERE Code = ${'R1-PROBE'}`;
    await prisma.$executeRaw`UPDATE dbo.Devices SET Name = ${'Cảm biến H1 tầng 1'} WHERE Code = ${'H1-F1-SENSOR'}`;
    await prisma.$disconnect();
  }
}
main();
```

Nếu `import … from '../generated/prisma/client'` báo không tìm thấy, xem tên file trong `database/generated/prisma/` sau khi generate và sửa đường dẫn import cho khớp.

- [ ] **Step 5: Chạy kiểm chứng R1**

```powershell
npm run reset:dev
npx prisma generate
npx tsx spikes/r1-trigger-output.ts
```

Expected: log `prisma:query` cho thấy câu `INSERT … OUTPUT INSERTED…` / `UPDATE … OUTPUT INSERTED…` (không có `INTO`), và ba dòng kết quả `R1 …: OK` hoặc `R1 …: LOI -> …334…`. `$executeRaw UPDATE` phải `OK`.

- [ ] **Step 6: Ghi kết luận R1**

Ghi vào `spikes/RESULTS.md` mục `R1`: nguyên văn ba dòng kết quả, câu SQL Prisma sinh, và kết luận một trong hai:
- `create` OK → backend INSERT Devices bằng `prisma.devices.create`; UPDATE luôn bằng `$executeRaw`.
- `create` LỖI → INSERT Devices cũng bằng `$executeRaw … ; SELECT CAST(SCOPE_IDENTITY() AS INT) AS DeviceId` (dùng `$queryRaw`).

Cập nhật dòng R1 trong bảng rủi ro của spec database-core thành kết luận này (một commit riêng chỉ file spec, theo quy tắc thay đổi qua PR của integration-contract 1.6 nếu nhóm đã bắt đầu làm song song).

- [ ] **Step 7: Commit**

```bash
git add database/sql/seed/01-reference.sql database/tests/seed.test.sql database/spikes/r1-trigger-output.ts database/spikes/RESULTS.md
git commit -m "feat(database): dữ liệu mẫu tham chiếu; kiểm chứng R1 (trigger và OUTPUT)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: `sp_IngestReadings` (thu nhận + cảnh báo ngưỡng có hysteresis) — mốc 20/10

**Files:**
- Create: `database/sql/01-views/vw_AlertJson.sql`, `database/sql/02-functions-procs/sp_IngestReadings.sql`, `database/tests/sp_IngestReadings.test.sql`

**Interfaces:**
- Consumes: dữ liệu tham chiếu Task 3 (ngưỡng TEMP 26–30, CO2 Max 1000, Hysteresis TEMP 0,5, CO2 50).
- Produces:
  - `dbo.vw_AlertJson` — 14 cột đúng danh sách trường cảnh báo, `CreatedAt` là chuỗi `yyyy-MM-ddTHH:mm:ssZ`, `HasSnapshot BIT`. **Mọi SP xuất JSON cảnh báo đọc từ view này** (Task 4, 9, 10, 11).
  - `EXEC dbo.sp_IngestReadings @Json NVARCHAR(MAX), @StaleMinutes INT = 2` → 1 dòng `Received INT, Accepted INT, Duplicates INT, Rejected INT, AcceptedJson NVARCHAR(MAX), NewAlertsJson NVARCHAR(MAX), ResolvedAlertIdsJson NVARCHAR(MAX)`. Ba cột JSON luôn là mảng (`[]` khi rỗng). `AcceptedJson` phần tử `{DeviceId, DeviceCode, HouseId, ZoneId, MetricCode, Value, RecordedAt}`; `ResolvedAlertIdsJson` phần tử `{"AlertId": n}`.

- [ ] **Step 1: Viết test (phải fail vì chưa có SP)**

`database/tests/sp_IngestReadings.test.sql`:

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
-- Bang ket qua dung chung
CREATE TABLE #r (Received INT, Accepted INT, Duplicates INT, Rejected INT,
                 AcceptedJson NVARCHAR(MAX), NewAlertsJson NVARCHAR(MAX), ResolvedAlertIdsJson NVARCHAR(MAX));
GO

PRINT N'ingest: hop le 1 so do';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @t DATETIME2(0) = CAST(SYSUTCDATETIME() AS DATETIME2(0));
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28.5,"at":"', CONVERT(CHAR(19), @t, 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT Received FROM #r) <> 1 OR (SELECT Accepted FROM #r) <> 1 OR (SELECT Rejected FROM #r) <> 0
        THROW 59999, N'ingest hop le: dem sai', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId
                   WHERE d.Code = 'H1-F1-SENSOR' AND s.MetricCode = 'TEMP' AND s.RecordedAt = @t AND s.Value = 28.5)
        THROW 59999, N'ingest hop le: khong thay so do trong bang', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Devices WHERE Code = 'H1-F1-SENSOR' AND Status = 'ONLINE' AND LastSeenAt = @t)
        THROW 59999, N'ingest hop le: Devices chua ONLINE / LastSeenAt sai', 1;
    IF (SELECT JSON_VALUE(AcceptedJson, '$[0].DeviceCode') FROM #r) <> 'H1-F1-SENSOR'
       OR (SELECT JSON_VALUE(AcceptedJson, '$[0].RecordedAt') FROM #r) <> CONCAT(CONVERT(CHAR(19), @t, 126), 'Z')
       OR (SELECT JSON_VALUE(AcceptedJson, '$[0].HouseId') FROM #r) IS NULL
        THROW 59999, N'ingest hop le: AcceptedJson sai', 1;
    IF (SELECT NewAlertsJson FROM #r) <> N'[]' OR (SELECT ResolvedAlertIdsJson FROM #r) <> N'[]'
        THROW 59999, N'ingest hop le: cot JSON rong phai la []', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'ingest: JSON khong hop le -> 50030';
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_IngestReadings N'khong phai json';
    THROW 59999, N'mong doi 50030', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50030 THROW;
END CATCH
GO

PRINT N'ingest: JSON la object (khong phai mang) -> 50030';
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_IngestReadings N'{"device":"H1-F1-SENSOR"}';
    THROW 59999, N'mong doi 50030', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50030 THROW;
END CATCH
GO

PRINT N'ingest: @StaleMinutes = 0 -> 50042';
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_IngestReadings N'[]', @StaleMinutes = 0;
    THROW 59999, N'mong doi 50042', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

PRINT N'ingest: tung phan tu sai deu bi loai, ca lo khong loi (Review Focus 1)';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @s NVARCHAR(30) = CONCAT(CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), 'Z');
    DECLARE @noZ NVARCHAR(30) = CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126);
    DECLARE @future NVARCHAR(30) = CONCAT(CONVERT(CHAR(19), DATEADD(MINUTE, 10, CAST(SYSUTCDATETIME() AS DATETIME2(0))), 126), 'Z');
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[',
        N'{"device":"H1-F1-SENSOR","metric":"HUMID","value":150,"at":"', @s, N'"},',      -- ngoai [ValidMin,ValidMax]
        N'{"device":"KHONG-CO","metric":"TEMP","value":28,"at":"', @s, N'"},',            -- thiet bi la
        N'{"device":"H1-F1-FAN","metric":"TEMP","value":28,"at":"', @s, N'"},',           -- khong phai SENSOR
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":28,"at":"', @future, N'"},',   -- tuong lai > 5 phut
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":28,"at":"', @noZ, N'"},',      -- thieu Z
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":"abc","at":"', @s, N'"},',     -- value sai kieu
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":null,"at":"', @s, N'"},',      -- value null
        N'{"device":"H1-F1-SENSOR","value":28,"at":"', @s, N'"},',                        -- thieu metric
        N'{"device":"H1-F1-SENSOR","metric":"XYZ","value":28,"at":"', @s, N'"},',         -- chi so la
        N'5]');                                                                            -- khong phai object
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT Received FROM #r) <> 10 OR (SELECT Rejected FROM #r) <> 10 OR (SELECT Accepted FROM #r) <> 0
        THROW 59999, N'ingest phan tu sai: phai Received 10, Rejected 10', 1;
    IF (SELECT AcceptedJson FROM #r) <> N'[]' THROW 59999, N'ingest phan tu sai: AcceptedJson phai rong', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'ingest: trung trong lo va trung voi bang';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @s NVARCHAR(30) = CONCAT(CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), 'Z');
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28,"at":"', @s, N'"},',
                                         N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":28,"at":"', @s, N'"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT Accepted FROM #r) <> 1 OR (SELECT Duplicates FROM #r) <> 1 THROW 59999, N'trung trong lo: phai Accepted 1, Duplicates 1', 1;
    DELETE #r;
    INSERT #r EXEC dbo.sp_IngestReadings @j;   -- gui lai ca lo (MQTT giao lap)
    IF (SELECT Accepted FROM #r) <> 0 OR (SELECT Duplicates FROM #r) <> 2 OR (SELECT Rejected FROM #r) <> 0
        THROW 59999, N'trung voi bang: phai Accepted 0, Duplicates 2', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'ingest: mo canh bao WARNING va CRITICAL';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @s NVARCHAR(30) = CONCAT(CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), 'Z');
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31.5,"at":"', @s, N'"},',   -- lech 5% -> WARNING
                                         N'{"device":"H1-F2-SENSOR","metric":"TEMP","value":34,"at":"', @s, N'"}]');    -- lech 13% -> CRITICAL
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT COUNT(*) FROM OPENJSON((SELECT NewAlertsJson FROM #r))) <> 2 THROW 59999, N'mo canh bao: phai co 2 canh bao moi', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts a JOIN dbo.Zones z ON z.ZoneId = a.ZoneId JOIN dbo.Houses h ON h.HouseId = z.HouseId
                   WHERE h.Name = N'H1' AND z.Name = N'F1' AND a.AlertType = 'THRESHOLD' AND a.MetricCode = 'TEMP'
                     AND a.Severity = 'WARNING' AND a.Status = 'NEW' AND a.Value = 31.5)
        THROW 59999, N'mo canh bao: thieu WARNING H1-F1 TEMP', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts a JOIN dbo.Zones z ON z.ZoneId = a.ZoneId JOIN dbo.Houses h ON h.HouseId = z.HouseId
                   WHERE h.Name = N'H1' AND z.Name = N'F2' AND a.MetricCode = 'TEMP' AND a.Severity = 'CRITICAL')
        THROW 59999, N'mo canh bao: thieu CRITICAL H1-F2 TEMP', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'ingest: hysteresis TEMP 30.2 -> 29.8 -> 29.4 (Max 30, h 0.5)';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @t DATETIME2(0) = CAST(SYSUTCDATETIME() AS DATETIME2(0));
    DECLARE @j NVARCHAR(MAX), @open INT;
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":30.2,"at":"', CONVERT(CHAR(19), DATEADD(SECOND, -3, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    SELECT @open = CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #r;
    IF @open IS NULL THROW 59999, N'hysteresis: 30.2 phai mo canh bao', 1;
    DELETE #r;
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":29.8,"at":"', CONVERT(CHAR(19), DATEADD(SECOND, -2, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT Status FROM dbo.Alerts WHERE AlertId = @open) <> 'NEW' THROW 59999, N'hysteresis: 29.8 nam trong vung dem, phai con mo', 1;
    IF (SELECT ResolvedAlertIdsJson FROM #r) <> N'[]' THROW 59999, N'hysteresis: 29.8 khong duoc dong', 1;
    DELETE #r;
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":29.4,"at":"', CONVERT(CHAR(19), DATEADD(SECOND, -1, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts WHERE AlertId = @open AND Status = 'RESOLVED' AND ResolvedAt IS NOT NULL AND ResolvedBy IS NULL)
        THROW 59999, N'hysteresis: 29.4 phai dong canh bao (he thong)', 1;
    IF (SELECT CAST(JSON_VALUE(ResolvedAlertIdsJson, '$[0].AlertId') AS INT) FROM #r) <> @open
        THROW 59999, N'hysteresis: ResolvedAlertIdsJson phai chua AlertId', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'ingest: nguong chi Max (CO2 1050 -> 980 -> 940, h 50)';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @t DATETIME2(0) = CAST(SYSUTCDATETIME() AS DATETIME2(0));
    DECLARE @j NVARCHAR(MAX), @open INT;
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"CO2","value":1050,"at":"', CONVERT(CHAR(19), DATEADD(SECOND, -3, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    SELECT @open = CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #r;
    IF @open IS NULL THROW 59999, N'CO2: 1050 phai mo canh bao', 1;
    DELETE #r;
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"CO2","value":980,"at":"', CONVERT(CHAR(19), DATEADD(SECOND, -2, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT Status FROM dbo.Alerts WHERE AlertId = @open) <> 'NEW' THROW 59999, N'CO2: 980 phai con mo', 1;
    DELETE #r;
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"CO2","value":940,"at":"', CONVERT(CHAR(19), DATEADD(SECOND, -1, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT Status FROM dbo.Alerts WHERE AlertId = @open) <> 'RESOLVED' THROW 59999, N'CO2: 940 phai dong', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'ingest: so do moi nhat quyet dinh, khong phu thuoc thu tu mang (Review Focus 2)';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @t DATETIME2(0) = CAST(SYSUTCDATETIME() AS DATETIME2(0));
    DECLARE @j NVARCHAR(MAX);
    -- Moi nhat (29) dung truoc, cu hon (35) dung sau -> khong mo canh bao.
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":29,"at":"', CONVERT(CHAR(19), @t, 126), N'Z"},',
                    N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":35,"at":"', CONVERT(CHAR(19), DATEADD(MINUTE, -1, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT NewAlertsJson FROM #r) <> N'[]' THROW 59999, N'thu tu: so do moi nhat 29 khong duoc mo canh bao', 1;
    DELETE #r;
    -- Nguoc lai: cu hon (29) truoc, moi nhat (35) sau -> mo canh bao. Dung khu vuc khac.
    SET @j = CONCAT(N'[{"device":"H1-F2-SENSOR","metric":"TEMP","value":29,"at":"', CONVERT(CHAR(19), DATEADD(MINUTE, -1, @t), 126), N'Z"},',
                    N'{"device":"H1-F2-SENSOR","metric":"TEMP","value":35,"at":"', CONVERT(CHAR(19), @t, 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT COUNT(*) FROM OPENJSON((SELECT NewAlertsJson FROM #r))) <> 1 THROW 59999, N'thu tu: so do moi nhat 35 phai mo canh bao', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'ingest: lo bu den muon (so do cu hon @StaleMinutes)';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @t DATETIME2(0) = CAST(SYSUTCDATETIME() AS DATETIME2(0));
    DECLARE @j NVARCHAR(MAX), @open INT;
    -- 1) So do cu ngoai nguong: luu nhung khong mo canh bao.
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":35,"at":"', CONVERT(CHAR(19), DATEADD(MINUTE, -10, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT Accepted FROM #r) <> 1 OR (SELECT NewAlertsJson FROM #r) <> N'[]'
        THROW 59999, N'lo muon: so do cu phai duoc luu va khong mo canh bao', 1;
    DELETE #r;
    -- 2) Dang co canh bao mo; so do cu trong vung dong khong duoc dong.
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', CONVERT(CHAR(19), DATEADD(SECOND, -5, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    SELECT @open = CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #r;
    IF @open IS NULL THROW 59999, N'lo muon: 31 moi phai mo canh bao', 1;
    DELETE #r;
    SET @j = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28,"at":"', CONVERT(CHAR(19), DATEADD(MINUTE, -9, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT Status FROM dbo.Alerts WHERE AlertId = @open) <> 'NEW' THROW 59999, N'lo muon: so do cu khong duoc dong canh bao', 1;
    DELETE #r;
    -- 3) Lo tron: cu ngoai nguong (H1-F2) + moi trong nguong (H1-F2) -> khong mo.
    SET @j = CONCAT(N'[{"device":"H1-F2-SENSOR","metric":"TEMP","value":35,"at":"', CONVERT(CHAR(19), DATEADD(MINUTE, -8, @t), 126), N'Z"},',
                    N'{"device":"H1-F2-SENSOR","metric":"TEMP","value":28,"at":"', CONVERT(CHAR(19), @t, 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT NewAlertsJson FROM #r) <> N'[]' THROW 59999, N'lo muon: lo tron chi xet so do moi', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'ingest: lo 1000 so do -> NewAlertsJson > 2033 ky tu, dung 1 dong, JSON hop le';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @t DATETIME2(0) = CAST(SYSUTCDATETIME() AS DATETIME2(0));
    DECLARE @j NVARCHAR(MAX) = (
        SELECT TOP (1000) device = d.Code, metric = m.MetricCode,
               value = CASE m.MetricCode WHEN 'TEMP' THEN 35 WHEN 'HUMID' THEN 60 WHEN 'CO2' THEN 1500 ELSE 50 END,
               at = CONCAT(CONVERT(CHAR(19), DATEADD(SECOND, -n.n, @t), 126), 'Z')
        FROM dbo.Devices d
        CROSS JOIN dbo.Metrics m
        CROSS JOIN (SELECT TOP (42) n = ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 FROM sys.all_objects) n
        WHERE d.DeviceType = 'SENSOR'
        ORDER BY n.n, d.Code, m.MetricCode
        FOR JSON PATH);
    INSERT #r EXEC dbo.sp_IngestReadings @j;
    IF (SELECT COUNT(*) FROM #r) <> 1 THROW 59999, N'lo lon: SP phai tra dung 1 dong', 1;
    IF (SELECT Received FROM #r) <> 1000 THROW 59999, N'lo lon: Received phai 1000', 1;
    IF (SELECT ISJSON(NewAlertsJson) FROM #r) <> 1 OR (SELECT ISJSON(AcceptedJson) FROM #r) <> 1
        THROW 59999, N'lo lon: cot JSON khong hop le', 1;
    IF (SELECT LEN(NewAlertsJson) FROM #r) <= 2033 THROW 59999, N'lo lon: NewAlertsJson phai dai hon 2033 ky tu', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO
PRINT N'sp_IngestReadings: PASS';
GO
```

Run: `npm test` → Expected: FAIL `Could not find stored procedure 'dbo.sp_IngestReadings'`.

- [ ] **Step 2: Viết `database/sql/01-views/vw_AlertJson.sql`**

```sql
-- Hinh dang chung cua canh bao trong moi cot JSON tra cho backend (integration-contract 4.2).
CREATE OR ALTER VIEW dbo.vw_AlertJson
AS
SELECT a.AlertId,
       a.HouseId,
       a.ZoneId,
       a.DeviceId,
       a.AlertType,
       a.Severity,
       a.MetricCode,
       a.Value,
       a.DetectedClass,
       a.Confidence,
       HasSnapshot = CAST(CASE WHEN a.SnapshotPath IS NOT NULL THEN 1 ELSE 0 END AS BIT),
       a.Message,
       a.Status,
       CreatedAt = CONCAT(CONVERT(CHAR(19), a.CreatedAt, 126), 'Z')
FROM dbo.Alerts a;
GO
```

- [ ] **Step 3: Viết `database/sql/02-functions-procs/sp_IngestReadings.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_IngestReadings
    @Json         NVARCHAR(MAX),
    @StaleMinutes INT = 2
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Json IS NULL OR ISJSON(@Json) = 0
       OR LEFT(LTRIM(REPLACE(REPLACE(REPLACE(@Json, NCHAR(13), N''), NCHAR(10), N''), NCHAR(9), N'')), 1) <> N'['
        THROW 50030, N'Chuoi JSON khong hop le (can mot mang).', 1;
    IF @StaleMinutes IS NULL OR @StaleMinutes <= 0
        THROW 50042, N'@StaleMinutes phai lon hon 0.', 1;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    DECLARE @StaleBefore DATETIME2(0) = DATEADD(MINUTE, -@StaleMinutes, @Now);

    CREATE TABLE #In (
        Ord        INT           NOT NULL,
        DeviceCode NVARCHAR(200) NULL,
        MetricCode NVARCHAR(50)  NULL,
        ValueText  NVARCHAR(100) NULL,
        AtText     NVARCHAR(100) NULL,
        Value      DECIMAL(9, 2) NULL,
        RecordedAt DATETIME2(0)  NULL,
        DeviceId   INT           NULL,
        ZoneId     INT           NULL,
        HouseId    INT           NULL,
        Status     VARCHAR(10)   NOT NULL DEFAULT 'PENDING');  -- PENDING, ACCEPTED, DUPLICATE, REJECTED

    -- Doc moi phan tu duoi dang chuoi, chuyen kieu bang TRY_CONVERT: phan tu sai kieu bi loai, ca lo khong loi.
    INSERT #In (Ord, DeviceCode, MetricCode, ValueText, AtText)
    SELECT CAST(j.[key] AS INT), x.device, x.metric, x.value, x.at
    FROM OPENJSON(@Json) j
    OUTER APPLY (SELECT * FROM OPENJSON(CASE WHEN j.[type] = 5 THEN j.[value] END)
                 WITH (device NVARCHAR(200) '$.device', metric NVARCHAR(50) '$.metric',
                       value  NVARCHAR(100) '$.value',  at     NVARCHAR(100) '$.at')) x;

    UPDATE #In
    SET Value = TRY_CONVERT(DECIMAL(9, 2), ValueText),
        -- Chi nhan chuoi co hau to Z; cat phan le duoi giay (khong lam tron).
        RecordedAt = CASE WHEN AtText LIKE N'%Z'
                          THEN CAST(DATEADD(MILLISECOND, -DATEPART(MILLISECOND, TRY_CONVERT(DATETIME2(3), AtText, 127)),
                                            TRY_CONVERT(DATETIME2(3), AtText, 127)) AS DATETIME2(0)) END;

    UPDATE i
    SET DeviceId = d.DeviceId, ZoneId = d.ZoneId, HouseId = z.HouseId
    FROM #In i
    JOIN dbo.Devices d ON d.Code = i.DeviceCode AND d.DeviceType = 'SENSOR' AND d.IsActive = 1
    JOIN dbo.Zones z ON z.ZoneId = d.ZoneId;

    UPDATE i
    SET Status = 'REJECTED'
    FROM #In i
    LEFT JOIN dbo.Metrics m ON m.MetricCode = i.MetricCode
    WHERE i.DeviceId IS NULL OR m.MetricCode IS NULL OR i.Value IS NULL OR i.RecordedAt IS NULL
       OR i.Value < m.ValidMin OR i.Value > m.ValidMax
       OR i.RecordedAt > DATEADD(MINUTE, 5, @Now);

    WITH d AS (
        SELECT Status, rn = ROW_NUMBER() OVER (PARTITION BY DeviceId, MetricCode, RecordedAt ORDER BY Ord)
        FROM #In WHERE Status = 'PENDING')
    UPDATE d SET Status = 'DUPLICATE' WHERE rn > 1;

    CREATE TABLE #Eval (
        ZoneId      INT           NOT NULL,
        HouseId     INT           NOT NULL,
        MetricCode  VARCHAR(10)   NOT NULL,
        Value       DECIMAL(9, 2) NOT NULL,
        MinValue    DECIMAL(9, 2) NULL,
        MaxValue    DECIMAL(9, 2) NULL,
        H           DECIMAL(9, 2) NOT NULL,
        OpenAlertId INT           NULL,
        Action      VARCHAR(10)   NULL,
        Severity    VARCHAR(10)   NULL);
    DECLARE @New TABLE (AlertId INT NOT NULL);
    DECLARE @Resolved TABLE (AlertId INT NOT NULL);

    -- He thong thao tac: xoa nguoi thao tac con sot tren ket noi dung lai trong pool.
    EXEC sys.sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sys.sp_set_session_context @key = N'Note', @value = NULL;

    BEGIN TRAN;

    -- Trung voi bang: khoa khoang khoa (HOLDLOCK) de hai lo dong thoi khong cung chen mot dong.
    UPDATE i SET Status = 'DUPLICATE'
    FROM #In i
    WHERE i.Status = 'PENDING'
      AND EXISTS (SELECT 1 FROM dbo.SensorReadings s WITH (UPDLOCK, HOLDLOCK)
                  WHERE s.DeviceId = i.DeviceId AND s.MetricCode = i.MetricCode AND s.RecordedAt = i.RecordedAt);

    INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt)
    SELECT DeviceId, MetricCode, Value, RecordedAt FROM #In WHERE Status = 'PENDING';
    UPDATE #In SET Status = 'ACCEPTED' WHERE Status = 'PENDING';

    UPDATE d
    SET LastSeenAt = CASE WHEN d.LastSeenAt IS NULL OR a.MaxAt > d.LastSeenAt THEN a.MaxAt ELSE d.LastSeenAt END
    FROM dbo.Devices d
    JOIN (SELECT DeviceId, MaxAt = MAX(RecordedAt) FROM #In WHERE Status = 'ACCEPTED' GROUP BY DeviceId) a ON a.DeviceId = d.DeviceId;

    -- Tach rieng: chi dong nao dang khac ONLINE moi bi doi Status (trigger khong chay thua).
    UPDATE d SET Status = 'ONLINE'
    FROM dbo.Devices d
    WHERE d.Status <> 'ONLINE' AND d.DeviceId IN (SELECT DeviceId FROM #In WHERE Status = 'ACCEPTED');

    -- Gia tri moi nhat (khong cu) cua moi (khu vuc, chi so) trong lo.
    INSERT #Eval (ZoneId, HouseId, MetricCode, Value, MinValue, MaxValue, H)
    SELECT x.ZoneId, x.HouseId, x.MetricCode, x.Value, t.MinValue, t.MaxValue,
           CASE WHEN t.MinValue IS NOT NULL AND t.MaxValue IS NOT NULL AND (t.MaxValue - t.MinValue) / 4 < m.Hysteresis
                THEN (t.MaxValue - t.MinValue) / 4 ELSE m.Hysteresis END
    FROM (SELECT ZoneId, HouseId, MetricCode, Value,
                 rn = ROW_NUMBER() OVER (PARTITION BY ZoneId, MetricCode ORDER BY RecordedAt DESC, Ord DESC)
          FROM #In WHERE Status = 'ACCEPTED' AND RecordedAt >= @StaleBefore) x
    JOIN dbo.Thresholds t ON t.ZoneId = x.ZoneId AND t.MetricCode = x.MetricCode
    JOIN dbo.Metrics m ON m.MetricCode = x.MetricCode
    WHERE x.rn = 1;

    -- Doc canh bao dang mo theo thu tu (ZoneId, MetricCode) co dinh -> hai lo khong khoa cheo nhau.
    DECLARE @z INT, @mc VARCHAR(10), @id INT;
    DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT ZoneId, MetricCode FROM #Eval ORDER BY ZoneId, MetricCode;
    OPEN c;
    FETCH NEXT FROM c INTO @z, @mc;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @id = NULL;
        SELECT @id = AlertId FROM dbo.Alerts WITH (UPDLOCK, HOLDLOCK)
        WHERE ZoneId = @z AND MetricCode = @mc AND AlertType = 'THRESHOLD' AND Status <> 'RESOLVED';
        UPDATE #Eval SET OpenAlertId = @id WHERE ZoneId = @z AND MetricCode = @mc;
        FETCH NEXT FROM c INTO @z, @mc;
    END
    CLOSE c;
    DEALLOCATE c;

    UPDATE #Eval
    SET Action = CASE
            WHEN OpenAlertId IS NULL
                 AND ((MinValue IS NOT NULL AND Value < MinValue) OR (MaxValue IS NOT NULL AND Value > MaxValue)) THEN 'OPEN'
            WHEN OpenAlertId IS NOT NULL
                 AND (MinValue IS NULL OR Value >= MinValue + H) AND (MaxValue IS NULL OR Value <= MaxValue - H) THEN 'CLOSE'
        END,
        Severity = CASE
            WHEN (MaxValue IS NOT NULL AND Value > MaxValue AND Value - MaxValue > ABS(MaxValue) * 0.1)
              OR (MinValue IS NOT NULL AND Value < MinValue AND MinValue - Value > ABS(MinValue) * 0.1) THEN 'CRITICAL'
            ELSE 'WARNING'
        END;

    INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message)
    OUTPUT inserted.AlertId INTO @New (AlertId)
    SELECT e.HouseId, e.ZoneId, 'THRESHOLD', e.Severity, e.MetricCode, e.Value,
           CONCAT(m.Name,
                  CASE WHEN e.MaxValue IS NOT NULL AND e.Value > e.MaxValue THEN N' vượt ngưỡng trên ' ELSE N' dưới ngưỡng dưới ' END,
                  CASE WHEN e.MaxValue IS NOT NULL AND e.Value > e.MaxValue THEN e.MaxValue ELSE e.MinValue END,
                  N' ', m.Unit, N': ', e.Value, N' ', m.Unit)
    FROM #Eval e
    JOIN dbo.Metrics m ON m.MetricCode = e.MetricCode
    WHERE e.Action = 'OPEN';

    UPDATE a
    SET Status = 'RESOLVED', ResolvedAt = @Now, ResolvedBy = NULL
    OUTPUT inserted.AlertId INTO @Resolved (AlertId)
    FROM dbo.Alerts a
    JOIN #Eval e ON e.OpenAlertId = a.AlertId
    WHERE e.Action = 'CLOSE';

    COMMIT;

    SELECT
        Received   = (SELECT COUNT(*) FROM #In),
        Accepted   = (SELECT COUNT(*) FROM #In WHERE Status = 'ACCEPTED'),
        Duplicates = (SELECT COUNT(*) FROM #In WHERE Status = 'DUPLICATE'),
        Rejected   = (SELECT COUNT(*) FROM #In WHERE Status = 'REJECTED'),
        AcceptedJson = ISNULL((
            SELECT i.DeviceId, DeviceCode = CAST(i.DeviceCode AS VARCHAR(50)), i.HouseId, i.ZoneId,
                   MetricCode = CAST(i.MetricCode AS VARCHAR(10)), i.Value,
                   RecordedAt = CONCAT(CONVERT(CHAR(19), i.RecordedAt, 126), 'Z')
            FROM #In i WHERE i.Status = 'ACCEPTED' ORDER BY i.Ord
            FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]'),
        NewAlertsJson = ISNULL((
            SELECT v.* FROM dbo.vw_AlertJson v JOIN @New n ON n.AlertId = v.AlertId ORDER BY v.AlertId
            FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]'),
        ResolvedAlertIdsJson = ISNULL((
            SELECT AlertId FROM @Resolved ORDER BY AlertId FOR JSON PATH), N'[]');
END
GO
```

- [ ] **Step 4: Chạy test**

Run: `npm test`
Expected: `sp_IngestReadings: PASS` và mọi file khác đạt. Nếu ca hysteresis hoặc thứ tự mảng lỗi, kiểm `#Eval` bằng cách tạm `SELECT * FROM #Eval` trước `COMMIT` trong một phiên `sqlcmd` riêng (không commit thay đổi đó).

- [ ] **Step 5: Commit**

```bash
git add database/sql/01-views/vw_AlertJson.sql database/sql/02-functions-procs/sp_IngestReadings.sql database/tests/sp_IngestReadings.test.sql
git commit -m "feat(database): sp_IngestReadings thu nhận lô, khử trùng, cảnh báo ngưỡng có hysteresis

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: `sp_SetActuator` (điều khiển tự động/thủ công + nhật ký) — mốc 20/10

**Files:**
- Create: `database/sql/02-functions-procs/sp_SetActuator.sql`, `database/tests/sp_SetActuator.test.sql`

**Interfaces:**
- Consumes: thiết bị seed `H1-F1-FAN` (FAN, AUTO, tắt, Level 0), `H1-F1-MIST` (MIST, AUTO, Level NULL), `H1-F1-SENSOR`; người dùng `owner1`.
- Produces: `EXEC dbo.sp_SetActuator @DeviceId INT, @IsOn BIT, @Level TINYINT = NULL, @Source VARCHAR(6), @Mode VARCHAR(6) = NULL, @UserId INT = NULL, @Reason NVARCHAR(200) = NULL` → 1 dòng `Changed BIT, DeviceCode VARCHAR(50), Mode VARCHAR(6), IsOn BIT, Level TINYINT` (trạng thái **sau** lệnh). `@Level` NULL = giữ mức hiện tại.

- [ ] **Step 1: Viết test (phải fail)**

`database/tests/sp_SetActuator.test.sql`:

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #r (Changed BIT, DeviceCode VARCHAR(50), Mode VARCHAR(6), IsOn BIT, Level TINYINT);
GO

PRINT N'actuator: MANUAL -> AUTO bi bo qua -> MANUAL trung -> tra quyen AUTO';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @fan INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-FAN');
    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    DECLARE @logs0 INT = (SELECT COUNT(*) FROM dbo.ControlLogs WHERE DeviceId = @fan);

    INSERT #r EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 1, @Level = 80, @Source = 'MANUAL', @UserId = @u, @Reason = N'Bật tay';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Changed = 1 AND DeviceCode = 'H1-F1-FAN' AND Mode = 'MANUAL' AND IsOn = 1 AND Level = 80)
        THROW 59999, N'MANUAL: ket qua sai', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Devices WHERE DeviceId = @fan AND Mode = 'MANUAL' AND IsOn = 1 AND Level = 80)
        THROW 59999, N'MANUAL: Devices chua cap nhat', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.ControlLogs WHERE DeviceId = @fan AND Source = 'MANUAL' AND UserId = @u AND IsOn = 1 AND Level = 80 AND Mode = 'MANUAL' AND Reason = N'Bật tay')
        THROW 59999, N'MANUAL: thieu ControlLogs', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 0, @Source = 'AUTO';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Changed = 0 AND Mode = 'MANUAL' AND IsOn = 1)
        THROW 59999, N'AUTO khi dang MANUAL phai bi bo qua', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 1, @Source = 'MANUAL', @UserId = @u;
    IF (SELECT Changed FROM #r) <> 0 THROW 59999, N'MANUAL cung trang thai: Changed phai 0', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 1, @Source = 'MANUAL', @Mode = 'AUTO', @UserId = @u;
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Changed = 1 AND Mode = 'AUTO' AND IsOn = 1)
        THROW 59999, N'tra quyen AUTO: ket qua sai', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 0, @Source = 'AUTO';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Changed = 1 AND Mode = 'AUTO' AND IsOn = 0)
        THROW 59999, N'AUTO sau khi tra quyen phai co hieu luc', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.ControlLogs WHERE DeviceId = @fan AND Source = 'AUTO' AND UserId IS NULL AND IsOn = 0)
        THROW 59999, N'AUTO: thieu ControlLogs', 1;

    IF (SELECT COUNT(*) FROM dbo.ControlLogs WHERE DeviceId = @fan) <> @logs0 + 3
        THROW 59999, N'phai ghi dung 3 dong nhat ky (MANUAL, tra quyen, AUTO)', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'actuator: MIST khong co Level giu NULL';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @mist INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-MIST');
    INSERT #r EXEC dbo.sp_SetActuator @DeviceId = @mist, @IsOn = 1, @Source = 'AUTO';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Changed = 1 AND IsOn = 1 AND Level IS NULL) THROW 59999, N'MIST: Level phai giu NULL', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'actuator: @Source sai -> 50001';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @fan INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-FAN');
    EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 1, @Source = 'ROBOT';
    THROW 59999, N'mong doi 50001', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50001 THROW;
END CATCH
GO

PRINT N'actuator: MANUAL thieu UserId -> 50002';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @fan INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-FAN');
    EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 1, @Source = 'MANUAL';
    THROW 59999, N'mong doi 50002', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50002 THROW;
END CATCH
GO

PRINT N'actuator: cam bien / id la / thiet bi ngung dung -> 50003';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @sensor INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-SENSOR');
    EXEC dbo.sp_SetActuator @DeviceId = @sensor, @IsOn = 1, @Source = 'AUTO';
    THROW 59999, N'cam bien: mong doi 50003', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50003 THROW;
END CATCH
GO
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_SetActuator @DeviceId = -1, @IsOn = 1, @Source = 'AUTO';
    THROW 59999, N'id la: mong doi 50003', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50003 THROW;
END CATCH
GO
BEGIN TRY
    BEGIN TRAN;
    DECLARE @fan INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F2-FAN');
    UPDATE dbo.Devices SET IsActive = 0 WHERE DeviceId = @fan;
    EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 1, @Source = 'AUTO';
    THROW 59999, N'ngung dung: mong doi 50003', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50003 THROW;
END CATCH
GO

PRINT N'actuator: @Mode ngoai mien / @IsOn NULL -> 50042';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @fan INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-FAN');
    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 1, @Source = 'MANUAL', @Mode = 'SEMI', @UserId = @u;
    THROW 59999, N'Mode sai: mong doi 50042', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO
BEGIN TRY
    BEGIN TRAN;
    DECLARE @fan INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-FAN');
    EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = NULL, @Source = 'AUTO';
    THROW 59999, N'IsOn NULL: mong doi 50042', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO

PRINT N'actuator: @Level 150 -> 547, khong ghi nhat ky (Review Focus 3)';
DECLARE @fan INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-FAN');
DECLARE @logsBefore INT = (SELECT COUNT(*) FROM dbo.ControlLogs WHERE DeviceId = @fan);
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_SetActuator @DeviceId = @fan, @IsOn = 1, @Level = 150, @Source = 'AUTO';
    THROW 59999, N'Level 150: mong doi 547', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 547 THROW;
END CATCH
IF (SELECT COUNT(*) FROM dbo.ControlLogs WHERE DeviceId = @fan) <> @logsBefore
    THROW 59999, N'Level 150: khong duoc ghi ControlLogs', 1;
IF EXISTS (SELECT 1 FROM dbo.Devices WHERE DeviceId = @fan AND Level = 150)
    THROW 59999, N'Level 150: Devices khong duoc doi', 1;
GO
PRINT N'sp_SetActuator: PASS';
GO
```

Run: `npm test` → Expected: FAIL `Could not find stored procedure 'dbo.sp_SetActuator'`.

- [ ] **Step 2: Viết `database/sql/02-functions-procs/sp_SetActuator.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_SetActuator
    @DeviceId INT,
    @IsOn     BIT,
    @Level    TINYINT       = NULL,
    @Source   VARCHAR(6),
    @Mode     VARCHAR(6)    = NULL,
    @UserId   INT           = NULL,
    @Reason   NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Source IS NULL OR @Source NOT IN ('AUTO', 'MANUAL')
        THROW 50001, N'@Source phai la AUTO hoac MANUAL.', 1;
    IF @Source = 'MANUAL' AND @UserId IS NULL
        THROW 50002, N'Dieu khien MANUAL can @UserId.', 1;
    IF @IsOn IS NULL OR (@Mode IS NOT NULL AND @Mode NOT IN ('AUTO', 'MANUAL'))
        THROW 50042, N'@IsOn bat buoc; @Mode chi nhan AUTO/MANUAL.', 1;

    DECLARE @Code VARCHAR(50), @CurMode VARCHAR(6), @CurIsOn BIT, @CurLevel TINYINT;
    DECLARE @NewMode VARCHAR(6), @NewIsOn BIT, @NewLevel TINYINT, @Changed BIT = 0;

    BEGIN TRAN;

    SELECT @Code = Code, @CurMode = Mode, @CurIsOn = IsOn, @CurLevel = Level
    FROM dbo.Devices WITH (UPDLOCK, ROWLOCK)
    WHERE DeviceId = @DeviceId AND IsActive = 1 AND DeviceType IN ('MIST', 'FAN', 'HEATER', 'SPEAKER');

    IF @Code IS NULL
        THROW 50003, N'Thiet bi khong ton tai, ngung dung hoac khong phai co cau chap hanh.', 1;

    IF @Source = 'AUTO' AND @CurMode = 'MANUAL'
    BEGIN
        -- Lenh tu dong bi bo qua khi nguoi dung dang ghi de.
        SELECT @NewMode = @CurMode, @NewIsOn = @CurIsOn, @NewLevel = @CurLevel;
    END
    ELSE
    BEGIN
        SELECT @NewMode  = CASE WHEN @Source = 'AUTO' THEN 'AUTO' ELSE ISNULL(@Mode, 'MANUAL') END,
               @NewIsOn  = @IsOn,
               @NewLevel = CASE WHEN @Level IS NULL THEN @CurLevel ELSE @Level END;
        IF @NewMode <> @CurMode OR @NewIsOn <> @CurIsOn OR ISNULL(CAST(@NewLevel AS INT), -1) <> ISNULL(CAST(@CurLevel AS INT), -1)
            SET @Changed = 1;
    END

    IF @Changed = 1
    BEGIN
        UPDATE dbo.Devices SET Mode = @NewMode, IsOn = @NewIsOn, Level = @NewLevel WHERE DeviceId = @DeviceId;
        INSERT dbo.ControlLogs (DeviceId, IsOn, Level, Mode, Source, UserId, Reason)
        VALUES (@DeviceId, @NewIsOn, @NewLevel, @NewMode, @Source, @UserId, @Reason);
    END

    COMMIT;

    SELECT Changed = @Changed, DeviceCode = @Code, Mode = @NewMode, IsOn = @NewIsOn, Level = @NewLevel;
END
GO
```

- [ ] **Step 3: Chạy test**

Run: `npm test`
Expected: `sp_SetActuator: PASS`, mọi file khác đạt.

- [ ] **Step 4: Commit**

```bash
git add database/sql/02-functions-procs/sp_SetActuator.sql database/tests/sp_SetActuator.test.sql
git commit -m "feat(database): sp_SetActuator điều khiển AUTO/MANUAL, trả quyền, ghi nhật ký

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Kiểm chứng R3, R6 và mốc 20/10

**Files:**
- Create: `database/spikes/r3-r6-prisma-sp.ts`
- Modify: `database/spikes/RESULTS.md`

**Interfaces:**
- Consumes: `sp_IngestReadings` (Task 4), Prisma Client (Task 3).
- Produces: kết luận R3, R6 cho backend (cấu hình adapter `options.useUTC: true`; `$queryRaw` + SP trả 1 tập kết quả).

- [ ] **Step 1: Viết `database/spikes/r3-r6-prisma-sp.ts`**

```ts
// R3: $queryRaw chi doc tap ket qua dau? R6: DATETIME2 doc/ghi qua adapter-mssql co lech gio khong?
import 'dotenv/config';
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '../generated/prisma/client';

const adapter = new PrismaMssql({
  server: process.env.DB_SERVER!,
  port: Number(process.env.DB_PORT),
  database: 'SwiftletCare_Dev',
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  options: { encrypt: false, trustServerCertificate: true, useUTC: true },
});
const prisma = new PrismaClient({ adapter });

const AT = '2026-10-13T10:00:07Z'; // sau du lieu mau (ket thuc 2026-10-12), le khoi luoi 5 phut

async function main() {
  const json = JSON.stringify([{ device: 'H1-F1-SENSOR', metric: 'TEMP', value: 28.5, at: AT }]);
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`EXEC dbo.sp_IngestReadings @Json = ${json}`;
  console.log('R3/R6 ket qua SP:', rows);

  const two = await prisma.$queryRawUnsafe<Record<string, unknown>[]>('SELECT 1 AS a; SELECT 2 AS b;');
  console.log('R3 hai tap ket qua ->', JSON.stringify(two));

  const r = await prisma.sensorReadings.findFirstOrThrow({
    where: { Device: { Code: 'H1-F1-SENSOR' }, MetricCode: 'TEMP', RecordedAt: new Date(AT) },
  });
  const iso = r.RecordedAt.toISOString();
  console.log(`R6 doc lai: ${iso} (mong doi 2026-10-13T10:00:07.000Z) -> ${iso === '2026-10-13T10:00:07.000Z' ? 'DUNG' : 'LECH'}`);
  console.log(`Decimal tra ve kieu: ${r.Value.constructor.name}, JSON.stringify -> ${JSON.stringify({ v: r.Value })}`);
  await prisma.$disconnect();
}
main();
```

- [ ] **Step 2: Chạy**

```powershell
npx tsx spikes/r3-r6-prisma-sp.ts
sqlcmd -S localhost,1433 -U swiftlet_dev -d SwiftletCare_Dev -Q "SELECT RecordedAt FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId WHERE d.Code = 'H1-F1-SENSOR' AND s.RecordedAt = '2026-10-13T10:00:07'"
```

Expected:
- Dòng kết quả SP có `Received: 1`, `Accepted: 1` (lần chạy lại: `Duplicates: 1`), các cột JSON là chuỗi.
- `R3 hai tap ket qua -> [{"a":1}]` (chỉ tập đầu) → xác nhận quy ước 1 tập kết quả/SP là cần thiết.
- `R6 doc lai: 2026-10-13T10:00:07.000Z … -> DUNG`; `sqlcmd` in `2026-10-13 10:00:07`.
- `Decimal tra ve kieu: Decimal, JSON.stringify -> {"v":"28.5"}` → xác nhận backend phải đổi Decimal sang number (integration-contract 1.3).

Nếu R6 in `LECH`: thử lại với `useUTC: false` để xác định hướng lệch, ghi cả hai kết quả; backend dùng cấu hình cho ra `DUNG`.

- [ ] **Step 3: Ghi `spikes/RESULTS.md` mục R3, R6 (nguyên văn output) rồi kiểm mốc 20/10**

Trên một máy sạch (hoặc sau `Remove-Item -Recurse node_modules, generated`): `npm install`, `npm test` → `Tat ca test dat`; `npm run reset:dev` chạy không lỗi. Báo TV2 (backend) và TV5 (simulator): có thể nối `sp_IngestReadings`, `sp_SetActuator`.

- [ ] **Step 4: Commit**

```bash
git add database/spikes/r3-r6-prisma-sp.ts database/spikes/RESULTS.md
git commit -m "test(database): kiểm chứng R3, R6 qua Prisma 7 + adapter-mssql

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: `trg_Alerts_History` và `sp_UpdateAlertStatus`

**Files:**
- Create: `database/sql/03-triggers/trg_Alerts_History.sql`, `database/sql/02-functions-procs/sp_UpdateAlertStatus.sql`, `database/tests/sp_UpdateAlertStatus.test.sql`, `database/tests/trg_Alerts_History.test.sql`

**Interfaces:**
- Consumes: `sp_IngestReadings` (tạo cảnh báo trong test).
- Produces:
  - Trigger ghi `AlertHistory` khi cảnh báo được tạo hoặc đổi `Status`; người thao tác/ghi chú lấy từ `SESSION_CONTEXT(N'UserId')` (INT) và `SESSION_CONTEXT(N'Note')` (NVARCHAR).
  - `EXEC dbo.sp_UpdateAlertStatus @AlertId INT, @Status VARCHAR(10), @UserId INT, @Note NVARCHAR(500) = NULL` → 1 dòng `AlertId INT, HouseId INT, ZoneId INT, AlertType VARCHAR(20), Status VARCHAR(10), ResolvedAt DATETIME2(0), ResolvedBy INT` (đủ cho sự kiện `alert.updated`). `@UserId` NULL → 50042.

**Lưu ý khi viết test ca lỗi có kiểm `AlertHistory`:** lỗi trong SP (có `XACT_ABORT`) hủy cả transaction bao ngoài, nên "không thêm dòng lịch sử" và "SESSION_CONTEXT đã xóa" được kiểm bằng một lần gọi **ngoài transaction** với `@AlertId = -1` (lỗi 50020 — SP đã đặt SESSION_CONTEXT trước khi kiểm tra). Lỗi 50021 kiểm số lỗi trong transaction riêng như thường.

- [ ] **Step 1: Viết test `database/tests/sp_UpdateAlertStatus.test.sql` (phải fail)**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #ing (Received INT, Accepted INT, Duplicates INT, Rejected INT, AcceptedJson NVARCHAR(MAX), NewAlertsJson NVARCHAR(MAX), ResolvedAlertIdsJson NVARCHAR(MAX));
CREATE TABLE #r (AlertId INT, HouseId INT, ZoneId INT, AlertType VARCHAR(20), Status VARCHAR(10), ResolvedAt DATETIME2(0), ResolvedBy INT);
GO

PRINT N'alert status: NEW -> ACK -> RESOLVED';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), N'Z"}]');
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    DECLARE @a INT = (SELECT CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #ing);
    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    INSERT #r EXEC dbo.sp_UpdateAlertStatus @AlertId = @a, @Status = 'ACK', @UserId = @u, @Note = N'Đã kiểm tra';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE AlertId = @a AND Status = 'ACK' AND ResolvedAt IS NULL AND ResolvedBy IS NULL AND HouseId IS NOT NULL)
        THROW 59999, N'ACK: ket qua sai', 1;
    DELETE #r;
    INSERT #r EXEC dbo.sp_UpdateAlertStatus @AlertId = @a, @Status = 'RESOLVED', @UserId = @u;
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Status = 'RESOLVED' AND ResolvedAt IS NOT NULL AND ResolvedBy = @u)
        THROW 59999, N'RESOLVED: phai co ResolvedAt va ResolvedBy', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'alert status: NEW -> RESOLVED truc tiep';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), N'Z"}]');
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    DECLARE @a INT = (SELECT CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #ing);
    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    INSERT #r EXEC dbo.sp_UpdateAlertStatus @AlertId = @a, @Status = 'RESOLVED', @UserId = @u;
    IF (SELECT Status FROM #r) <> 'RESOLVED' THROW 59999, N'NEW -> RESOLVED phai hop le', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'alert status: ve NEW / tu RESOLVED / trang thai la -> 50021';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), N'Z"}]');
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    DECLARE @a INT = (SELECT CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #ing);
    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    EXEC dbo.sp_UpdateAlertStatus @AlertId = @a, @Status = 'NEW', @UserId = @u;
    THROW 59999, N'NEW -> NEW: mong doi 50021', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50021 THROW;
END CATCH
GO
BEGIN TRY
    BEGIN TRAN;
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), N'Z"}]');
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    DECLARE @a INT = (SELECT CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #ing);
    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    EXEC dbo.sp_UpdateAlertStatus @AlertId = @a, @Status = 'RESOLVED', @UserId = @u;
    EXEC dbo.sp_UpdateAlertStatus @AlertId = @a, @Status = 'ACK', @UserId = @u;
    THROW 59999, N'RESOLVED -> ACK: mong doi 50021', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50021 THROW;
END CATCH
GO
BEGIN TRY
    BEGIN TRAN;
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), N'Z"}]');
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    DECLARE @a INT = (SELECT CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #ing);
    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    EXEC dbo.sp_UpdateAlertStatus @AlertId = @a, @Status = 'DONE', @UserId = @u;
    THROW 59999, N'trang thai la: mong doi 50021', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50021 THROW;
END CATCH
GO

PRINT N'alert status: canh bao khong ton tai -> 50020; thieu UserId -> 50042';
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_UpdateAlertStatus @AlertId = -1, @Status = 'ACK', @UserId = 1;
    THROW 59999, N'mong doi 50020', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50020 THROW;
END CATCH
GO
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_UpdateAlertStatus @AlertId = 1, @Status = 'ACK', @UserId = NULL;
    THROW 59999, N'mong doi 50042', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO
PRINT N'sp_UpdateAlertStatus: PASS';
GO
```

- [ ] **Step 2: Viết test `database/tests/trg_Alerts_History.test.sql` (phải fail)**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #ing (Received INT, Accepted INT, Duplicates INT, Rejected INT, AcceptedJson NVARCHAR(MAX), NewAlertsJson NVARCHAR(MAX), ResolvedAlertIdsJson NVARCHAR(MAX));
CREATE TABLE #r (AlertId INT, HouseId INT, ZoneId INT, AlertType VARCHAR(20), Status VARCHAR(10), ResolvedAt DATETIME2(0), ResolvedBy INT);
GO

PRINT N'trigger: tao canh bao -> 1 dong lich su (he thong); ACK -> 1 dong co UserId/Note tieng Viet (Review Focus 4)';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), N'Z"}]');
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    DECLARE @a INT = (SELECT CAST(JSON_VALUE(NewAlertsJson, '$[0].AlertId') AS INT) FROM #ing);
    IF (SELECT COUNT(*) FROM dbo.AlertHistory WHERE AlertId = @a) <> 1
       OR NOT EXISTS (SELECT 1 FROM dbo.AlertHistory WHERE AlertId = @a AND OldStatus IS NULL AND NewStatus = 'NEW' AND UserId IS NULL AND Note IS NULL)
        THROW 59999, N'trigger: tao canh bao phai sinh dung 1 dong (NULL -> NEW, he thong)', 1;

    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    INSERT #r EXEC dbo.sp_UpdateAlertStatus @AlertId = @a, @Status = 'ACK', @UserId = @u, @Note = N'Đã kiểm tra, rắn bò ra cửa';
    IF (SELECT COUNT(*) FROM dbo.AlertHistory WHERE AlertId = @a) <> 2
       OR NOT EXISTS (SELECT 1 FROM dbo.AlertHistory WHERE AlertId = @a AND OldStatus = 'NEW' AND NewStatus = 'ACK'
                      AND UserId = @u AND Note = N'Đã kiểm tra, rắn bò ra cửa')
        THROW 59999, N'trigger: ACK phai them dung 1 dong voi UserId va Note giu nguyen dau', 1;
    IF SESSION_CONTEXT(N'UserId') IS NOT NULL OR SESSION_CONTEXT(N'Note') IS NOT NULL
        THROW 59999, N'trigger: SESSION_CONTEXT phai duoc xoa sau khi SP xong', 1;

    -- Cap nhat khong doi Status khong sinh lich su.
    UPDATE dbo.Alerts SET Message = N'sửa nội dung' WHERE AlertId = @a;
    IF (SELECT COUNT(*) FROM dbo.AlertHistory WHERE AlertId = @a) <> 2
        THROW 59999, N'trigger: doi cot khac Status khong duoc sinh lich su', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'trigger: mot lenh UPDATE doi 2 canh bao -> dung 2 dong (theo tap hop)';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @s NVARCHAR(30) = CONCAT(CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), 'Z');
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', @s, N'"},',
                                         N'{"device":"H1-F2-SENSOR","metric":"TEMP","value":31,"at":"', @s, N'"}]');
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    DECLARE @ids TABLE (AlertId INT);
    INSERT @ids SELECT CAST(JSON_VALUE(value, '$.AlertId') AS INT) FROM OPENJSON((SELECT NewAlertsJson FROM #ing));
    IF (SELECT COUNT(*) FROM @ids) <> 2 THROW 59999, N'trigger tap hop: can 2 canh bao', 1;
    DECLARE @before INT = (SELECT COUNT(*) FROM dbo.AlertHistory);
    UPDATE dbo.Alerts SET Status = 'ACK' WHERE AlertId IN (SELECT AlertId FROM @ids);
    IF (SELECT COUNT(*) FROM dbo.AlertHistory) <> @before + 2
        THROW 59999, N'trigger tap hop: phai sinh dung 2 dong', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'trigger: SP loi van xoa SESSION_CONTEXT va khong them lich su';
DECLARE @before INT = (SELECT COUNT(*) FROM dbo.AlertHistory);
BEGIN TRY
    -- Goi ngoai transaction: SP dat SESSION_CONTEXT roi moi phat hien canh bao khong ton tai.
    EXEC dbo.sp_UpdateAlertStatus @AlertId = -1, @Status = 'ACK', @UserId = 1, @Note = N'không được lưu';
    THROW 59999, N'mong doi 50020', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50020 THROW;
END CATCH
IF SESSION_CONTEXT(N'UserId') IS NOT NULL OR SESSION_CONTEXT(N'Note') IS NOT NULL
    THROW 59999, N'trigger: SESSION_CONTEXT phai NULL sau khi SP loi', 1;
IF (SELECT COUNT(*) FROM dbo.AlertHistory) <> @before
    THROW 59999, N'trigger: SP loi khong duoc them lich su', 1;
GO
PRINT N'trg_Alerts_History: PASS';
GO
```

Run: `npm test` → Expected: FAIL `Could not find stored procedure 'dbo.sp_UpdateAlertStatus'`.

- [ ] **Step 3: Viết `database/sql/03-triggers/trg_Alerts_History.sql`**

```sql
CREATE OR ALTER TRIGGER dbo.trg_Alerts_History
ON dbo.Alerts
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;

    -- Nguoi thao tac do sp_UpdateAlertStatus dat; NULL = he thong.
    DECLARE @UserId INT = CAST(SESSION_CONTEXT(N'UserId') AS INT);
    DECLARE @Note NVARCHAR(500) = CAST(SESSION_CONTEXT(N'Note') AS NVARCHAR(500));

    INSERT dbo.AlertHistory (AlertId, OldStatus, NewStatus, UserId, Note)
    SELECT i.AlertId, d.Status, i.Status, @UserId, @Note
    FROM inserted i
    LEFT JOIN deleted d ON d.AlertId = i.AlertId
    WHERE d.AlertId IS NULL OR d.Status <> i.Status;
END
GO
```

- [ ] **Step 4: Viết `database/sql/02-functions-procs/sp_UpdateAlertStatus.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_UpdateAlertStatus
    @AlertId INT,
    @Status  VARCHAR(10),
    @UserId  INT,
    @Note    NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @UserId IS NULL
        THROW 50042, N'@UserId bat buoc.', 1;

    DECLARE @Cur VARCHAR(10);

    BEGIN TRY
        EXEC sys.sp_set_session_context @key = N'UserId', @value = @UserId;
        EXEC sys.sp_set_session_context @key = N'Note', @value = @Note;

        BEGIN TRAN;
        SELECT @Cur = Status FROM dbo.Alerts WITH (UPDLOCK, ROWLOCK) WHERE AlertId = @AlertId;
        IF @Cur IS NULL
            THROW 50020, N'Canh bao khong ton tai.', 1;
        IF NOT ((@Cur = 'NEW' AND @Status IN ('ACK', 'RESOLVED')) OR (@Cur = 'ACK' AND @Status = 'RESOLVED'))
            THROW 50021, N'Chuyen trang thai canh bao khong hop le.', 1;

        UPDATE dbo.Alerts
        SET Status     = @Status,
            ResolvedAt = CASE WHEN @Status = 'RESOLVED' THEN SYSUTCDATETIME() END,
            ResolvedBy = CASE WHEN @Status = 'RESOLVED' THEN @UserId END
        WHERE AlertId = @AlertId;
        COMMIT;

        -- Ket noi duoc dung lai trong pool: xoa ngay.
        EXEC sys.sp_set_session_context @key = N'UserId', @value = NULL;
        EXEC sys.sp_set_session_context @key = N'Note', @value = NULL;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK;
        EXEC sys.sp_set_session_context @key = N'UserId', @value = NULL;
        EXEC sys.sp_set_session_context @key = N'Note', @value = NULL;
        THROW;
    END CATCH

    SELECT AlertId, HouseId, ZoneId, AlertType, Status, ResolvedAt, ResolvedBy
    FROM dbo.Alerts WHERE AlertId = @AlertId;
END
GO
```

- [ ] **Step 5: Chạy test**

Run: `npm test`
Expected: `sp_UpdateAlertStatus: PASS`, `trg_Alerts_History: PASS`; các test cũ (`sp_IngestReadings`) vẫn đạt khi Alerts đã có trigger (SP dùng `OUTPUT … INTO`, hợp lệ với bảng có trigger).

- [ ] **Step 6: Commit**

```bash
git add database/sql/03-triggers/trg_Alerts_History.sql database/sql/02-functions-procs/sp_UpdateAlertStatus.sql database/tests/sp_UpdateAlertStatus.test.sql database/tests/trg_Alerts_History.test.sql
git commit -m "feat(database): trg_Alerts_History và sp_UpdateAlertStatus (SESSION_CONTEXT, xóa kể cả khi lỗi)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: View đọc số đo/cảnh báo và `sp_GetReadingHistory`

**Files:**
- Create: `database/sql/01-views/vw_LatestReadings.sql`, `database/sql/01-views/vw_OpenAlerts.sql`, `database/sql/01-views/vw_DailyEnvStats.sql`, `database/sql/02-functions-procs/sp_GetReadingHistory.sql`, `database/tests/views.test.sql`, `database/tests/sp_GetReadingHistory.test.sql`

**Interfaces:**
- Produces:
  - `dbo.vw_LatestReadings(HouseId, HouseName, ZoneId, ZoneName, FloorNo, DeviceId, DeviceCode, DeviceStatus, LastSeenAt, MetricCode, MetricName, Unit, Value, RecordedAt)` — một dòng mỗi cảm biến đang dùng × chỉ số có dữ liệu; không có `ReadingId`.
  - `dbo.vw_OpenAlerts(AlertId, HouseId, HouseName, ZoneId, ZoneName, DeviceId, DeviceCode, AlertType, Severity, MetricCode, Value, DetectedClass, Confidence, HasSnapshot, Message, Status, CreatedAt)` — `Status <> 'RESOLVED'`.
  - `dbo.vw_DailyEnvStats(HouseId, ZoneId, MetricCode, DayVn DATE, AvgValue, MinValue, MaxValue, Samples)`.
  - `EXEC dbo.sp_GetReadingHistory @ZoneId INT, @MetricCode VARCHAR(10), @FromUtc DATETIME2(0), @ToUtc DATETIME2(0), @BucketMinutes INT = 60` → nhiều dòng `BucketUtc DATETIME2(0), AvgValue DECIMAL(9,2), MinValue DECIMAL(9,2), MaxValue DECIMAL(9,2)`; bucket neo theo `@FromUtc`, `@ToUtc` loại trừ, chỉ trả bucket có dữ liệu.

Test dùng mốc tháng 9/2026 — trước dữ liệu mẫu (bắt đầu 2026-10-05), không trùng seed.

- [ ] **Step 1: Viết test `database/tests/sp_GetReadingHistory.test.sql` (phải fail)**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #r (BucketUtc DATETIME2(0), AvgValue DECIMAL(9, 2), MinValue DECIMAL(9, 2), MaxValue DECIMAL(9, 2));
GO

PRINT N'history: gom theo gio, To loai tru';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @dev INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F1-SENSOR');
    DECLARE @zone INT = (SELECT ZoneId FROM dbo.Devices WHERE Code = 'H1-F1-SENSOR');
    INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt) VALUES
        (@dev, 'TEMP', 27, '2026-09-01T00:00:00'), (@dev, 'TEMP', 29, '2026-09-01T00:30:00'),
        (@dev, 'TEMP', 28, '2026-09-01T01:15:00'),
        (@dev, 'TEMP', 26, '2026-09-01T02:59:59'),
        (@dev, 'TEMP', 40, '2026-09-01T03:00:00');   -- dung bang @ToUtc -> loai
    INSERT #r EXEC dbo.sp_GetReadingHistory @zone, 'TEMP', '2026-09-01T00:00:00', '2026-09-01T03:00:00', 60;
    IF (SELECT COUNT(*) FROM #r) <> 3 THROW 59999, N'history: phai co 3 bucket', 1;
    IF NOT EXISTS (SELECT 1 FROM #r WHERE BucketUtc = '2026-09-01T00:00:00' AND AvgValue = 28 AND MinValue = 27 AND MaxValue = 29)
        THROW 59999, N'history: bucket 00:00 sai', 1;
    IF NOT EXISTS (SELECT 1 FROM #r WHERE BucketUtc = '2026-09-01T02:00:00' AND AvgValue = 26)
        THROW 59999, N'history: bucket 02:00 sai', 1;
    IF EXISTS (SELECT 1 FROM #r WHERE MaxValue = 40) THROW 59999, N'history: so do tai @ToUtc phai bi loai', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'history: khoang khong co du lieu -> 0 dong, khong loi (Review Focus 5)';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @zone INT = (SELECT ZoneId FROM dbo.Devices WHERE Code = 'H1-F1-SENSOR');
    INSERT #r EXEC dbo.sp_GetReadingHistory @zone, 'TEMP', '2026-08-01T00:00:00', '2026-08-02T00:00:00', 60;
    IF (SELECT COUNT(*) FROM #r) <> 0 THROW 59999, N'history: khoang rong phai tra 0 dong', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'history: From >= To -> 50041';
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_GetReadingHistory 1, 'TEMP', '2026-09-02T00:00:00', '2026-09-01T00:00:00', 60;
    THROW 59999, N'mong doi 50041', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50041 THROW;
END CATCH
GO

PRINT N'history: BucketMinutes 0 -> 50040';
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_GetReadingHistory 1, 'TEMP', '2026-09-01T00:00:00', '2026-09-02T00:00:00', 0;
    THROW 59999, N'mong doi 50040', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50040 THROW;
END CATCH
GO

PRINT N'history: qua 2000 bucket -> 50042';
BEGIN TRY
    BEGIN TRAN;
    EXEC dbo.sp_GetReadingHistory 1, 'TEMP', '2026-01-01T00:00:00', '2026-12-31T00:00:00', 1;
    THROW 59999, N'mong doi 50042', 1;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    IF ERROR_NUMBER() <> 50042 THROW;
END CATCH
GO
PRINT N'sp_GetReadingHistory: PASS';
GO
```

- [ ] **Step 2: Viết test `database/tests/views.test.sql` (phải fail)**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
PRINT N'views: vw_LatestReadings lay so do moi nhat';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @dev INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H2-F1-SENSOR');
    DECLARE @t DATETIME2(0) = CAST(SYSUTCDATETIME() AS DATETIME2(0));
    INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt) VALUES
        (@dev, 'TEMP', 27.1, DATEADD(MINUTE, -10, @t)), (@dev, 'TEMP', 28.9, @t);
    IF NOT EXISTS (SELECT 1 FROM dbo.vw_LatestReadings WHERE DeviceCode = 'H2-F1-SENSOR' AND MetricCode = 'TEMP' AND Value = 28.9 AND RecordedAt = @t AND HouseName = N'H2')
        THROW 59999, N'vw_LatestReadings: phai tra 28.9 moi nhat', 1;
    IF (SELECT COUNT(*) FROM dbo.vw_LatestReadings WHERE DeviceCode = 'H2-F1-SENSOR' AND MetricCode = 'TEMP') <> 1
        THROW 59999, N'vw_LatestReadings: moi (thiet bi, chi so) mot dong', 1;
    IF COL_LENGTH('dbo.vw_LatestReadings', 'ReadingId') IS NOT NULL
        THROW 59999, N'vw_LatestReadings: khong duoc co ReadingId', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'views: vw_OpenAlerts chi chua canh bao chua dong';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @h INT = (SELECT HouseId FROM dbo.Houses WHERE Name = N'H2');
    DECLARE @z INT = (SELECT ZoneId FROM dbo.Zones WHERE HouseId = @h AND Name = N'F1');
    INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message)
        VALUES (@h, @z, 'THRESHOLD', 'WARNING', 'TEMP', 31, N'mở');
    DECLARE @open INT = SCOPE_IDENTITY();
    INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message, Status, ResolvedAt)
        VALUES (@h, @z, 'THRESHOLD', 'WARNING', 'HUMID', 70, N'đóng', 'RESOLVED', SYSUTCDATETIME());
    DECLARE @closed INT = SCOPE_IDENTITY();
    IF NOT EXISTS (SELECT 1 FROM dbo.vw_OpenAlerts WHERE AlertId = @open AND HouseName = N'H2' AND ZoneName = N'F1')
        THROW 59999, N'vw_OpenAlerts: thieu canh bao dang mo', 1;
    IF EXISTS (SELECT 1 FROM dbo.vw_OpenAlerts WHERE AlertId = @closed)
        THROW 59999, N'vw_OpenAlerts: khong duoc co canh bao da dong', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'views: vw_DailyEnvStats gom theo ngay gio Viet Nam';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @dev INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H2-F1-SENSOR');
    -- 16:30Z = 23:30 ngay 01/09 gio VN; 17:30Z = 00:30 ngay 02/09 gio VN.
    INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt) VALUES
        (@dev, 'HUMID', 80, '2026-09-01T16:30:00'), (@dev, 'HUMID', 84, '2026-09-01T17:30:00');
    IF NOT EXISTS (SELECT 1 FROM dbo.vw_DailyEnvStats s JOIN dbo.Devices d ON d.ZoneId = s.ZoneId
                   WHERE d.DeviceId = @dev AND s.MetricCode = 'HUMID' AND s.DayVn = '2026-09-01' AND s.AvgValue = 80 AND s.Samples = 1)
        THROW 59999, N'vw_DailyEnvStats: 16:30Z phai thuoc ngay 01/09 gio VN', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.vw_DailyEnvStats s JOIN dbo.Devices d ON d.ZoneId = s.ZoneId
                   WHERE d.DeviceId = @dev AND s.MetricCode = 'HUMID' AND s.DayVn = '2026-09-02' AND s.AvgValue = 84)
        THROW 59999, N'vw_DailyEnvStats: 17:30Z phai thuoc ngay 02/09 gio VN', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO
PRINT N'views: PASS';
GO
```

Run: `npm test` → Expected: FAIL `Could not find stored procedure 'dbo.sp_GetReadingHistory'` / `Invalid object name 'dbo.vw_LatestReadings'`.

- [ ] **Step 3: Viết ba view**

`database/sql/01-views/vw_LatestReadings.sql`:

```sql
CREATE OR ALTER VIEW dbo.vw_LatestReadings
AS
SELECT h.HouseId, HouseName = h.Name, z.ZoneId, ZoneName = z.Name, z.FloorNo,
       d.DeviceId, DeviceCode = d.Code, DeviceStatus = d.Status, d.LastSeenAt,
       m.MetricCode, MetricName = m.Name, m.Unit, r.Value, r.RecordedAt
FROM dbo.Devices d
JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
JOIN dbo.Houses h ON h.HouseId = z.HouseId
CROSS JOIN dbo.Metrics m
CROSS APPLY (SELECT TOP (1) s.Value, s.RecordedAt
             FROM dbo.SensorReadings s
             WHERE s.DeviceId = d.DeviceId AND s.MetricCode = m.MetricCode
             ORDER BY s.RecordedAt DESC) r
WHERE d.DeviceType = 'SENSOR' AND d.IsActive = 1 AND h.IsActive = 1;
GO
```

`database/sql/01-views/vw_OpenAlerts.sql`:

```sql
CREATE OR ALTER VIEW dbo.vw_OpenAlerts
AS
SELECT a.AlertId, a.HouseId, HouseName = h.Name, a.ZoneId, ZoneName = z.Name, a.DeviceId, DeviceCode = d.Code,
       a.AlertType, a.Severity, a.MetricCode, a.Value, a.DetectedClass, a.Confidence,
       HasSnapshot = CAST(CASE WHEN a.SnapshotPath IS NOT NULL THEN 1 ELSE 0 END AS BIT),
       a.Message, a.Status, a.CreatedAt
FROM dbo.Alerts a
JOIN dbo.Houses h ON h.HouseId = a.HouseId
LEFT JOIN dbo.Zones z ON z.ZoneId = a.ZoneId
LEFT JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
WHERE a.Status <> 'RESOLVED';
GO
```

`database/sql/01-views/vw_DailyEnvStats.sql`:

```sql
-- Loc theo DayVn tren view nay khong SARGable; truy van khoang lon dung sp_GetReadingHistory.
CREATE OR ALTER VIEW dbo.vw_DailyEnvStats
AS
SELECT z.HouseId, z.ZoneId, s.MetricCode,
       DayVn = CAST(s.RecordedAt AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATE),
       AvgValue = CAST(AVG(s.Value) AS DECIMAL(9, 2)),
       MinValue = MIN(s.Value),
       MaxValue = MAX(s.Value),
       Samples  = COUNT(*)
FROM dbo.SensorReadings s
JOIN dbo.Devices d ON d.DeviceId = s.DeviceId
JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
GROUP BY z.HouseId, z.ZoneId, s.MetricCode,
         CAST(s.RecordedAt AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATE);
GO
```

- [ ] **Step 4: Viết `database/sql/02-functions-procs/sp_GetReadingHistory.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_GetReadingHistory
    @ZoneId        INT,
    @MetricCode    VARCHAR(10),
    @FromUtc       DATETIME2(0),
    @ToUtc         DATETIME2(0),
    @BucketMinutes INT = 60
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @BucketMinutes IS NULL OR @BucketMinutes <= 0
        THROW 50040, N'@BucketMinutes phai lon hon 0.', 1;
    IF @FromUtc IS NULL OR @ToUtc IS NULL OR @FromUtc >= @ToUtc
        THROW 50041, N'Khoang thoi gian khong hop le (From >= To).', 1;
    IF (DATEDIFF(MINUTE, @FromUtc, @ToUtc) + @BucketMinutes - 1) / @BucketMinutes > 2000
        THROW 50042, N'Qua 2000 bucket, tang @BucketMinutes hoac thu hep khoang.', 1;

    -- Dieu kien thoi gian so truc tiep voi cot (SARGable).
    SELECT BucketUtc = DATEADD(MINUTE, (DATEDIFF(MINUTE, @FromUtc, s.RecordedAt) / @BucketMinutes) * @BucketMinutes, @FromUtc),
           AvgValue  = CAST(AVG(s.Value) AS DECIMAL(9, 2)),
           MinValue  = MIN(s.Value),
           MaxValue  = MAX(s.Value)
    FROM dbo.SensorReadings s
    JOIN dbo.Devices d ON d.DeviceId = s.DeviceId
    WHERE d.ZoneId = @ZoneId AND s.MetricCode = @MetricCode
      AND s.RecordedAt >= @FromUtc AND s.RecordedAt < @ToUtc
    GROUP BY DATEADD(MINUTE, (DATEDIFF(MINUTE, @FromUtc, s.RecordedAt) / @BucketMinutes) * @BucketMinutes, @FromUtc)
    ORDER BY BucketUtc;
END
GO
```

- [ ] **Step 5: Chạy test**

Run: `npm test`
Expected: `sp_GetReadingHistory: PASS`, `views: PASS`, các file khác đạt.

- [ ] **Step 6: Commit**

```bash
git add database/sql/01-views/vw_LatestReadings.sql database/sql/01-views/vw_OpenAlerts.sql database/sql/01-views/vw_DailyEnvStats.sql database/sql/02-functions-procs/sp_GetReadingHistory.sql database/tests/views.test.sql database/tests/sp_GetReadingHistory.test.sql
git commit -m "feat(database): view số đo/cảnh báo/thống kê ngày và sp_GetReadingHistory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: BirdCounts, `sp_RecordBirdCount`, `vw_DailyBirdFlow` (mục 6)

**Files:**
- Modify: `database/prisma/schema.prisma` (thêm model `BirdCounts`, quan hệ ngược trong `Devices`)
- Create: `database/prisma/migrations/<timestamp>_bird_counts/migration.sql`, `database/sql/02-functions-procs/sp_RecordBirdCount.sql`, `database/sql/01-views/vw_DailyBirdFlow.sql`, `database/tests/sp_RecordBirdCount.test.sql`

**Interfaces:**
- Consumes: camera seed `H1-F0-CAMERA`, `H2-F0-CAMERA`.
- Produces:
  - Bảng `BirdCounts(CountId INT, CameraId INT, WindowStart DATETIME2(0), InCount INT, OutCount INT)`, UQ(CameraId, WindowStart), `CK_BirdCounts_NonNegative`, `CK_BirdCounts_Window`.
  - `EXEC dbo.sp_RecordBirdCount @Json NVARCHAR(MAX)` — mảng `{camera, windowStart, in, out}` → 1 dòng `WindowsUpserted INT, WindowsUnchanged INT`. Cả lô nguyên tử. Lỗi: 50030 JSON/không phải mảng; 50042 phần tử thiếu trường, sai kiểu hoặc `windowStart` không parse được/thiếu `Z`; 50010 camera; 50012 số âm; 50014 sai mốc 5 phút. Trùng (camera, cửa sổ) trong cùng lô: lấy giá trị lớn hơn từng cột.
  - `dbo.vw_DailyBirdFlow(HouseId, DayVn DATE, InTotal INT, OutTotal INT, Net INT)`.

- [ ] **Step 1: Viết test (phải fail)**

`database/tests/sp_RecordBirdCount.test.sql` — dùng cửa sổ tháng 9/2026 (không trùng seed):

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #r (WindowsUpserted INT, WindowsUnchanged INT);
GO

PRINT N'bird: ghi moi, gui lai, gui tong nho hon';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @cam INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F0-CAMERA');
    DECLARE @j NVARCHAR(MAX) = N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:00:00Z","in":5,"out":1},
                                  {"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:05:00Z","in":2,"out":0}]';
    INSERT #r EXEC dbo.sp_RecordBirdCount @j;
    IF NOT EXISTS (SELECT 1 FROM #r WHERE WindowsUpserted = 2 AND WindowsUnchanged = 0) THROW 59999, N'bird: lan dau phai upsert 2', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.BirdCounts WHERE CameraId = @cam AND WindowStart = '2026-09-01T10:00:00' AND InCount = 5 AND OutCount = 1)
        THROW 59999, N'bird: cua so 10:00 sai', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_RecordBirdCount @j;   -- gui lai y het
    IF NOT EXISTS (SELECT 1 FROM #r WHERE WindowsUpserted = 0 AND WindowsUnchanged = 2) THROW 59999, N'bird: gui lai phai khong doi', 1;
    DELETE #r;

    -- in nho hon (giu 5), out lon hon (len 4): moi cot doc lap.
    INSERT #r EXEC dbo.sp_RecordBirdCount N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:00:00Z","in":3,"out":4}]';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE WindowsUpserted = 1) THROW 59999, N'bird: out lon hon phai cap nhat', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.BirdCounts WHERE CameraId = @cam AND WindowStart = '2026-09-01T10:00:00' AND InCount = 5 AND OutCount = 4)
        THROW 59999, N'bird: phai giu in 5, len out 4', 1;
    DELETE #r;

    -- Trung cua so trong cung lo: lay lon hon tung cot.
    INSERT #r EXEC dbo.sp_RecordBirdCount N'[{"camera":"H2-F0-CAMERA","windowStart":"2026-09-01T11:00:00Z","in":7,"out":0},
                                              {"camera":"H2-F0-CAMERA","windowStart":"2026-09-01T11:00:00Z","in":6,"out":2}]';
    IF NOT EXISTS (SELECT 1 FROM dbo.BirdCounts b JOIN dbo.Devices d ON d.DeviceId = b.CameraId
                   WHERE d.Code = 'H2-F0-CAMERA' AND b.WindowStart = '2026-09-01T11:00:00' AND b.InCount = 7 AND b.OutCount = 2)
        THROW 59999, N'bird: trung trong lo phai lay lon hon tung cot', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'bird: loi 50010 / 50012 / 50014 / 50030 / 50042';
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_RecordBirdCount N'[{"camera":"KHONG-CO","windowStart":"2026-09-01T10:00:00Z","in":1,"out":0}]';
    THROW 59999, N'camera la: mong doi 50010', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50010 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_RecordBirdCount N'[{"camera":"H1-F1-SENSOR","windowStart":"2026-09-01T10:00:00Z","in":1,"out":0}]';
    THROW 59999, N'khong phai CAMERA: mong doi 50010', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50010 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_RecordBirdCount N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:00:00Z","in":-1,"out":0}]';
    THROW 59999, N'so am: mong doi 50012', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50012 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_RecordBirdCount N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:01:00Z","in":1,"out":0}]';
    THROW 59999, N'sai moc: mong doi 50014', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50014 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_RecordBirdCount N'khong phai json';
    THROW 59999, N'JSON sai: mong doi 50030', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50030 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_RecordBirdCount N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:00:00","in":1,"out":0}]';
    THROW 59999, N'thieu Z: mong doi 50042', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50042 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_RecordBirdCount N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T10:00:00Z","in":"nam","out":0}]';
    THROW 59999, N'sai kieu: mong doi 50042', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50042 THROW; END CATCH
GO

PRINT N'bird: lo co mot phan tu sai thi khong ghi gi (nguyen tu)';
DECLARE @before INT = (SELECT COUNT(*) FROM dbo.BirdCounts WHERE WindowStart >= '2026-09-01' AND WindowStart < '2026-09-02');
BEGIN TRY
    EXEC dbo.sp_RecordBirdCount N'[{"camera":"H1-F0-CAMERA","windowStart":"2026-09-01T12:00:00Z","in":1,"out":0},
                                   {"camera":"KHONG-CO","windowStart":"2026-09-01T12:00:00Z","in":1,"out":0}]';
    THROW 59999, N'mong doi 50010', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50010 THROW; END CATCH
IF (SELECT COUNT(*) FROM dbo.BirdCounts WHERE WindowStart >= '2026-09-01' AND WindowStart < '2026-09-02') <> @before
    THROW 59999, N'bird: lo loi khong duoc ghi phan tu hop le', 1;
GO

PRINT N'bird: CHECK moc 5 phut o tang bang';
BEGIN TRY BEGIN TRAN;
    DECLARE @cam INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F0-CAMERA');
    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount) VALUES (@cam, '2026-09-01T10:02:00', 1, 0);
    THROW 59999, N'CHECK moc 5 phut: mong doi 547', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 547 THROW; END CATCH
GO

PRINT N'bird: vw_DailyBirdFlow gom theo ngay gio Viet Nam';
BEGIN TRY
    BEGIN TRAN;
    -- 16:55Z = 23:55 ngay 01/09 gio VN; 17:00Z = 00:00 ngay 02/09 gio VN.
    EXEC dbo.sp_RecordBirdCount N'[{"camera":"H2-F0-CAMERA","windowStart":"2026-09-01T16:55:00Z","in":10,"out":3},
                                   {"camera":"H2-F0-CAMERA","windowStart":"2026-09-01T17:00:00Z","in":4,"out":0}]';
    DECLARE @h INT = (SELECT HouseId FROM dbo.Houses WHERE Name = N'H2');
    IF NOT EXISTS (SELECT 1 FROM dbo.vw_DailyBirdFlow WHERE HouseId = @h AND DayVn = '2026-09-01' AND InTotal = 10 AND OutTotal = 3 AND Net = 7)
        THROW 59999, N'vw_DailyBirdFlow: ngay 01/09 sai', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.vw_DailyBirdFlow WHERE HouseId = @h AND DayVn = '2026-09-02' AND InTotal = 4)
        THROW 59999, N'vw_DailyBirdFlow: ngay 02/09 sai', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO
PRINT N'sp_RecordBirdCount: PASS';
GO
```

Lưu ý: ca `vw_DailyBirdFlow` gọi `EXEC dbo.sp_RecordBirdCount` không `INSERT #r` — SP trả một tập kết quả ra màn hình, không ảnh hưởng test.

Run: `npm test` → Expected: FAIL (`Invalid object name 'dbo.BirdCounts'`).

- [ ] **Step 2: Thêm model vào `schema.prisma`**

Trong model `Devices`, thêm dòng quan hệ ngược `BirdCounts BirdCounts[]` dưới `Alerts Alerts[]`. Thêm model:

```prisma
model BirdCounts {
  CountId     Int      @id @default(autoincrement())
  CameraId    Int
  WindowStart DateTime @db.DateTime2(0)
  InCount     Int
  OutCount    Int

  Camera Devices @relation(fields: [CameraId], references: [DeviceId], onDelete: NoAction, onUpdate: NoAction)

  @@unique([CameraId, WindowStart])
}
```

- [ ] **Step 3: Tạo migration và thêm CHECK viết tay**

Nếu R2 **không** xảy ra (Task 2): `npx prisma migrate dev --create-only --name bird_counts`. Nếu R2 **xảy ra**: dùng lệnh `prisma migrate diff` ghi trong `spikes/RESULTS.md`, đặt file vào `prisma/migrations/<yyyyMMddHHmmss>_bird_counts/migration.sql`.

Thêm cuối `migration.sql`:

```sql
IF OBJECT_ID(N'dbo.CK_BirdCounts_NonNegative', N'C') IS NULL
    ALTER TABLE dbo.BirdCounts ADD CONSTRAINT CK_BirdCounts_NonNegative CHECK (InCount >= 0 AND OutCount >= 0);
IF OBJECT_ID(N'dbo.CK_BirdCounts_Window', N'C') IS NULL
    ALTER TABLE dbo.BirdCounts ADD CONSTRAINT CK_BirdCounts_Window CHECK (
        DATEPART(MINUTE, WindowStart) % 5 = 0 AND DATEPART(SECOND, WindowStart) = 0);
```

Áp dụng: `npm run reset:dev` (migrate deploy chạy cả migration mới).

- [ ] **Step 4: Viết `database/sql/02-functions-procs/sp_RecordBirdCount.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_RecordBirdCount
    @Json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Json IS NULL OR ISJSON(@Json) = 0
       OR LEFT(LTRIM(REPLACE(REPLACE(REPLACE(@Json, NCHAR(13), N''), NCHAR(10), N''), NCHAR(9), N'')), 1) <> N'['
        THROW 50030, N'Chuoi JSON khong hop le (can mot mang).', 1;

    CREATE TABLE #In (
        CameraCode  NVARCHAR(200) NULL,
        WindowText  NVARCHAR(100) NULL,
        InText      NVARCHAR(50)  NULL,
        OutText     NVARCHAR(50)  NULL,
        IsObject    BIT           NOT NULL,
        WindowStart DATETIME2(3)  NULL,
        InCount     INT           NULL,
        OutCount    INT           NULL,
        CameraId    INT           NULL);

    INSERT #In (CameraCode, WindowText, InText, OutText, IsObject)
    SELECT x.camera, x.windowStart, x.[in], x.[out], CASE WHEN j.[type] = 5 THEN 1 ELSE 0 END
    FROM OPENJSON(@Json) j
    OUTER APPLY (SELECT * FROM OPENJSON(CASE WHEN j.[type] = 5 THEN j.[value] END)
                 WITH (camera NVARCHAR(200) '$.camera', windowStart NVARCHAR(100) '$.windowStart',
                       [in] NVARCHAR(50) '$.in', [out] NVARCHAR(50) '$.out')) x;

    UPDATE #In
    SET WindowStart = CASE WHEN WindowText LIKE N'%Z' THEN TRY_CONVERT(DATETIME2(3), WindowText, 127) END,
        InCount = TRY_CONVERT(INT, InText),
        OutCount = TRY_CONVERT(INT, OutText);

    UPDATE i SET CameraId = d.DeviceId
    FROM #In i
    JOIN dbo.Devices d ON d.Code = i.CameraCode AND d.DeviceType = 'CAMERA' AND d.IsActive = 1;

    -- Kiem tra ca lo truoc khi ghi bat ky dong nao (nguyen tu).
    IF EXISTS (SELECT 1 FROM #In WHERE IsObject = 0 OR CameraCode IS NULL OR WindowStart IS NULL OR InCount IS NULL OR OutCount IS NULL)
        THROW 50042, N'Phan tu thieu truong, sai kieu, hoac windowStart khong co hau to Z.', 1;
    IF EXISTS (SELECT 1 FROM #In WHERE CameraId IS NULL)
        THROW 50010, N'Camera khong ton tai, ngung dung hoac khong phai CAMERA.', 1;
    IF EXISTS (SELECT 1 FROM #In WHERE InCount < 0 OR OutCount < 0)
        THROW 50012, N'So dem chim khong duoc am.', 1;
    IF EXISTS (SELECT 1 FROM #In WHERE DATEPART(MINUTE, WindowStart) % 5 <> 0 OR DATEPART(SECOND, WindowStart) <> 0
                                     OR DATEPART(MILLISECOND, WindowStart) <> 0)
        THROW 50014, N'windowStart phai dung moc 5 phut.', 1;

    CREATE TABLE #Agg (
        CameraId    INT          NOT NULL,
        WindowStart DATETIME2(0) NOT NULL,
        InCount     INT          NOT NULL,
        OutCount    INT          NOT NULL,
        HasRow      BIT          NOT NULL DEFAULT 0,
        OldIn       INT          NULL,
        OldOut      INT          NULL);
    INSERT #Agg (CameraId, WindowStart, InCount, OutCount)
    SELECT CameraId, CAST(WindowStart AS DATETIME2(0)), MAX(InCount), MAX(OutCount)
    FROM #In GROUP BY CameraId, CAST(WindowStart AS DATETIME2(0));

    BEGIN TRAN;

    -- SERIALIZABLE khoa ca khoang khoa cua cua so chua co (seek tren UQ), nen hai lan gui
    -- dong thoi cung cua so phai cho nhau, khong chen trung.
    UPDATE a SET HasRow = 1, OldIn = b.InCount, OldOut = b.OutCount
    FROM #Agg a
    JOIN dbo.BirdCounts b WITH (UPDLOCK, SERIALIZABLE) ON b.CameraId = a.CameraId AND b.WindowStart = a.WindowStart;

    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount)
    SELECT CameraId, WindowStart, InCount, OutCount FROM #Agg WHERE HasRow = 0;

    UPDATE b
    SET InCount  = CASE WHEN a.InCount  > b.InCount  THEN a.InCount  ELSE b.InCount  END,
        OutCount = CASE WHEN a.OutCount > b.OutCount THEN a.OutCount ELSE b.OutCount END
    FROM dbo.BirdCounts b
    JOIN #Agg a ON a.CameraId = b.CameraId AND a.WindowStart = b.WindowStart
    WHERE a.HasRow = 1 AND (a.InCount > a.OldIn OR a.OutCount > a.OldOut);

    COMMIT;

    SELECT WindowsUpserted  = (SELECT COUNT(*) FROM #Agg WHERE HasRow = 0 OR InCount > OldIn OR OutCount > OldOut),
           WindowsUnchanged = (SELECT COUNT(*) FROM #Agg WHERE HasRow = 1 AND InCount <= OldIn AND OutCount <= OldOut);
END
GO
```

- [ ] **Step 5: Viết `database/sql/01-views/vw_DailyBirdFlow.sql`**

```sql
CREATE OR ALTER VIEW dbo.vw_DailyBirdFlow
AS
SELECT z.HouseId,
       DayVn    = CAST(b.WindowStart AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATE),
       InTotal  = SUM(b.InCount),
       OutTotal = SUM(b.OutCount),
       Net      = SUM(b.InCount) - SUM(b.OutCount)
FROM dbo.BirdCounts b
JOIN dbo.Devices d ON d.DeviceId = b.CameraId
JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
GROUP BY z.HouseId, CAST(b.WindowStart AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATE);
GO
```

- [ ] **Step 6: Chạy test**

Run: `npm test`
Expected: `sp_RecordBirdCount: PASS`, mọi file khác đạt.

- [ ] **Step 7: Commit**

```bash
git add database/prisma database/sql/02-functions-procs/sp_RecordBirdCount.sql database/sql/01-views/vw_DailyBirdFlow.sql database/tests/sp_RecordBirdCount.test.sql
git commit -m "feat(database): BirdCounts, sp_RecordBirdCount lấy giá trị lớn hơn (idempotent), vw_DailyBirdFlow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: `sp_CreatePredatorAlert` (mục 7)

**Files:**
- Create: `database/sql/02-functions-procs/sp_CreatePredatorAlert.sql`, `database/tests/sp_CreatePredatorAlert.test.sql`

**Interfaces:**
- Consumes: `dbo.vw_AlertJson` (Task 4), camera seed.
- Produces: `EXEC dbo.sp_CreatePredatorAlert @Json NVARCHAR(MAX), @MinConfidence DECIMAL(4,3) = 0.5, @CooldownMinutes INT = 5` — `@Json` là **một object** `{camera, class, confidence, snapshot, at}` → 1 dòng `Created BIT, AlertId INT, SkipReason VARCHAR(20), AlertJson NVARCHAR(MAX)`. Cảnh báo PREDATOR có `Severity = 'CRITICAL'`, `CreatedAt = at` (thời điểm phát hiện, để cooldown và lịch sử theo giờ thật của video), `ZoneId`/`HouseId` theo camera. Cooldown: cùng camera + cùng loài có cảnh báo với `CreatedAt` trong khoảng ±`@CooldownMinutes` quanh `at`. Lỗi: 50030 không phải object; 50013 loài lạ; 50010 camera; 50042 confidence ngoài [0,1] / thiếu snapshot / `at` thiếu `Z` hoặc lớn hơn hiện tại quá 5 phút / tham số ngoài miền.

- [ ] **Step 1: Viết test (phải fail)**

`database/tests/sp_CreatePredatorAlert.test.sql` (mốc tháng 9/2026, không đụng seed):

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #r (Created BIT, AlertId INT, SkipReason VARCHAR(20), AlertJson NVARCHAR(MAX));
GO

PRINT N'predator: tao, cooldown, loai khac, het cooldown, do tin cay thap';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @cam INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F0-CAMERA');
    DECLARE @zone INT = (SELECT ZoneId FROM dbo.Devices WHERE Code = 'H1-F0-CAMERA');
    DECLARE @house INT = (SELECT HouseId FROM dbo.Houses WHERE Name = N'H1');
    DECLARE @a INT;

    INSERT #r EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.87,"snapshot":"snapshots/2026/09/01/H1-F0-CAMERA_snake_20260901T104000Z.jpg","at":"2026-09-01T10:40:00Z"}';
    SELECT @a = AlertId FROM #r WHERE Created = 1 AND SkipReason IS NULL;
    IF @a IS NULL THROW 59999, N'predator: lan dau phai tao canh bao', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts WHERE AlertId = @a AND AlertType = 'PREDATOR' AND Severity = 'CRITICAL'
                   AND DeviceId = @cam AND ZoneId = @zone AND HouseId = @house AND DetectedClass = 'snake'
                   AND Confidence = 0.87 AND SnapshotPath LIKE N'snapshots/%' AND CreatedAt = '2026-09-01T10:40:00')
        THROW 59999, N'predator: dong Alerts sai', 1;
    IF (SELECT ISJSON(AlertJson) FROM #r) <> 1
       OR (SELECT JSON_VALUE(AlertJson, '$.HasSnapshot') FROM #r) <> 'true'
       OR (SELECT JSON_VALUE(AlertJson, '$.CreatedAt') FROM #r) <> '2026-09-01T10:40:00Z'
       OR (SELECT CAST(JSON_VALUE(AlertJson, '$.AlertId') AS INT) FROM #r) <> @a
        THROW 59999, N'predator: AlertJson sai', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.9,"snapshot":"snapshots/b.jpg","at":"2026-09-01T10:42:00Z"}';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Created = 0 AND AlertId IS NULL AND SkipReason = 'COOLDOWN' AND AlertJson IS NULL)
        THROW 59999, N'predator: trong cooldown phai bo qua', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"owl","confidence":0.7,"snapshot":"snapshots/c.jpg","at":"2026-09-01T10:42:00Z"}';
    IF (SELECT Created FROM #r) <> 1 THROW 59999, N'predator: loai khac khong bi cooldown', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.8,"snapshot":"snapshots/d.jpg","at":"2026-09-01T10:46:00Z"}';
    IF (SELECT Created FROM #r) <> 1 THROW 59999, N'predator: het cooldown (6 phut) phai tao moi', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"rat","confidence":0.3,"snapshot":"snapshots/e.jpg","at":"2026-09-01T11:00:00Z"}';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Created = 0 AND SkipReason = 'LOW_CONFIDENCE')
        THROW 59999, N'predator: do tin cay thap phai bo qua', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'predator: cac loi';
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"cat","confidence":0.9,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00Z"}';
    THROW 59999, N'loai la: mong doi 50013', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50013 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_CreatePredatorAlert N'{"camera":"KHONG-CO","class":"rat","confidence":0.9,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00Z"}';
    THROW 59999, N'camera la: mong doi 50010', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50010 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F1-SENSOR","class":"rat","confidence":0.9,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00Z"}';
    THROW 59999, N'khong phai CAMERA: mong doi 50010', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50010 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_CreatePredatorAlert N'[{"camera":"H1-F0-CAMERA"}]';
    THROW 59999, N'mang thay vi object: mong doi 50030', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50030 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"rat","confidence":1.5,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00Z"}';
    THROW 59999, N'confidence 1.5: mong doi 50042', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50042 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"rat","confidence":0.9,"at":"2026-09-01T10:40:00Z"}';
    THROW 59999, N'thieu snapshot: mong doi 50042', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50042 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H1-F0-CAMERA","class":"rat","confidence":0.9,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:40:00+07:00"}';
    THROW 59999, N'at co mui gio khac: mong doi 50042', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50042 THROW; END CATCH
GO
PRINT N'sp_CreatePredatorAlert: PASS';
GO
```

Run: `npm test` → Expected: FAIL `Could not find stored procedure 'dbo.sp_CreatePredatorAlert'`.

- [ ] **Step 2: Viết `database/sql/02-functions-procs/sp_CreatePredatorAlert.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_CreatePredatorAlert
    @Json            NVARCHAR(MAX),
    @MinConfidence   DECIMAL(4, 3) = 0.5,
    @CooldownMinutes INT = 5
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Json IS NULL OR ISJSON(@Json) = 0
       OR LEFT(LTRIM(REPLACE(REPLACE(REPLACE(@Json, NCHAR(13), N''), NCHAR(10), N''), NCHAR(9), N'')), 1) <> N'{'
        THROW 50030, N'Chuoi JSON khong hop le (can mot object).', 1;
    IF @MinConfidence IS NULL OR @MinConfidence < 0 OR @MinConfidence > 1 OR @CooldownMinutes IS NULL OR @CooldownMinutes < 0
        THROW 50042, N'@MinConfidence phai trong [0,1], @CooldownMinutes >= 0.', 1;

    DECLARE @CameraCode NVARCHAR(200) = JSON_VALUE(@Json, '$.camera'),
            @Class      NVARCHAR(50)  = JSON_VALUE(@Json, '$.class'),
            @ConfText   NVARCHAR(50)  = JSON_VALUE(@Json, '$.confidence'),
            @Snapshot   NVARCHAR(400) = JSON_VALUE(@Json, '$.snapshot'),
            @AtText     NVARCHAR(100) = JSON_VALUE(@Json, '$.at');
    DECLARE @Conf DECIMAL(4, 3) = TRY_CONVERT(DECIMAL(4, 3), @ConfText);
    DECLARE @At3 DATETIME2(3) = CASE WHEN @AtText LIKE N'%Z' THEN TRY_CONVERT(DATETIME2(3), @AtText, 127) END;
    DECLARE @At DATETIME2(0) = CAST(DATEADD(MILLISECOND, -DATEPART(MILLISECOND, @At3), @At3) AS DATETIME2(0));
    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();

    IF @Class IS NULL OR @Class NOT IN (N'rat', N'snake', N'owl')
        THROW 50013, N'Loai thien dich phai thuoc {rat, snake, owl}.', 1;

    DECLARE @CameraId INT, @ZoneId INT, @HouseId INT;
    SELECT @CameraId = d.DeviceId, @ZoneId = d.ZoneId, @HouseId = z.HouseId
    FROM dbo.Devices d JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
    WHERE d.Code = @CameraCode AND d.DeviceType = 'CAMERA' AND d.IsActive = 1;
    IF @CameraId IS NULL
        THROW 50010, N'Camera khong ton tai, ngung dung hoac khong phai CAMERA.', 1;

    IF @Conf IS NULL OR @Conf < 0 OR @Conf > 1 OR @Snapshot IS NULL OR LEN(@Snapshot) = 0 OR LEN(@Snapshot) > 260
       OR @At IS NULL OR @At > DATEADD(MINUTE, 5, @Now)
        THROW 50042, N'confidence trong [0,1], snapshot bat buoc, at phai co hau to Z va khong o tuong lai.', 1;

    IF @Conf < @MinConfidence
    BEGIN
        SELECT Created = CAST(0 AS BIT), AlertId = CAST(NULL AS INT), SkipReason = 'LOW_CONFIDENCE', AlertJson = CAST(NULL AS NVARCHAR(MAX));
        RETURN;
    END

    EXEC sys.sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sys.sp_set_session_context @key = N'Note', @value = NULL;

    DECLARE @New TABLE (AlertId INT NOT NULL);
    DECLARE @AlertId INT;

    BEGIN TRAN;
    -- HOLDLOCK: hai phat hien dong thoi cung loai, cung camera khong tao hai canh bao.
    IF EXISTS (SELECT 1 FROM dbo.Alerts WITH (UPDLOCK, HOLDLOCK)
               WHERE DeviceId = @CameraId AND AlertType = 'PREDATOR' AND DetectedClass = @Class
                 AND CreatedAt > DATEADD(MINUTE, -@CooldownMinutes, @At) AND CreatedAt < DATEADD(MINUTE, @CooldownMinutes, @At))
    BEGIN
        COMMIT;
        SELECT Created = CAST(0 AS BIT), AlertId = CAST(NULL AS INT), SkipReason = 'COOLDOWN', AlertJson = CAST(NULL AS NVARCHAR(MAX));
        RETURN;
    END

    INSERT dbo.Alerts (HouseId, ZoneId, DeviceId, AlertType, Severity, DetectedClass, Confidence, SnapshotPath, Message, CreatedAt)
    OUTPUT inserted.AlertId INTO @New (AlertId)
    VALUES (@HouseId, @ZoneId, @CameraId, 'PREDATOR', 'CRITICAL', @Class, @Conf, @Snapshot,
            CONCAT(N'Phát hiện ', CASE @Class WHEN N'rat' THEN N'chuột' WHEN N'snake' THEN N'rắn' ELSE N'cú' END,
                   N' tại ', @CameraCode, N' (độ tin cậy ', CAST(@Conf * 100 AS DECIMAL(5, 1)), N'%)'),
            @At);
    SELECT @AlertId = AlertId FROM @New;
    COMMIT;

    SELECT Created = CAST(1 AS BIT), AlertId = @AlertId, SkipReason = CAST(NULL AS VARCHAR(20)),
           AlertJson = (SELECT v.* FROM dbo.vw_AlertJson v WHERE v.AlertId = @AlertId
                        FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER);
END
GO
```

- [ ] **Step 3: Chạy test**

Run: `npm test` → Expected: `sp_CreatePredatorAlert: PASS`, mọi file khác đạt.

- [ ] **Step 4: Commit**

```bash
git add database/sql/02-functions-procs/sp_CreatePredatorAlert.sql database/tests/sp_CreatePredatorAlert.test.sql
git commit -m "feat(database): sp_CreatePredatorAlert có cooldown khóa HOLDLOCK, trả AlertJson

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: `sp_DetectAnomalies` — phần giảm đàn (mục 8)

**Files:**
- Create: `database/sql/02-functions-procs/sp_DetectAnomalies.sql`, `database/tests/sp_DetectAnomalies.test.sql`

**Interfaces:**
- Consumes: `BirdCounts` (Task 9), `vw_AlertJson`.
- Produces: `EXEC dbo.sp_DetectAnomalies @OfflineMinutes INT = 5, @DropPercent INT = 20, @CutoffHourVn INT = 20, @NowUtc DATETIME2(0) = NULL` → 1 dòng `NewAlertsJson NVARCHAR(MAX)` (mảng, `[]` khi rỗng). Task này chỉ làm phần giảm đàn; Task 15 bổ sung phần OFFLINE vào chính SP này. Cảnh báo `POPULATION_DROP` có `CreatedAt = @NowUtc`, `ZoneId`/`DeviceId` NULL, `Severity = 'CRITICAL'`. Lỗi 50042: `@DropPercent` ngoài (0,100), `@CutoffHourVn` ngoài [0,23], `@OfflineMinutes` ≤ 0.

Thuật toán (giờ Việt Nam UTC+7, không có giờ mùa hè): với mỗi nhà đang dùng có camera, `Today` = tổng `InCount` các cửa sổ `WindowStart ∈ [00:00 VN hôm nay, giờ chốt VN hôm nay)`; `Avg` = trung bình tổng cùng khung của các ngày có dữ liệu trong 7 ngày trước. Bỏ qua nếu < 3 ngày có dữ liệu hoặc `Avg = 0`. Báo khi `Today < Avg × (100 − @DropPercent) / 100` và nhà chưa có `POPULATION_DROP` tạo trong hôm nay (giờ VN).

- [ ] **Step 1: Viết test (phải fail)**

`database/tests/sp_DetectAnomalies.test.sql` — dữ liệu riêng tháng 9/2026, "hôm nay" = 08/09 giờ VN:

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #r (NewAlertsJson NVARCHAR(MAX));
GO

PRINT N'anomaly: giam dan chi danh gia sau gio chot, so cung khung gio, toi da 1 lan/ngay';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @cam INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H2-F0-CAMERA');
    DECLARE @h2 INT = (SELECT HouseId FROM dbo.Houses WHERE Name = N'H2');
    -- 7 ngay truoc (01..07/09): 100 chim ve luc 18:00 VN (11:00Z). Hom nay 08/09: 50 truoc gio chot.
    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount)
    SELECT @cam, DATEADD(DAY, n, '2026-09-01T11:00:00'), 100, 0
    FROM (VALUES (0), (1), (2), (3), (4), (5), (6)) v (n);
    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount) VALUES (@cam, '2026-09-08T11:00:00', 50, 0);
    -- Sau gio chot (21:00 VN = 14:00Z) ve them 500: khong duoc tinh (so cung khung gio).
    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount) VALUES (@cam, '2026-09-08T14:00:00', 500, 0);
    -- Ngay truoc cung co du lieu sau gio chot: khong duoc tinh.
    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount) VALUES (@cam, '2026-09-07T14:00:00', 900, 0);

    INSERT #r EXEC dbo.sp_DetectAnomalies @NowUtc = '2026-09-08T01:00:00';   -- 08:00 VN
    IF EXISTS (SELECT 1 FROM dbo.Alerts WHERE AlertType = 'POPULATION_DROP' AND HouseId = @h2)
        THROW 59999, N'anomaly: truoc gio chot khong duoc danh gia', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_DetectAnomalies @NowUtc = '2026-09-08T13:30:00';   -- 20:30 VN
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts WHERE AlertType = 'POPULATION_DROP' AND HouseId = @h2 AND ZoneId IS NULL
                   AND DeviceId IS NULL AND Severity = 'CRITICAL' AND CreatedAt = '2026-09-08T13:30:00')
        THROW 59999, N'anomaly: 50 so voi TB 100 phai bao POPULATION_DROP', 1;
    IF (SELECT COUNT(*) FROM OPENJSON((SELECT NewAlertsJson FROM #r)) WHERE JSON_VALUE(value, '$.AlertType') = 'POPULATION_DROP') <> 1
        THROW 59999, N'anomaly: NewAlertsJson phai chua canh bao moi', 1;
    DELETE #r;

    INSERT #r EXEC dbo.sp_DetectAnomalies @NowUtc = '2026-09-08T14:00:00';   -- 21:00 VN cung ngay
    IF (SELECT COUNT(*) FROM dbo.Alerts WHERE AlertType = 'POPULATION_DROP' AND HouseId = @h2) <> 1
        THROW 59999, N'anomaly: toi da 1 canh bao/nha/ngay', 1;
    IF (SELECT NewAlertsJson FROM #r) <> N'[]' THROW 59999, N'anomaly: lan sau trong ngay NewAlertsJson phai rong', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'anomaly: duoi 3 ngay du lieu -> bo qua; giam it -> khong bao';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @c1 INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H1-F0-CAMERA');
    DECLARE @c2 INT = (SELECT DeviceId FROM dbo.Devices WHERE Code = 'H2-F0-CAMERA');
    -- H1: chi 2 ngay truoc co du lieu, hom nay rat thap -> bo qua.
    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount) VALUES
        (@c1, '2026-09-06T11:00:00', 100, 0), (@c1, '2026-09-07T11:00:00', 100, 0), (@c1, '2026-09-08T11:00:00', 10, 0);
    -- H2: 7 ngay 100, hom nay 95 (giam 5%) -> khong bao.
    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount)
    SELECT @c2, DATEADD(DAY, n, '2026-09-01T11:00:00'), 100, 0 FROM (VALUES (0), (1), (2), (3), (4), (5), (6)) v (n);
    INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount) VALUES (@c2, '2026-09-08T11:00:00', 95, 0);
    INSERT #r EXEC dbo.sp_DetectAnomalies @NowUtc = '2026-09-08T13:30:00';
    IF EXISTS (SELECT 1 FROM dbo.Alerts WHERE AlertType = 'POPULATION_DROP' AND CreatedAt = '2026-09-08T13:30:00')
        THROW 59999, N'anomaly: khong du du lieu hoac giam it khong duoc bao', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'anomaly: tham so ngoai mien -> 50042';
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_DetectAnomalies @DropPercent = 150;
    THROW 59999, N'DropPercent 150: mong doi 50042', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50042 THROW; END CATCH
GO
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_DetectAnomalies @CutoffHourVn = 24;
    THROW 59999, N'CutoffHourVn 24: mong doi 50042', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50042 THROW; END CATCH
GO
PRINT N'sp_DetectAnomalies: PASS';
GO
```

Run: `npm test` → Expected: FAIL `Could not find stored procedure 'dbo.sp_DetectAnomalies'`.

- [ ] **Step 2: Viết `database/sql/02-functions-procs/sp_DetectAnomalies.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_DetectAnomalies
    @OfflineMinutes INT = 5,
    @DropPercent    INT = 20,
    @CutoffHourVn   INT = 20,
    @NowUtc         DATETIME2(0) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @DropPercent IS NULL OR @DropPercent <= 0 OR @DropPercent >= 100
       OR @CutoffHourVn IS NULL OR @CutoffHourVn < 0 OR @CutoffHourVn > 23
       OR @OfflineMinutes IS NULL OR @OfflineMinutes <= 0
        THROW 50042, N'Tham so ngoai mien: DropPercent (0,100), CutoffHourVn [0,23], OfflineMinutes > 0.', 1;

    SET @NowUtc = ISNULL(@NowUtc, SYSUTCDATETIME());
    DECLARE @NowVn DATETIME2(0) = CAST(@NowUtc AT TIME ZONE 'UTC' AT TIME ZONE 'SE Asia Standard Time' AS DATETIME2(0));
    DECLARE @TodayVn DATE = CAST(@NowVn AS DATE);
    -- 00:00 hom nay gio VN doi sang UTC.
    DECLARE @TodayStartUtc DATETIME2(0) =
        CAST(CAST(@TodayVn AS DATETIME2(0)) AT TIME ZONE 'SE Asia Standard Time' AT TIME ZONE 'UTC' AS DATETIME2(0));

    DECLARE @New TABLE (AlertId INT NOT NULL);

    EXEC sys.sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sys.sp_set_session_context @key = N'Note', @value = NULL;

    BEGIN TRAN;

    -- ===== Giam dan (muc 8) =====
    IF DATEPART(HOUR, @NowVn) >= @CutoffHourVn
    BEGIN
        -- Khung [00:00, gio chot) gio VN cua hom nay (n = 0) va 7 ngay truoc (n = 1..7), tinh san bang UTC (SARGable).
        CREATE TABLE #Days (n INT NOT NULL, FromUtc DATETIME2(0) NOT NULL, ToUtc DATETIME2(0) NOT NULL);
        INSERT #Days (n, FromUtc, ToUtc)
        SELECT v.n, DATEADD(DAY, -v.n, @TodayStartUtc), DATEADD(HOUR, @CutoffHourVn, DATEADD(DAY, -v.n, @TodayStartUtc))
        FROM (VALUES (0), (1), (2), (3), (4), (5), (6), (7)) v (n);

        CREATE TABLE #PerDay (HouseId INT NOT NULL, n INT NOT NULL, Total INT NOT NULL);
        INSERT #PerDay (HouseId, n, Total)
        SELECT z.HouseId, dd.n, SUM(b.InCount)
        FROM #Days dd
        JOIN dbo.BirdCounts b ON b.WindowStart >= dd.FromUtc AND b.WindowStart < dd.ToUtc
        JOIN dbo.Devices d ON d.DeviceId = b.CameraId
        JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
        JOIN dbo.Houses h ON h.HouseId = z.HouseId AND h.IsActive = 1
        GROUP BY z.HouseId, dd.n;

        INSERT dbo.Alerts (HouseId, AlertType, Severity, Message, CreatedAt)
        OUTPUT inserted.AlertId INTO @New (AlertId)
        SELECT s.HouseId, 'POPULATION_DROP', 'CRITICAL',
               CONCAT(N'Số chim về hôm nay (', s.TodayTotal, N') thấp hơn trung bình 7 ngày (', CAST(s.AvgPrev AS INT),
                      N') quá ', @DropPercent, N'%'),
               @NowUtc
        FROM (SELECT p.HouseId,
                     TodayTotal = ISNULL(MAX(CASE WHEN p.n = 0 THEN p.Total END), 0),
                     AvgPrev    = AVG(CASE WHEN p.n > 0 THEN CAST(p.Total AS DECIMAL(18, 2)) END),
                     PrevDays   = COUNT(CASE WHEN p.n > 0 THEN 1 END)
              FROM #PerDay p
              GROUP BY p.HouseId) s
        WHERE s.PrevDays >= 3 AND s.AvgPrev > 0
          AND s.TodayTotal < s.AvgPrev * (100 - @DropPercent) / 100.0
          AND NOT EXISTS (SELECT 1 FROM dbo.Alerts a WITH (UPDLOCK, HOLDLOCK)
                          WHERE a.HouseId = s.HouseId AND a.AlertType = 'POPULATION_DROP'
                            AND a.CreatedAt >= @TodayStartUtc AND a.CreatedAt < DATEADD(DAY, 1, @TodayStartUtc));
    END

    -- ===== OFFLINE (muc 11): Task 15 bo sung tai day =====

    COMMIT;

    SELECT NewAlertsJson = ISNULL((
        SELECT v.* FROM dbo.vw_AlertJson v JOIN @New n ON n.AlertId = v.AlertId ORDER BY v.AlertId
        FOR JSON PATH, INCLUDE_NULL_VALUES), N'[]');
END
GO
```

Ghi chú: nhà có ngày dữ liệu trước nhưng hôm nay không có cửa sổ nào → `TodayTotal = 0` → báo giảm đàn (camera chết hoặc đàn bỏ nhà đều cần chủ nhà kiểm tra).

- [ ] **Step 3: Chạy test**

Run: `npm test` → Expected: `sp_DetectAnomalies: PASS`, mọi file khác đạt.

- [ ] **Step 4: Commit**

```bash
git add database/sql/02-functions-procs/sp_DetectAnomalies.sql database/tests/sp_DetectAnomalies.test.sql
git commit -m "feat(database): sp_DetectAnomalies phát hiện giảm đàn sau giờ chốt, so cùng khung giờ

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Dữ liệu mẫu số đo, đếm chim, cảnh báo (mục 9)

**Files:**
- Create: `database/sql/seed/02-readings.sql`, `database/sql/seed/03-birdcounts.sql`, `database/sql/seed/04-alerts.sql`
- Modify: `database/tests/seed.test.sql`

**Interfaces:**
- Consumes: biến `sqlcmd` `$(AnchorDateVn)` (do `deploy.ps1` truyền, mặc định `2026-10-12`); `sp_CreatePredatorAlert`, `sp_UpdateAlertStatus`.
- Produces (với ngày neo mặc định): 54.144 số đo từ `2026-10-04T17:00:00Z` (00:00 VN ngày neo−7) đến `2026-10-12T12:55:00Z` (19:55 VN ngày neo); 864 dòng BirdCounts; 3 cảnh báo (H1-F2 TEMP RESOLVED, H1-F3 HUMID NEW tạo lúc 14:00 VN ngày neo giá trị 74.97 — số đo đầu tiên dưới 75, PREDATOR snake H1-F0 ACK); 5 dòng AlertHistory; 6 cảm biến `ONLINE`, `LastSeenAt = 2026-10-12T12:55:00`.

Giờ Việt Nam = UTC+7 cố định (không có giờ mùa hè) nên seed đổi giờ bằng `DATEADD(HOUR, -7, …)`.

- [ ] **Step 1: Mở rộng `database/tests/seed.test.sql` (phải fail)**

Thêm vào cuối file:

```sql
PRINT N'seed: so do, dem chim, canh bao';
IF (SELECT COUNT(*) FROM dbo.SensorReadings) <> 54144 THROW 59999, N'seed: SensorReadings phai co 54144 dong', 1;
IF (SELECT MIN(RecordedAt) FROM dbo.SensorReadings) <> '2026-10-04T17:00:00'
   OR (SELECT MAX(RecordedAt) FROM dbo.SensorReadings) <> '2026-10-12T12:55:00'
    THROW 59999, N'seed: khoang thoi gian so do sai', 1;
IF (SELECT COUNT(*) FROM dbo.Devices WHERE DeviceType = 'SENSOR' AND Status = 'ONLINE' AND LastSeenAt = '2026-10-12T12:55:00') <> 6
    THROW 59999, N'seed: 6 cam bien phai ONLINE, LastSeenAt = so do cuoi', 1;
IF EXISTS (SELECT 1 FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId
           JOIN dbo.Zones z ON z.ZoneId = d.ZoneId JOIN dbo.Thresholds t ON t.ZoneId = z.ZoneId AND t.MetricCode = s.MetricCode
           WHERE (s.Value > t.MaxValue OR s.Value < t.MinValue)
             AND NOT (d.Code = 'H1-F2-SENSOR' AND s.MetricCode = 'TEMP')
             AND NOT (d.Code = 'H1-F3-SENSOR' AND s.MetricCode = 'HUMID'))
    THROW 59999, N'seed: chi H1-F2 TEMP va H1-F3 HUMID duoc vuot nguong', 1;
IF (SELECT COUNT(*) FROM dbo.BirdCounts) <> 864 THROW 59999, N'seed: BirdCounts phai co 864 dong', 1;
IF (SELECT COUNT(*) FROM dbo.Alerts) <> 3 THROW 59999, N'seed: Alerts phai co 3 dong', 1;
IF (SELECT COUNT(*) FROM dbo.AlertHistory) <> 5 THROW 59999, N'seed: AlertHistory phai co 5 dong', 1;
IF EXISTS (SELECT ZoneId, MetricCode FROM dbo.Alerts WHERE AlertType = 'THRESHOLD' AND Status <> 'RESOLVED'
           GROUP BY ZoneId, MetricCode HAVING COUNT(*) > 1)
    THROW 59999, N'seed: khong duoc co hai THRESHOLD dang mo trung (ZoneId, MetricCode)', 1;
-- Moi THRESHOLD dang mo: CreatedAt = so do dau tien vuot nguong (Value khop), so do lien truoc con trong nguong,
-- so do cuoi van ngoai nguong (nhu sp_IngestReadings tao that).
IF EXISTS (
    SELECT 1 FROM dbo.Alerts a
    JOIN dbo.Thresholds t ON t.ZoneId = a.ZoneId AND t.MetricCode = a.MetricCode
    OUTER APPLY (SELECT TOP (1) s.Value FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId
                 WHERE d.ZoneId = a.ZoneId AND s.MetricCode = a.MetricCode AND s.RecordedAt = a.CreatedAt) atOpen
    OUTER APPLY (SELECT TOP (1) s.Value FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId
                 WHERE d.ZoneId = a.ZoneId AND s.MetricCode = a.MetricCode AND s.RecordedAt < a.CreatedAt
                 ORDER BY s.RecordedAt DESC) prev
    CROSS APPLY (SELECT TOP (1) s.Value FROM dbo.SensorReadings s JOIN dbo.Devices d ON d.DeviceId = s.DeviceId
                 WHERE d.ZoneId = a.ZoneId AND s.MetricCode = a.MetricCode ORDER BY s.RecordedAt DESC) last
    WHERE a.AlertType = 'THRESHOLD' AND a.Status = 'NEW'
      AND (atOpen.Value IS NULL OR atOpen.Value <> a.Value
           OR NOT (atOpen.Value < t.MinValue OR atOpen.Value > t.MaxValue)
           OR prev.Value < t.MinValue OR prev.Value > t.MaxValue
           OR NOT (last.Value < t.MinValue OR last.Value > t.MaxValue)))
    THROW 59999, N'seed: canh bao NEW phai tao luc so do dau tien vuot nguong va van con mo', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Alerts a JOIN dbo.Zones z ON z.ZoneId = a.ZoneId JOIN dbo.Houses h ON h.HouseId = z.HouseId
               WHERE a.AlertType = 'THRESHOLD' AND a.MetricCode = 'HUMID' AND a.Status = 'NEW' AND h.Name = N'H1' AND z.Name = N'F3'
                 AND a.Value = 74.97 AND a.CreatedAt = '2026-10-12T07:00:00')   -- 14:00 VN ngay neo
    THROW 59999, N'seed: H1-F3 HUMID phai tao luc 14:00 VN ngay neo, gia tri 74.97', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.Alerts a JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
               WHERE a.AlertType = 'PREDATOR' AND a.Status = 'ACK' AND a.DetectedClass = 'snake' AND d.Code = 'H1-F0-CAMERA')
    THROW 59999, N'seed: thieu PREDATOR snake ACK o H1-F0', 1;
GO

PRINT N'seed: demo giam dan H2 sau 20:00 ngay neo';
BEGIN TRY
    BEGIN TRAN;
    CREATE TABLE #d (NewAlertsJson NVARCHAR(MAX));
    INSERT #d EXEC dbo.sp_DetectAnomalies @NowUtc = '2026-10-12T13:30:00';   -- 20:30 VN ngay neo
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts a JOIN dbo.Houses h ON h.HouseId = a.HouseId
                   WHERE a.AlertType = 'POPULATION_DROP' AND h.Name = N'H2')
        THROW 59999, N'seed: H2 phai co POPULATION_DROP', 1;
    IF EXISTS (SELECT 1 FROM dbo.Alerts a JOIN dbo.Houses h ON h.HouseId = a.HouseId
               WHERE a.AlertType = 'POPULATION_DROP' AND h.Name = N'H1')
        THROW 59999, N'seed: H1 khong duoc co POPULATION_DROP', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO
PRINT N'seed day du: PASS';
GO
```

Run: `npm test` → Expected: FAIL `seed: SensorReadings phai co 54144 dong`.

- [ ] **Step 2: Viết `database/sql/seed/02-readings.sql`**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM dbo.SensorReadings)
BEGIN
    PRINT N'seed 02: da co so do, bo qua';
    RETURN;
END

DECLARE @AnchorVn DATE = '$(AnchorDateVn)';
-- 00:00 gio VN cua ngay neo - 7, doi sang UTC (VN = UTC+7 co dinh).
DECLARE @StartUtc DATETIME2(0) = DATEADD(HOUR, -7, CAST(DATEADD(DAY, -7, @AnchorVn) AS DATETIME2(0)));
DECLARE @Pi FLOAT = PI();

BEGIN TRAN;

-- 2256 moc 5 phut: 7 ngay du (7 x 288) + 240 moc cua ngay neo (00:00 -> 19:55 VN).
WITH n AS (
    SELECT TOP (2256) i = ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1
    FROM sys.all_objects a CROSS JOIN sys.all_objects b),
s AS (
    SELECT d.DeviceId, d.Code, z.FloorNo
    FROM dbo.Devices d JOIN dbo.Zones z ON z.ZoneId = d.ZoneId
    WHERE d.DeviceType = 'SENSOR'),
p AS (
    SELECT s.DeviceId, s.Code, s.FloorNo, n.i,
           HourVn = (n.i % 288) * 5 / 60.0,          -- gio trong ngay (gio VN)
           DayIdx = n.i / 288,                        -- 0 = ngay neo - 7, 7 = ngay neo
           RecordedAt = DATEADD(MINUTE, 5 * n.i, @StartUtc)
    FROM n CROSS JOIN s)
INSERT dbo.SensorReadings (DeviceId, MetricCode, Value, RecordedAt)
SELECT p.DeviceId, m.MetricCode,
       CAST(ROUND(CASE m.MetricCode
            WHEN 'TEMP' THEN
                CASE WHEN p.Code = 'H1-F2-SENSOR' AND p.DayIdx = 5 AND p.HourVn >= 13 AND p.HourVn < 15 THEN 31.5   -- doan nong ngay neo - 2
                     ELSE 28 + 1.5 * SIN(2 * @Pi * (p.HourVn - 9) / 24) + 0.1 * p.FloorNo END
            WHEN 'HUMID' THEN
                CASE WHEN p.Code = 'H1-F3-SENSOR' AND p.DayIdx = 7 THEN 82 - 10.0 * (p.i % 288) * 5 / 1195   -- giam dan: 13:55 = 75.01, 14:00 = 74.97 (duoi nguong), 19:55 = 72
                     ELSE 82 + 4 * SIN(2 * @Pi * p.HourVn / 24) END
            WHEN 'CO2' THEN 600 + 150 * SIN(2 * @Pi * p.HourVn / 24)
            ELSE CASE WHEN p.HourVn >= 6 AND p.HourVn < 18 THEN 5 ELSE 1 END
       END, 2) AS DECIMAL(9, 2)),
       p.RecordedAt
FROM p CROSS JOIN dbo.Metrics m;

UPDATE d
SET LastSeenAt = x.LastAt, Status = 'ONLINE'
FROM dbo.Devices d
JOIN (SELECT DeviceId, LastAt = MAX(RecordedAt) FROM dbo.SensorReadings GROUP BY DeviceId) x ON x.DeviceId = d.DeviceId;

COMMIT;
PRINT N'seed 02: xong';
```

- [ ] **Step 3: Viết `database/sql/seed/03-birdcounts.sql`**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM dbo.BirdCounts)
BEGIN
    PRINT N'seed 03: da co dem chim, bo qua';
    RETURN;
END

DECLARE @AnchorVn DATE = '$(AnchorDateVn)';

BEGIN TRAN;

-- 8 ngay (ngay neo - 7 .. ngay neo); ra 05:00-06:55, ve 17:00-19:25 gio VN (cua so 5 phut).
-- H1 binh thuong; H2 ngay neo ve it hon 40% -> demo POPULATION_DROP sau 20:00.
WITH days AS (SELECT d = v.d FROM (VALUES (0), (1), (2), (3), (4), (5), (6), (7)) v (d)),
w AS (
    SELECT k = ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1
    FROM (VALUES (0), (1), (2), (3), (4), (5)) a (x) CROSS JOIN (VALUES (0), (1), (2), (3), (4)) b (y)),   -- 30 so thu tu
slots AS (
    SELECT Kind = 'OUT', k, MinuteVn = 5 * 60 + 5 * k FROM w WHERE k < 24      -- 05:00 .. 06:55
    UNION ALL
    SELECT Kind = 'IN', k, MinuteVn = 17 * 60 + 5 * k FROM w WHERE k < 30),    -- 17:00 .. 19:25
cams AS (
    SELECT d.DeviceId, h.Name AS HouseName
    FROM dbo.Devices d JOIN dbo.Zones z ON z.ZoneId = d.ZoneId JOIN dbo.Houses h ON h.HouseId = z.HouseId
    WHERE d.DeviceType = 'CAMERA')
INSERT dbo.BirdCounts (CameraId, WindowStart, InCount, OutCount)
SELECT c.DeviceId,
       DATEADD(HOUR, -7, DATEADD(MINUTE, s.MinuteVn, CAST(DATEADD(DAY, dd.d - 7, @AnchorVn) AS DATETIME2(0)))),
       CASE WHEN s.Kind = 'IN'
            THEN CASE WHEN c.HouseName = N'H2' AND dd.d = 7 THEN (15 + s.k % 3) * 6 / 10
                      WHEN c.HouseName = N'H2' THEN 15 + s.k % 3
                      ELSE 20 + s.k % 3 END
            ELSE 0 END,
       CASE WHEN s.Kind = 'OUT' THEN (CASE WHEN c.HouseName = N'H2' THEN 18 ELSE 24 END) + s.k % 2 ELSE 0 END
FROM cams c CROSS JOIN days dd CROSS JOIN slots s;

COMMIT;
PRINT N'seed 03: xong';
```

Kiểm nhẩm: 2 camera × 8 ngày × (24 + 30) cửa sổ = 864 dòng. H2 ngày thường về 15–17/cửa sổ × 30 ≈ 480; ngày neo ≈ 60% → giảm khoảng 40% > 20%.

- [ ] **Step 4: Viết `database/sql/seed/04-alerts.sql`**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM dbo.Alerts)
BEGIN
    PRINT N'seed 04: da co canh bao, bo qua';
    RETURN;
END

DECLARE @AnchorVn DATE = '$(AnchorDateVn)';
DECLARE @AnchorStartUtc DATETIME2(0) = DATEADD(HOUR, -7, CAST(@AnchorVn AS DATETIME2(0)));   -- 00:00 VN ngay neo
DECLARE @h1 INT = (SELECT HouseId FROM dbo.Houses WHERE Name = N'H1');
DECLARE @f2 INT = (SELECT ZoneId FROM dbo.Zones WHERE HouseId = @h1 AND Name = N'F2');
DECLARE @f3 INT = (SELECT ZoneId FROM dbo.Zones WHERE HouseId = @h1 AND Name = N'F3');
DECLARE @owner1 INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
DECLARE @id INT;

-- Ngoai le co chu y cua seed: chen THRESHOLD lich su truc tiep (trigger van sinh AlertHistory, nguoi thao tac = he thong).
EXEC sys.sp_set_session_context @key = N'UserId', @value = NULL;
EXEC sys.sp_set_session_context @key = N'Note', @value = NULL;

-- 1) H1-F2 TEMP: doan nong 13:00-15:00 VN ngay neo - 2, he thong tu dong luc 15:00.
INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message, CreatedAt)
VALUES (@h1, @f2, 'THRESHOLD', 'WARNING', 'TEMP', 31.5, N'Nhiệt độ vượt ngưỡng trên 30.00 °C: 31.50 °C',
        DATEADD(HOUR, 13, DATEADD(DAY, -2, @AnchorStartUtc)));
SET @id = SCOPE_IDENTITY();
UPDATE dbo.Alerts SET Status = 'RESOLVED', ResolvedAt = DATEADD(HOUR, 15, DATEADD(DAY, -2, @AnchorStartUtc)) WHERE AlertId = @id;

-- 2) H1-F3 HUMID: dang mo, tao luc so do dau tien duoi 75 (14:00 VN ngay neo, 74.97%);
--    13:55 con 75.01 (trong nguong), cuoi du lieu 72% van ngoai nguong nen chua dong.
INSERT dbo.Alerts (HouseId, ZoneId, AlertType, Severity, MetricCode, Value, Message, CreatedAt)
VALUES (@h1, @f3, 'THRESHOLD', 'WARNING', 'HUMID', 74.97, N'Độ ẩm dưới ngưỡng dưới 75.00 %: 74.97 %',
        DATEADD(HOUR, 14, @AnchorStartUtc));

-- 3) PREDATOR qua SP (18:30 VN ngay neo), roi chu nha xac nhan.
DECLARE @pj NVARCHAR(MAX) = CONCAT(N'{"camera":"H1-F0-CAMERA","class":"snake","confidence":0.91,',
    N'"snapshot":"snapshots/seed/H1-F0-CAMERA_snake_seed.jpg","at":"',
    CONVERT(CHAR(19), DATEADD(MINUTE, 18 * 60 + 30, @AnchorStartUtc), 126), N'Z"}');
DECLARE @pr TABLE (Created BIT, AlertId INT, SkipReason VARCHAR(20), AlertJson NVARCHAR(MAX));
INSERT @pr EXEC dbo.sp_CreatePredatorAlert @pj;
SELECT @id = AlertId FROM @pr;
DECLARE @ack TABLE (AlertId INT, HouseId INT, ZoneId INT, AlertType VARCHAR(20), Status VARCHAR(10), ResolvedAt DATETIME2(0), ResolvedBy INT);
INSERT @ack EXEC dbo.sp_UpdateAlertStatus @AlertId = @id, @Status = 'ACK', @UserId = @owner1, @Note = N'Đã kiểm tra camera, rắn đã bỏ đi';

PRINT N'seed 04: xong';
```

Lưu ý: `INSERT … EXEC` vào biến bảng không lồng nhau với `INSERT … EXEC` bên trong SP (các SP này không dùng `INSERT … EXEC`), nên hợp lệ.

- [ ] **Step 5: Chạy test**

Run: `npm test`
Expected: `seed day du: PASS` và **mọi file khác vẫn đạt** (đặc biệt `sp_IngestReadings` lô 1000: H1-F3 HUMID đã có cảnh báo mở trong seed nên ra 23 cảnh báo mới, vẫn > 2033 ký tự).

- [ ] **Step 6: Kiểm tra demo với ngày neo khác**

```powershell
npm run reset:dev -- -AnchorDateVn (Get-Date).AddDays(-1).ToString('yyyy-MM-dd')
sqlcmd -S localhost,1433 -U swiftlet_dev -d SwiftletCare_Dev -Q "SELECT COUNT(*) FROM dbo.SensorReadings; SELECT MAX(RecordedAt) FROM dbo.SensorReadings"
```

Expected: 54144 dòng; mốc cuối là 12:55Z của hôm qua (19:55 VN), nằm trong quá khứ.

- [ ] **Step 7: Commit**

```bash
git add database/sql/seed database/tests/seed.test.sql
git commit -m "feat(database): dữ liệu mẫu cố định (số đo, đếm chim, cảnh báo) neo theo AnchorDateVn

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Test hợp đồng cột JSON và README

**Files:**
- Create: `database/tests/sp_json-columns.test.sql`, `database/README.md`

**Interfaces:**
- Consumes: `sp_IngestReadings`, `sp_CreatePredatorAlert`, `sp_DetectAnomalies`, dữ liệu mẫu ngày neo mặc định.
- Produces: bằng chứng các cột JSON khớp integration-contract 4.2 (14 khóa, kể cả khóa NULL; thời gian có `Z`); README cho cả nhóm.

- [ ] **Step 1: Viết `database/tests/sp_json-columns.test.sql`**

Test này chạy ngay được (SP đã có) — mục đích là khóa hợp đồng, nếu fail nghĩa là một SP trước đó lệch quy ước JSON và phải sửa SP đó.

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #keys (k NVARCHAR(50) PRIMARY KEY);
INSERT #keys (k) VALUES (N'AlertId'), (N'HouseId'), (N'ZoneId'), (N'DeviceId'), (N'AlertType'), (N'Severity'), (N'MetricCode'),
    (N'Value'), (N'DetectedClass'), (N'Confidence'), (N'HasSnapshot'), (N'Message'), (N'Status'), (N'CreatedAt');
CREATE TABLE #ing (Received INT, Accepted INT, Duplicates INT, Rejected INT, AcceptedJson NVARCHAR(MAX), NewAlertsJson NVARCHAR(MAX), ResolvedAlertIdsJson NVARCHAR(MAX));
CREATE TABLE #pr (Created BIT, AlertId INT, SkipReason VARCHAR(20), AlertJson NVARCHAR(MAX));
CREATE TABLE #da (NewAlertsJson NVARCHAR(MAX));
GO

PRINT N'json: AcceptedJson chi chua dong da chen; NewAlertsJson du 14 khoa ke ca NULL; thoi gian co Z';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @s NVARCHAR(30) = CONCAT(CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), 'Z');
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[',
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', @s, N'"},',
        N'{"device":"H1-F1-SENSOR","metric":"TEMP","value":31,"at":"', @s, N'"},',      -- trung
        N'{"device":"KHONG-CO","metric":"TEMP","value":31,"at":"', @s, N'"}]');         -- bi loai
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    IF (SELECT COUNT(*) FROM OPENJSON((SELECT AcceptedJson FROM #ing))) <> 1
        THROW 59999, N'json: AcceptedJson phai chi co 1 phan tu', 1;
    IF EXISTS (SELECT 1 FROM OPENJSON((SELECT AcceptedJson FROM #ing)) WITH (RecordedAt NVARCHAR(40)) WHERE RecordedAt NOT LIKE N'%Z')
        THROW 59999, N'json: AcceptedJson.RecordedAt phai co Z', 1;

    DECLARE @alert NVARCHAR(MAX) = (SELECT JSON_QUERY(NewAlertsJson, '$[0]') FROM #ing);
    IF (SELECT COUNT(*) FROM OPENJSON(@alert)) <> 14 THROW 59999, N'json: canh bao phai co dung 14 khoa', 1;
    IF EXISTS (SELECT k FROM #keys EXCEPT SELECT [key] FROM OPENJSON(@alert))
        THROW 59999, N'json: thieu khoa trong danh sach truong canh bao', 1;
    IF NOT EXISTS (SELECT 1 FROM OPENJSON(@alert) WHERE [key] = N'DetectedClass' AND [type] = 0)
        THROW 59999, N'json: DetectedClass cua THRESHOLD phai co mat voi gia tri null', 1;
    IF JSON_VALUE(@alert, '$.CreatedAt') NOT LIKE N'%Z' THROW 59999, N'json: CreatedAt phai co Z', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'json: AlertJson cua thien dich du 14 khoa; NULL khi Created = 0';
BEGIN TRY
    BEGIN TRAN;
    INSERT #pr EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H2-F0-CAMERA","class":"rat","confidence":0.8,"snapshot":"snapshots/x.jpg","at":"2026-09-01T10:00:00Z"}';
    DECLARE @a NVARCHAR(MAX) = (SELECT AlertJson FROM #pr);
    IF (SELECT COUNT(*) FROM OPENJSON(@a)) <> 14 THROW 59999, N'json: AlertJson phai co 14 khoa', 1;
    IF NOT EXISTS (SELECT 1 FROM OPENJSON(@a) WHERE [key] = N'MetricCode' AND [type] = 0)
        THROW 59999, N'json: MetricCode cua PREDATOR phai co mat voi gia tri null', 1;
    DELETE #pr;
    INSERT #pr EXEC dbo.sp_CreatePredatorAlert N'{"camera":"H2-F0-CAMERA","class":"rat","confidence":0.8,"snapshot":"snapshots/y.jpg","at":"2026-09-01T10:01:00Z"}';
    IF (SELECT AlertJson FROM #pr) IS NOT NULL THROW 59999, N'json: AlertJson phai NULL khi Created = 0', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'json: NewAlertsJson cua sp_DetectAnomalies du 14 khoa (ZoneId, DeviceId null)';
BEGIN TRY
    BEGIN TRAN;
    INSERT #da EXEC dbo.sp_DetectAnomalies @NowUtc = '2026-10-12T13:30:00';
    DECLARE @drop NVARCHAR(MAX) = (SELECT TOP (1) value FROM OPENJSON((SELECT NewAlertsJson FROM #da))
                                   WHERE JSON_VALUE(value, '$.AlertType') = 'POPULATION_DROP');
    IF @drop IS NULL THROW 59999, N'json: can mot POPULATION_DROP tu du lieu mau', 1;
    IF (SELECT COUNT(*) FROM OPENJSON(@drop)) <> 14
       OR NOT EXISTS (SELECT 1 FROM OPENJSON(@drop) WHERE [key] = N'ZoneId' AND [type] = 0)
        THROW 59999, N'json: POPULATION_DROP phai du 14 khoa, ZoneId null', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO
PRINT N'sp_json-columns: PASS';
GO
```

- [ ] **Step 2: Chạy test**

Run: `npm test` → Expected: `sp_json-columns: PASS`. Nếu fail ở khóa NULL → SP tương ứng thiếu `INCLUDE_NULL_VALUES`; ở `Z` → SP chọn cột thời gian không qua `vw_AlertJson`/`CONCAT(…'Z')`. Sửa SP đó, không sửa test.

- [ ] **Step 3: Viết `database/README.md`**

````markdown
# SwiftletCare — database

Package CSDL SQL Server của SwiftletCare. Thiết kế: [spec database-core](../docs/superpowers/specs/2026-10-12-swiftletcare-database-core-design.md).

## Cài đặt (một lần mỗi máy)

1. Làm đủ checklist thiết lập môi trường trong spec (Mixed Mode, TCP/IP 1433, login `swiftlet_dev` có `dbcreator`).
2. `npm install`
3. Sao chép `.env.example` thành `.env`, điền `DB_PASSWORD` và mật khẩu trong `DATABASE_URL`. **Không commit `.env`.**

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run reset:dev` | Xóa và tạo lại `SwiftletCare_Dev` + dữ liệu mẫu (ngày neo 2026-10-12) |
| `npm run reset:dev -- -AnchorDateVn 2026-11-01` | Như trên, neo dữ liệu mẫu vào ngày khác (demo: neo = hôm qua) |
| `npm run deploy:dev` | Triển khai lên `SwiftletCare_Dev` không xóa dữ liệu |
| `npm test` | Tạo lại `SwiftletCare_Test`, chạy toàn bộ test |
| `powershell -File scripts/deploy.ps1 -Database SwiftletCare` | Triển khai bản demo (không bao giờ dùng `-Reset`; script sẽ từ chối) |

## Tài khoản dữ liệu mẫu

`admin` (ADMIN), `owner1` (nhà H1), `owner2` (nhà H2) — mật khẩu dev tạm **`SwiftletDev@2026`**.

> **Chỉ dùng cho phát triển và demo. Không dùng mật khẩu thật ở bất kỳ đâu trong repo.** Seed chỉ lưu hash bcrypt.

## Quy ước

- Bảng do `prisma/schema.prisma` định nghĩa; CHECK và SQL Prisma không biểu diễn được nằm cuối file migration (hoặc `sql/00-schema-extras/` — xem `spikes/RESULTS.md` mục R2).
- SP/trigger/view là file `CREATE OR ALTER` trong `sql/`, chạy theo thứ tự tên thư mục rồi tên file.
- Không ghi `Alerts` bằng Prisma; `Devices` chỉ UPDATE bằng `$executeRaw` (kết luận R1 trong `spikes/RESULTS.md`).
- Test: `tests/*.test.sql`, mỗi ca một transaction ROLLBACK; mẫu viết test ở đầu plan `docs/superpowers/plans/2026-10-14-swiftletcare-database-core.md`.
- Kết quả kiểm chứng R1–R6: `spikes/RESULTS.md`.
````

- [ ] **Step 4: Commit**

```bash
git add database/tests/sp_json-columns.test.sql database/README.md
git commit -m "test(database): khóa hợp đồng cột JSON; thêm README package database

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

**Ranh giới cắt.** Task 14–15 là mục 10–11 (dưới ranh giới cắt của roadmap). Nếu trễ tại M2/M3, cắt Task 14 trước, rồi Task 15. Task 16 là mục Nên có.

### Task 14: Harvests và `sp_Report_EnvStabilityVsYield` (mục 10 — dưới ranh giới cắt)

**Files:**
- Modify: `database/prisma/schema.prisma` (model `Harvests`; quan hệ ngược trong `Zones`, `Users`)
- Create: `database/prisma/migrations/<timestamp>_harvests/migration.sql`, `database/sql/02-functions-procs/sp_Report_EnvStabilityVsYield.sql`, `database/sql/seed/90-harvests.sql`, `database/tests/sp_Report_EnvStabilityVsYield.test.sql`

**Interfaces:**
- Produces:
  - Bảng `Harvests(HarvestId INT, ZoneId INT, HarvestDate DATE /* ngày giờ VN */, NestCount INT, WeightGram DECIMAL(9,1), Grade CHAR(1) NULL, RecordedBy INT, CreatedAt)`, UQ(ZoneId, HarvestDate), `CK_Harvests_Grade`, `CK_Harvests_NonNegative`.
  - `EXEC dbo.sp_Report_EnvStabilityVsYield @HouseId INT, @FromVnDate DATE, @ToVnDate DATE` (`@ToVnDate` loại trừ) → nhiều dòng `ZoneId INT, ZoneName NVARCHAR(50), MonthVn CHAR(7) /* yyyy-MM */, AvgTemp DECIMAL(9,2), StdevTemp DECIMAL(9,2), AvgHumid DECIMAL(9,2), StdevHumid DECIMAL(9,2), PctInRange DECIMAL(5,2), NestCount INT, WeightGram DECIMAL(9,1)`; `PctInRange` = % số đo TEMP và HUMID nằm trong ngưỡng của khu vực. From ≥ To → 50041.
  - Seed: 3 tháng thu hoạch (tháng của ngày neo và 2 tháng trước) cho H1 F1–F3, mỗi tầng một lần/tháng vào ngày 10.

- [ ] **Step 1: Viết test (phải fail)**

`database/tests/sp_Report_EnvStabilityVsYield.test.sql`:

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #r (ZoneId INT, ZoneName NVARCHAR(50), MonthVn CHAR(7), AvgTemp DECIMAL(9, 2), StdevTemp DECIMAL(9, 2),
                 AvgHumid DECIMAL(9, 2), StdevHumid DECIMAL(9, 2), PctInRange DECIMAL(5, 2), NestCount INT, WeightGram DECIMAL(9, 1));
GO

PRINT N'report: du lieu mau H1 thang 10/2026';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @h1 INT = (SELECT HouseId FROM dbo.Houses WHERE Name = N'H1');
    INSERT #r EXEC dbo.sp_Report_EnvStabilityVsYield @h1, '2026-08-01', '2026-11-01';
    IF NOT EXISTS (SELECT 1 FROM #r WHERE ZoneName = N'F1' AND MonthVn = '2026-10' AND AvgTemp BETWEEN 26 AND 30 AND NestCount > 0)
        THROW 59999, N'report: thieu dong F1 thang 10', 1;
    IF NOT EXISTS (SELECT 1 FROM #r WHERE ZoneName = N'F1' AND MonthVn = '2026-08' AND NestCount > 0 AND AvgTemp IS NULL)
        THROW 59999, N'report: thang chi co thu hoach van phai co dong (moi truong NULL)', 1;
    IF EXISTS (SELECT 1 FROM #r WHERE PctInRange < 0 OR PctInRange > 100)
        THROW 59999, N'report: PctInRange phai trong [0,100]', 1;
    IF (SELECT PctInRange FROM #r WHERE ZoneName = N'F2' AND MonthVn = '2026-10') >= 100
        THROW 59999, N'report: F2 co doan nong nen PctInRange < 100', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'report: From >= To -> 50041';
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_Report_EnvStabilityVsYield 1, '2026-10-31', '2026-08-01';
    THROW 59999, N'mong doi 50041', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50041 THROW; END CATCH
GO

PRINT N'report: Harvests CHECK Grade';
BEGIN TRY BEGIN TRAN;
    DECLARE @z INT = (SELECT TOP (1) ZoneId FROM dbo.Zones);
    DECLARE @u INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');
    INSERT dbo.Harvests (ZoneId, HarvestDate, NestCount, WeightGram, Grade, RecordedBy) VALUES (@z, '2026-01-01', 1, 10, 'D', @u);
    THROW 59999, N'Grade D: mong doi 547', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 547 THROW; END CATCH
GO
PRINT N'sp_Report_EnvStabilityVsYield: PASS';
GO
```

Run: `npm test` → Expected: FAIL (`Invalid object name 'dbo.Harvests'`).

- [ ] **Step 2: Thêm model và migration**

Trong `Zones` thêm `Harvests Harvests[]`; trong `Users` thêm `Harvests Harvests[]`. Thêm model:

```prisma
model Harvests {
  HarvestId   Int      @id @default(autoincrement())
  ZoneId      Int
  HarvestDate DateTime @db.Date
  NestCount   Int
  WeightGram  Decimal  @db.Decimal(9, 1)
  Grade       String?  @db.Char(1)
  RecordedBy  Int
  CreatedAt   DateTime @default(dbgenerated("sysutcdatetime()")) @db.DateTime2(0)

  Zone     Zones @relation(fields: [ZoneId], references: [ZoneId], onDelete: NoAction, onUpdate: NoAction)
  Recorder Users @relation(fields: [RecordedBy], references: [UserId], onDelete: NoAction, onUpdate: NoAction)

  @@unique([ZoneId, HarvestDate])
}
```

Tạo migration `harvests` (theo quy trình đã chốt ở Task 2: `migrate dev --create-only` hoặc `migrate diff`) và thêm cuối file:

```sql
IF OBJECT_ID(N'dbo.CK_Harvests_Grade', N'C') IS NULL
    ALTER TABLE dbo.Harvests ADD CONSTRAINT CK_Harvests_Grade CHECK (Grade IN ('A', 'B', 'C'));
IF OBJECT_ID(N'dbo.CK_Harvests_NonNegative', N'C') IS NULL
    ALTER TABLE dbo.Harvests ADD CONSTRAINT CK_Harvests_NonNegative CHECK (NestCount >= 0 AND WeightGram >= 0);
```

- [ ] **Step 3: Viết `database/sql/seed/90-harvests.sql`**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM dbo.Harvests)
BEGIN
    PRINT N'seed 90: da co thu hoach, bo qua';
    RETURN;
END

DECLARE @AnchorVn DATE = '$(AnchorDateVn)';
DECLARE @MonthStart DATE = DATEFROMPARTS(YEAR(@AnchorVn), MONTH(@AnchorVn), 1);
DECLARE @owner1 INT = (SELECT UserId FROM dbo.Users WHERE Username = 'owner1');

-- H1 tang 1-3, ngay 10 cua thang neo va 2 thang truoc. Tang cao hon on dinh hon -> nhieu to hon.
INSERT dbo.Harvests (ZoneId, HarvestDate, NestCount, WeightGram, Grade, RecordedBy)
SELECT z.ZoneId, DATEADD(DAY, 9, DATEADD(MONTH, -m.k, @MonthStart)),
       40 + 5 * z.FloorNo - 3 * m.k,
       CAST((40 + 5 * z.FloorNo - 3 * m.k) * 8.5 AS DECIMAL(9, 1)),
       CASE WHEN z.FloorNo = 3 THEN 'A' WHEN z.FloorNo = 2 THEN 'B' ELSE 'C' END,
       @owner1
FROM dbo.Zones z
JOIN dbo.Houses h ON h.HouseId = z.HouseId AND h.Name = N'H1'
CROSS JOIN (VALUES (0), (1), (2)) m (k)
WHERE z.FloorNo BETWEEN 1 AND 3;
PRINT N'seed 90: xong';
```

- [ ] **Step 4: Viết `database/sql/02-functions-procs/sp_Report_EnvStabilityVsYield.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_Report_EnvStabilityVsYield
    @HouseId    INT,
    @FromVnDate DATE,
    @ToVnDate   DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @FromVnDate IS NULL OR @ToVnDate IS NULL OR @FromVnDate >= @ToVnDate
        THROW 50041, N'Khoang ngay khong hop le (From >= To).', 1;

    -- Doi moc ngay VN sang UTC roi so truc tiep voi cot (SARGable).
    DECLARE @FromUtc DATETIME2(0) = DATEADD(HOUR, -7, CAST(@FromVnDate AS DATETIME2(0)));
    DECLARE @ToUtc   DATETIME2(0) = DATEADD(HOUR, -7, CAST(@ToVnDate AS DATETIME2(0)));

    WITH env AS (
        SELECT d.ZoneId,
               MonthVn = CONVERT(CHAR(7), DATEADD(HOUR, 7, s.RecordedAt), 126),
               AvgTemp    = AVG(CASE WHEN s.MetricCode = 'TEMP'  THEN CAST(s.Value AS FLOAT) END),
               StdevTemp  = STDEV(CASE WHEN s.MetricCode = 'TEMP'  THEN CAST(s.Value AS FLOAT) END),
               AvgHumid   = AVG(CASE WHEN s.MetricCode = 'HUMID' THEN CAST(s.Value AS FLOAT) END),
               StdevHumid = STDEV(CASE WHEN s.MetricCode = 'HUMID' THEN CAST(s.Value AS FLOAT) END),
               InRange = SUM(CASE WHEN s.MetricCode IN ('TEMP', 'HUMID')
                                   AND (t.MinValue IS NULL OR s.Value >= t.MinValue)
                                   AND (t.MaxValue IS NULL OR s.Value <= t.MaxValue) THEN 1 ELSE 0 END),
               Total   = SUM(CASE WHEN s.MetricCode IN ('TEMP', 'HUMID') THEN 1 ELSE 0 END)
        FROM dbo.SensorReadings s
        JOIN dbo.Devices d ON d.DeviceId = s.DeviceId
        JOIN dbo.Zones z ON z.ZoneId = d.ZoneId AND z.HouseId = @HouseId
        LEFT JOIN dbo.Thresholds t ON t.ZoneId = d.ZoneId AND t.MetricCode = s.MetricCode
        WHERE s.RecordedAt >= @FromUtc AND s.RecordedAt < @ToUtc
        GROUP BY d.ZoneId, CONVERT(CHAR(7), DATEADD(HOUR, 7, s.RecordedAt), 126)),
    yld AS (
        SELECT hv.ZoneId, MonthVn = CONVERT(CHAR(7), hv.HarvestDate, 126),
               NestCount = SUM(hv.NestCount), WeightGram = SUM(hv.WeightGram)
        FROM dbo.Harvests hv
        JOIN dbo.Zones z ON z.ZoneId = hv.ZoneId AND z.HouseId = @HouseId
        WHERE hv.HarvestDate >= @FromVnDate AND hv.HarvestDate < @ToVnDate
        GROUP BY hv.ZoneId, CONVERT(CHAR(7), hv.HarvestDate, 126))
    SELECT z.ZoneId, ZoneName = z.Name, k.MonthVn,
           AvgTemp    = CAST(e.AvgTemp AS DECIMAL(9, 2)),
           StdevTemp  = CAST(e.StdevTemp AS DECIMAL(9, 2)),
           AvgHumid   = CAST(e.AvgHumid AS DECIMAL(9, 2)),
           StdevHumid = CAST(e.StdevHumid AS DECIMAL(9, 2)),
           PctInRange = CAST(CASE WHEN e.Total > 0 THEN 100.0 * e.InRange / e.Total END AS DECIMAL(5, 2)),
           y.NestCount, y.WeightGram
    FROM (SELECT ZoneId, MonthVn FROM env UNION SELECT ZoneId, MonthVn FROM yld) k
    JOIN dbo.Zones z ON z.ZoneId = k.ZoneId
    LEFT JOIN env e ON e.ZoneId = k.ZoneId AND e.MonthVn = k.MonthVn
    LEFT JOIN yld y ON y.ZoneId = k.ZoneId AND y.MonthVn = k.MonthVn
    ORDER BY z.FloorNo, k.MonthVn;
END
GO
```

- [ ] **Step 5: Chạy test**

Run: `npm test` → Expected: `sp_Report_EnvStabilityVsYield: PASS`, mọi file khác đạt (seed test vẫn đạt vì không đếm Harvests).

- [ ] **Step 6: Commit**

```bash
git add database/prisma database/sql/02-functions-procs/sp_Report_EnvStabilityVsYield.sql database/sql/seed/90-harvests.sql database/tests/sp_Report_EnvStabilityVsYield.test.sql
git commit -m "feat(database): Harvests và báo cáo tương quan môi trường - sản lượng (mục 10)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 15: Thiết bị mất kết nối — `trg_Devices_Status`, `sp_RecordHeartbeat`, phần OFFLINE của `sp_DetectAnomalies` (mục 11 — dưới ranh giới cắt)

**Files:**
- Create: `database/sql/03-triggers/trg_Devices_Status.sql`, `database/sql/02-functions-procs/sp_RecordHeartbeat.sql`, `database/tests/sp_RecordHeartbeat.test.sql`, `database/tests/trg_Devices_Status.test.sql`
- Modify: `database/sql/02-functions-procs/sp_DetectAnomalies.sql` (thay dòng chú thích `-- ===== OFFLINE (muc 11): Task 15 bo sung tai day =====`), `database/sql/02-functions-procs/sp_IngestReadings.sql` (khối đổi `Status = 'ONLINE'`)

**Interfaces:**
- Consumes: `sp_DetectAnomalies` (Task 11), seed (6 cảm biến ONLINE, `LastSeenAt = 2026-10-12T12:55:00`; cơ cấu chấp hành và camera `OFFLINE`, `LastSeenAt` NULL).
- Produces:
  - Trigger: `ONLINE → OFFLINE/ERROR` tạo `DEVICE_OFFLINE` (ERROR = CRITICAL, OFFLINE = WARNING) nếu thiết bị chưa có cảnh báo này đang mở; `* → ONLINE` tự đóng `DEVICE_OFFLINE` đang mở.
  - `sp_DetectAnomalies` đánh dấu OFFLINE thiết bị `IsActive = 1`, `Status = 'ONLINE'`, `LastSeenAt < @NowUtc − @OfflineMinutes`; `NewAlertsJson` gồm cả cảnh báo trigger vừa tạo.
  - `EXEC dbo.sp_RecordHeartbeat @Json NVARCHAR(MAX)` — mảng `{device, at}` → 1 dòng `Accepted INT, Rejected INT, ResolvedAlertIdsJson NVARCHAR(MAX)`; nhận mọi thiết bị đang dùng; 50030 khi không phải mảng JSON.
  - **Cảnh báo tự đóng tới được client:** `sp_IngestReadings` và `sp_RecordHeartbeat` đưa các `DEVICE_OFFLINE` mà trigger vừa đóng (thiết bị về ONLINE) vào `ResolvedAlertIdsJson` (cùng dạng `[{"AlertId": n}]`, `[]` khi rỗng); backend phát `alert.updated` như cảnh báo ngưỡng tự đóng. Đọc cảnh báo đang mở bằng `UPDLOCK, HOLDLOCK` trước khi đổi Status để hai lô đồng thời không cùng báo một cảnh báo.
- Ghi chú R1: trigger này chỉ `AFTER UPDATE`; backend chỉ UPDATE Devices bằng `$executeRaw` không `OUTPUT` (Task 3), nên trigger giữ được.

- [ ] **Step 1: Viết test `database/tests/sp_RecordHeartbeat.test.sql` (phải fail)**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #r (Accepted INT, Rejected INT, ResolvedAlertIdsJson NVARCHAR(MAX));
GO

PRINT N'heartbeat: cap nhat LastSeenAt, OFFLINE -> ONLINE, giu gia tri lon hon, loai phan tu sai';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @t DATETIME2(0) = CAST(SYSUTCDATETIME() AS DATETIME2(0));
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-FAN","at":"', CONVERT(CHAR(19), @t, 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_RecordHeartbeat @j;
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Accepted = 1 AND Rejected = 0 AND ResolvedAlertIdsJson = N'[]')
        THROW 59999, N'heartbeat: dem sai / khong co canh bao nao de dong', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.Devices WHERE Code = 'H1-F1-FAN' AND Status = 'ONLINE' AND LastSeenAt = @t)
        THROW 59999, N'heartbeat: phai ONLINE, LastSeenAt = at', 1;
    DELETE #r;

    SET @j = CONCAT(N'[{"device":"H1-F1-FAN","at":"', CONVERT(CHAR(19), DATEADD(MINUTE, -3, @t), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_RecordHeartbeat @j;
    IF NOT EXISTS (SELECT 1 FROM dbo.Devices WHERE Code = 'H1-F1-FAN' AND LastSeenAt = @t)
        THROW 59999, N'heartbeat: at cu hon phai giu LastSeenAt lon hon', 1;
    DELETE #r;

    UPDATE dbo.Devices SET IsActive = 0 WHERE Code = 'H1-F2-FAN';
    SET @j = CONCAT(N'[{"device":"KHONG-CO","at":"', CONVERT(CHAR(19), @t, 126), N'Z"},',
                    N'{"device":"H1-F2-FAN","at":"', CONVERT(CHAR(19), @t, 126), N'Z"},',
                    N'{"device":"H1-F3-FAN","at":"', CONVERT(CHAR(19), @t, 126), N'"}]');
    INSERT #r EXEC dbo.sp_RecordHeartbeat @j;
    IF NOT EXISTS (SELECT 1 FROM #r WHERE Accepted = 0 AND Rejected = 3)
        THROW 59999, N'heartbeat: thiet bi la / ngung dung / thieu Z phai bi loai, khong loi', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'heartbeat: ve ONLINE -> DEVICE_OFFLINE trigger dong nam trong ResolvedAlertIdsJson';
BEGIN TRY
    BEGIN TRAN;
    UPDATE dbo.Devices SET Status = 'ONLINE' WHERE Code = 'H1-F1-FAN';
    UPDATE dbo.Devices SET Status = 'OFFLINE' WHERE Code = 'H1-F1-FAN';   -- trigger mo DEVICE_OFFLINE
    DECLARE @off INT = (SELECT a.AlertId FROM dbo.Alerts a JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
                        WHERE d.Code = 'H1-F1-FAN' AND a.AlertType = 'DEVICE_OFFLINE' AND a.Status = 'NEW');
    IF @off IS NULL THROW 59999, N'heartbeat: chuan bi - trigger phai mo DEVICE_OFFLINE', 1;
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-FAN","at":"',
                                      CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), N'Z"}]');
    INSERT #r EXEC dbo.sp_RecordHeartbeat @j;
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts WHERE AlertId = @off AND Status = 'RESOLVED' AND ResolvedBy IS NULL)
        THROW 59999, N'heartbeat: DEVICE_OFFLINE phai tu dong', 1;
    IF (SELECT COUNT(*) FROM OPENJSON((SELECT ResolvedAlertIdsJson FROM #r))) <> 1
       OR (SELECT CAST(JSON_VALUE(ResolvedAlertIdsJson, '$[0].AlertId') AS INT) FROM #r) <> @off
        THROW 59999, N'heartbeat: ResolvedAlertIdsJson phai chua dung AlertId vua dong', 1;
    DELETE #r;

    -- Gui lai: da ONLINE, khong dong gi them.
    INSERT #r EXEC dbo.sp_RecordHeartbeat @j;
    IF (SELECT ResolvedAlertIdsJson FROM #r) <> N'[]' THROW 59999, N'heartbeat: gui lai khong duoc bao dong lan nua', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'heartbeat: JSON sai -> 50030';
BEGIN TRY BEGIN TRAN;
    EXEC dbo.sp_RecordHeartbeat N'{"device":"H1-F1-FAN"}';
    THROW 59999, N'mong doi 50030', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 50030 THROW; END CATCH
GO
PRINT N'sp_RecordHeartbeat: PASS';
GO
```

- [ ] **Step 2: Viết test `database/tests/trg_Devices_Status.test.sql` (phải fail)**

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
CREATE TABLE #da (NewAlertsJson NVARCHAR(MAX));
CREATE TABLE #ing (Received INT, Accepted INT, Duplicates INT, Rejected INT, AcceptedJson NVARCHAR(MAX), NewAlertsJson NVARCHAR(MAX), ResolvedAlertIdsJson NVARCHAR(MAX));
GO

PRINT N'offline: sp_DetectAnomalies danh dau OFFLINE, trigger tao canh bao, NewAlertsJson co du';
BEGIN TRY
    BEGIN TRAN;
    INSERT #da EXEC dbo.sp_DetectAnomalies @NowUtc = '2026-10-12T13:30:00';   -- 35 phut sau so do cuoi
    IF (SELECT COUNT(*) FROM dbo.Devices WHERE DeviceType = 'SENSOR' AND Status = 'OFFLINE') <> 6
        THROW 59999, N'offline: 6 cam bien phai bi danh dau OFFLINE', 1;
    IF (SELECT COUNT(*) FROM dbo.Alerts WHERE AlertType = 'DEVICE_OFFLINE' AND Status = 'NEW' AND Severity = 'WARNING'
        AND ZoneId IS NOT NULL AND DeviceId IS NOT NULL) <> 6
        THROW 59999, N'offline: phai co 6 canh bao DEVICE_OFFLINE WARNING', 1;
    IF (SELECT COUNT(*) FROM OPENJSON((SELECT NewAlertsJson FROM #da)) WHERE JSON_VALUE(value, '$.AlertType') = 'DEVICE_OFFLINE') <> 6
        THROW 59999, N'offline: NewAlertsJson phai chua 6 canh bao do trigger tao', 1;
    IF EXISTS (SELECT 1 FROM dbo.Devices WHERE DeviceType <> 'SENSOR' AND Status = 'ONLINE')
        THROW 59999, N'offline: thiet bi chua tung ONLINE khong bi dong toi', 1;
    DELETE #da;

    -- Chay lai: khong tao them.
    INSERT #da EXEC dbo.sp_DetectAnomalies @NowUtc = '2026-10-12T13:31:00';
    IF (SELECT COUNT(*) FROM dbo.Alerts WHERE AlertType = 'DEVICE_OFFLINE') <> 6
        THROW 59999, N'offline: chay lai khong duoc tao them', 1;

    -- Thiet bi gui du lieu tro lai -> ONLINE -> trigger tu dong canh bao.
    DECLARE @j NVARCHAR(MAX) = CONCAT(N'[{"device":"H1-F1-SENSOR","metric":"TEMP","value":28,"at":"',
                                      CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), N'Z"}]');
    INSERT #ing EXEC dbo.sp_IngestReadings @j;
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts a JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
                   WHERE d.Code = 'H1-F1-SENSOR' AND a.AlertType = 'DEVICE_OFFLINE' AND a.Status = 'RESOLVED' AND a.ResolvedBy IS NULL)
        THROW 59999, N'offline: ve ONLINE phai tu dong DEVICE_OFFLINE', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.AlertHistory h JOIN dbo.Alerts a ON a.AlertId = h.AlertId JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
                   WHERE d.Code = 'H1-F1-SENSOR' AND a.AlertType = 'DEVICE_OFFLINE' AND h.NewStatus = 'RESOLVED' AND h.UserId IS NULL)
        THROW 59999, N'offline: lich su dong phai ghi nguoi thao tac = he thong', 1;
    -- Canh bao tu dong phai toi duoc client: chi dung 1 AlertId cua H1-F1-SENSOR (5 cam bien kia van OFFLINE).
    IF (SELECT COUNT(*) FROM OPENJSON((SELECT ResolvedAlertIdsJson FROM #ing))) <> 1
       OR (SELECT CAST(JSON_VALUE(ResolvedAlertIdsJson, '$[0].AlertId') AS INT) FROM #ing)
          <> (SELECT a.AlertId FROM dbo.Alerts a JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
              WHERE d.Code = 'H1-F1-SENSOR' AND a.AlertType = 'DEVICE_OFFLINE')
        THROW 59999, N'offline: sp_IngestReadings phai dua DEVICE_OFFLINE vua dong vao ResolvedAlertIdsJson', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO

PRINT N'offline: trigger theo tap hop, ERROR = CRITICAL, doi cot khac khong tao canh bao';
BEGIN TRY
    BEGIN TRAN;
    UPDATE dbo.Devices SET Status = 'OFFLINE' WHERE Code IN ('H1-F1-SENSOR', 'H1-F2-SENSOR');
    IF (SELECT COUNT(*) FROM dbo.Alerts WHERE AlertType = 'DEVICE_OFFLINE') <> 2
        THROW 59999, N'offline: mot UPDATE 2 thiet bi phai tao 2 canh bao', 1;
    UPDATE dbo.Devices SET Status = 'ERROR' WHERE Code = 'H2-F1-SENSOR';
    IF NOT EXISTS (SELECT 1 FROM dbo.Alerts a JOIN dbo.Devices d ON d.DeviceId = a.DeviceId
                   WHERE d.Code = 'H2-F1-SENSOR' AND a.AlertType = 'DEVICE_OFFLINE' AND a.Severity = 'CRITICAL')
        THROW 59999, N'offline: ERROR phai la CRITICAL', 1;
    UPDATE dbo.Devices SET Name = N'Đổi tên' WHERE Code = 'H2-F0-SENSOR';
    IF (SELECT COUNT(*) FROM dbo.Alerts WHERE AlertType = 'DEVICE_OFFLINE') <> 3
        THROW 59999, N'offline: doi ten khong duoc tao canh bao', 1;
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO
PRINT N'trg_Devices_Status: PASS';
GO
```

Run: `npm test` → Expected: FAIL (`Could not find stored procedure 'dbo.sp_RecordHeartbeat'`; `trg_Devices_Status` chưa có nên 6 cảnh báo không xuất hiện).

- [ ] **Step 3: Viết `database/sql/03-triggers/trg_Devices_Status.sql`**

```sql
CREATE OR ALTER TRIGGER dbo.trg_Devices_Status
ON dbo.Devices
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(Status) RETURN;

    -- ONLINE -> OFFLINE/ERROR: mo DEVICE_OFFLINE neu chua co dang mo.
    INSERT dbo.Alerts (HouseId, ZoneId, DeviceId, AlertType, Severity, Message)
    SELECT z.HouseId, i.ZoneId, i.DeviceId, 'DEVICE_OFFLINE',
           CASE WHEN i.Status = 'ERROR' THEN 'CRITICAL' ELSE 'WARNING' END,
           CONCAT(N'Thiết bị ', i.Code, CASE WHEN i.Status = 'ERROR' THEN N' báo lỗi' ELSE N' mất kết nối' END)
    FROM inserted i
    JOIN deleted d ON d.DeviceId = i.DeviceId
    JOIN dbo.Zones z ON z.ZoneId = i.ZoneId
    WHERE d.Status = 'ONLINE' AND i.Status IN ('OFFLINE', 'ERROR')
      AND NOT EXISTS (SELECT 1 FROM dbo.Alerts a
                      WHERE a.DeviceId = i.DeviceId AND a.AlertType = 'DEVICE_OFFLINE' AND a.Status <> 'RESOLVED');

    -- Ve ONLINE: tu dong DEVICE_OFFLINE dang mo (nguoi thao tac = he thong).
    UPDATE a
    SET Status = 'RESOLVED', ResolvedAt = SYSUTCDATETIME(), ResolvedBy = NULL
    FROM dbo.Alerts a
    JOIN inserted i ON i.DeviceId = a.DeviceId
    JOIN deleted d ON d.DeviceId = i.DeviceId
    WHERE d.Status <> 'ONLINE' AND i.Status = 'ONLINE'
      AND a.AlertType = 'DEVICE_OFFLINE' AND a.Status <> 'RESOLVED';
END
GO
```

- [ ] **Step 4: Thêm phần OFFLINE vào `sp_DetectAnomalies.sql`**

Thay dòng `    -- ===== OFFLINE (muc 11): Task 15 bo sung tai day =====` bằng:

```sql
    -- ===== OFFLINE (muc 11) =====
    -- Canh bao do trg_Devices_Status tao: lay cac AlertId moi hon moc truoc khi danh dau.
    DECLARE @MaxAlertBefore INT = ISNULL((SELECT MAX(AlertId) FROM dbo.Alerts), 0);
    DECLARE @Marked TABLE (DeviceId INT NOT NULL);
    UPDATE dbo.Devices
    SET Status = 'OFFLINE'
    OUTPUT inserted.DeviceId INTO @Marked (DeviceId)
    WHERE IsActive = 1 AND Status = 'ONLINE' AND LastSeenAt < DATEADD(MINUTE, -@OfflineMinutes, @NowUtc);

    INSERT @New (AlertId)
    SELECT a.AlertId
    FROM dbo.Alerts a
    JOIN @Marked m ON m.DeviceId = a.DeviceId
    WHERE a.AlertType = 'DEVICE_OFFLINE' AND a.AlertId > @MaxAlertBefore;
```

- [ ] **Step 5: Sửa `sp_IngestReadings.sql` — báo DEVICE_OFFLINE tự đóng**

Thay khối:

```sql
    -- Tach rieng: chi dong nao dang khac ONLINE moi bi doi Status (trigger khong chay thua).
    UPDATE d SET Status = 'ONLINE'
    FROM dbo.Devices d
    WHERE d.Status <> 'ONLINE' AND d.DeviceId IN (SELECT DeviceId FROM #In WHERE Status = 'ACCEPTED');
```

bằng:

```sql
    -- DEVICE_OFFLINE dang mo cua thiet bi trong lo; khoa de hai lo dong thoi khong cung bao mot canh bao.
    DECLARE @OfflineOpen TABLE (AlertId INT NOT NULL);
    INSERT @OfflineOpen (AlertId)
    SELECT a.AlertId FROM dbo.Alerts a WITH (UPDLOCK, HOLDLOCK)
    WHERE a.AlertType = 'DEVICE_OFFLINE' AND a.Status <> 'RESOLVED'
      AND a.DeviceId IN (SELECT DeviceId FROM #In WHERE Status = 'ACCEPTED');

    -- Tach rieng: chi dong nao dang khac ONLINE moi bi doi Status (trigger khong chay thua).
    UPDATE d SET Status = 'ONLINE'
    FROM dbo.Devices d
    WHERE d.Status <> 'ONLINE' AND d.DeviceId IN (SELECT DeviceId FROM #In WHERE Status = 'ACCEPTED');

    -- Cai nao trg_Devices_Status vua dong -> ResolvedAlertIdsJson (backend phat alert.updated).
    INSERT @Resolved (AlertId)
    SELECT a.AlertId FROM dbo.Alerts a JOIN @OfflineOpen o ON o.AlertId = a.AlertId
    WHERE a.Status = 'RESOLVED';
```

Nếu R1 buộc bỏ trigger (Task 3), SP tự `UPDATE … SET Status = 'RESOLVED'` các dòng `@OfflineOpen` với `OUTPUT inserted.AlertId INTO @Resolved` thay cho câu `INSERT @Resolved` trên.

- [ ] **Step 6: Viết `database/sql/02-functions-procs/sp_RecordHeartbeat.sql`**

```sql
CREATE OR ALTER PROCEDURE dbo.sp_RecordHeartbeat
    @Json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Json IS NULL OR ISJSON(@Json) = 0
       OR LEFT(LTRIM(REPLACE(REPLACE(REPLACE(@Json, NCHAR(13), N''), NCHAR(10), N''), NCHAR(9), N'')), 1) <> N'['
        THROW 50030, N'Chuoi JSON khong hop le (can mot mang).', 1;

    DECLARE @Now DATETIME2(0) = SYSUTCDATETIME();
    CREATE TABLE #In (DeviceCode NVARCHAR(200) NULL, AtText NVARCHAR(100) NULL, At DATETIME2(0) NULL, DeviceId INT NULL);

    INSERT #In (DeviceCode, AtText)
    SELECT x.device, x.at
    FROM OPENJSON(@Json) j
    OUTER APPLY (SELECT * FROM OPENJSON(CASE WHEN j.[type] = 5 THEN j.[value] END)
                 WITH (device NVARCHAR(200) '$.device', at NVARCHAR(100) '$.at')) x;

    UPDATE #In
    SET At = CASE WHEN AtText LIKE N'%Z'
                  THEN CAST(DATEADD(MILLISECOND, -DATEPART(MILLISECOND, TRY_CONVERT(DATETIME2(3), AtText, 127)),
                                    TRY_CONVERT(DATETIME2(3), AtText, 127)) AS DATETIME2(0)) END;
    UPDATE i SET DeviceId = d.DeviceId
    FROM #In i JOIN dbo.Devices d ON d.Code = i.DeviceCode AND d.IsActive = 1
    WHERE i.At IS NOT NULL AND i.At <= DATEADD(MINUTE, 5, @Now);

    EXEC sys.sp_set_session_context @key = N'UserId', @value = NULL;
    EXEC sys.sp_set_session_context @key = N'Note', @value = NULL;

    BEGIN TRAN;
    UPDATE d
    SET LastSeenAt = CASE WHEN d.LastSeenAt IS NULL OR x.MaxAt > d.LastSeenAt THEN x.MaxAt ELSE d.LastSeenAt END
    FROM dbo.Devices d
    JOIN (SELECT DeviceId, MaxAt = MAX(At) FROM #In WHERE DeviceId IS NOT NULL GROUP BY DeviceId) x ON x.DeviceId = d.DeviceId;

    -- Nhu sp_IngestReadings: khoa DEVICE_OFFLINE dang mo, doi Status, lay cai trigger vua dong.
    DECLARE @OfflineOpen TABLE (AlertId INT NOT NULL);
    DECLARE @Resolved TABLE (AlertId INT NOT NULL);
    INSERT @OfflineOpen (AlertId)
    SELECT a.AlertId FROM dbo.Alerts a WITH (UPDLOCK, HOLDLOCK)
    WHERE a.AlertType = 'DEVICE_OFFLINE' AND a.Status <> 'RESOLVED'
      AND a.DeviceId IN (SELECT DeviceId FROM #In WHERE DeviceId IS NOT NULL);

    -- Chi doi Status khi dang khac ONLINE (trigger tu dong DEVICE_OFFLINE).
    UPDATE dbo.Devices SET Status = 'ONLINE'
    WHERE Status <> 'ONLINE' AND DeviceId IN (SELECT DeviceId FROM #In WHERE DeviceId IS NOT NULL);

    INSERT @Resolved (AlertId)
    SELECT a.AlertId FROM dbo.Alerts a JOIN @OfflineOpen o ON o.AlertId = a.AlertId
    WHERE a.Status = 'RESOLVED';
    COMMIT;

    SELECT Accepted = (SELECT COUNT(*) FROM #In WHERE DeviceId IS NOT NULL),
           Rejected = (SELECT COUNT(*) FROM #In WHERE DeviceId IS NULL),
           ResolvedAlertIdsJson = ISNULL((
               SELECT AlertId FROM @Resolved ORDER BY AlertId FOR JSON PATH), N'[]');
END
GO
```

- [ ] **Step 7: Chạy test**

Run: `npm test`
Expected: `sp_RecordHeartbeat: PASS`, `trg_Devices_Status: PASS`, và **mọi file cũ vẫn đạt** (`seed.test.sql` ca demo giảm đàn nay cũng sinh 6 DEVICE_OFFLINE nhưng chỉ kiểm POPULATION_DROP; `sp_json-columns` vẫn tìm được POPULATION_DROP).

- [ ] **Step 8: Commit**

```bash
git add database/sql/03-triggers/trg_Devices_Status.sql database/sql/02-functions-procs/sp_RecordHeartbeat.sql database/sql/02-functions-procs/sp_DetectAnomalies.sql database/sql/02-functions-procs/sp_IngestReadings.sql database/tests/sp_RecordHeartbeat.test.sql database/tests/trg_Devices_Status.test.sql
git commit -m "feat(database): phát hiện thiết bị mất kết nối, heartbeat, trigger trạng thái (mục 11)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 16: NestLogs (Nên có)

**Files:**
- Modify: `database/prisma/schema.prisma` (model `NestLogs`; quan hệ ngược trong `Zones`)
- Create: `database/prisma/migrations/<timestamp>_nest_logs/migration.sql`, `database/tests/nestlogs.test.sql`

**Interfaces:**
- Produces: bảng `NestLogs(ZoneId INT, WeekStart DATE /* thứ Hai, giờ VN */, ActiveNests INT, NewNests INT, Note NVARCHAR(500) NULL)`, PK(ZoneId, WeekStart). Ghi/đọc bằng Prisma (không có trigger, không cần SP).

- [ ] **Step 1: Viết test (phải fail)**

`database/tests/nestlogs.test.sql`:

```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO
PRINT N'nestlogs: hop le ngay thu Hai';
BEGIN TRY
    BEGIN TRAN;
    DECLARE @z INT = (SELECT TOP (1) ZoneId FROM dbo.Zones);
    INSERT dbo.NestLogs (ZoneId, WeekStart, ActiveNests, NewNests, Note) VALUES (@z, '2026-10-05', 120, 4, N'Tuần đầu tháng');
    ROLLBACK;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK;
    THROW;
END CATCH
GO
PRINT N'nestlogs: WeekStart khong phai thu Hai -> 547';
BEGIN TRY BEGIN TRAN;
    DECLARE @z INT = (SELECT TOP (1) ZoneId FROM dbo.Zones);
    INSERT dbo.NestLogs (ZoneId, WeekStart, ActiveNests, NewNests) VALUES (@z, '2026-10-06', 1, 0);
    THROW 59999, N'mong doi 547', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 547 THROW; END CATCH
GO
PRINT N'nestlogs: so am -> 547';
BEGIN TRY BEGIN TRAN;
    DECLARE @z INT = (SELECT TOP (1) ZoneId FROM dbo.Zones);
    INSERT dbo.NestLogs (ZoneId, WeekStart, ActiveNests, NewNests) VALUES (@z, '2026-10-05', -1, 0);
    THROW 59999, N'mong doi 547', 1;
END TRY
BEGIN CATCH IF XACT_STATE() <> 0 ROLLBACK; IF ERROR_NUMBER() <> 547 THROW; END CATCH
GO
PRINT N'nestlogs: PASS';
GO
```

- [ ] **Step 2: Thêm model, migration, CHECK**

Trong `Zones` thêm `NestLogs NestLogs[]`. Thêm model:

```prisma
model NestLogs {
  ZoneId      Int
  WeekStart   DateTime @db.Date
  ActiveNests Int
  NewNests    Int
  Note        String?  @db.NVarChar(500)

  Zone Zones @relation(fields: [ZoneId], references: [ZoneId], onDelete: NoAction, onUpdate: NoAction)

  @@id([ZoneId, WeekStart])
}
```

Tạo migration `nest_logs` theo quy trình đã chốt ở Task 2 và thêm cuối file:

```sql
-- 1900-01-01 la thu Hai; khong dung DATEPART(WEEKDAY) vi phu thuoc SET DATEFIRST.
IF OBJECT_ID(N'dbo.CK_NestLogs_Monday', N'C') IS NULL
    ALTER TABLE dbo.NestLogs ADD CONSTRAINT CK_NestLogs_Monday CHECK (DATEDIFF(DAY, '19000101', WeekStart) % 7 = 0);
IF OBJECT_ID(N'dbo.CK_NestLogs_NonNegative', N'C') IS NULL
    ALTER TABLE dbo.NestLogs ADD CONSTRAINT CK_NestLogs_NonNegative CHECK (ActiveNests >= 0 AND NewNests >= 0);
```

- [ ] **Step 3: Chạy test**

Run: `npm test` → Expected: `nestlogs: PASS`, mọi file khác đạt.

- [ ] **Step 4: Commit**

```bash
git add database/prisma database/tests/nestlogs.test.sql
git commit -m "feat(database): NestLogs nhật ký tổ yến theo tuần (Nên có)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Ngoài phạm vi plan này

- **Nếu còn thời gian (spec):** ghi đè MANUAL tự hết hạn (`sp_SetActuator`) — chưa lập task; làm sau khi Task 1–15 xong và nhóm đồng ý.
- Phân quyền SQL Server, demo transaction hai phiên, sao lưu/phục hồi, `INCLUDE (Value)` và đo execution plan, script sinh vài triệu dòng: plan `database-advanced`.
- Cấu hình adapter, chuyển Decimal → number, đổi mã lỗi → HTTP: plan `backend`.

