# SwiftletCare database-advanced Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Người thực thi:** TV1, theo cách Native (`superpowers:executing-plans`) trên máy mình. Việc H1 (Task 9) có thể giao người hỗ trợ theo `plans/README.md` (**chưa xác nhận**); TV1 duyệt PR của họ. H2 (khung `run-two-sessions.ps1` ở Task 5) do TV1 tự làm.

## Trước khi chạy

- Plan database-core đã xong **Task 6** (mốc 20/10). `npm test` trong `database/` đạt.
- TV1 đã sửa plan database-core và làm xong **D2, D3, D4** (đợt 1) theo `plans/README.md` mục "Việc chéo module". D1 (`_Perf`) phải xong trước Task 5.
- Không sửa plan database-core hay plan backend trong plan này. Việc của module khác chỉ được **kiểm** ở đây.

## Hai đợt

| Đợt | Task | Hạn |
|---|---|---|
| 1: phân quyền | Task 1–3 (giao TV2 ngày 21–22/10), Task 4 (sau D5 của TV2, trước 25/10) | M2 25/10 |
| 2: đồng thời, sao lưu, tối ưu | Task 5–11 (Bắt buộc), Task 12 (Nên có), Task 13 (Nếu còn thời gian), Task 14 nộp | `results/` **04/11** |

Cắt khi trễ (spec 1.1): Task 13 → Task 12 → bước differential trong Task 8. Không cắt Task 1–7.

**Goal:** Thêm phân quyền tối thiểu cho backend và báo cáo, các kịch bản hai phiên (lost update, deadlock, mức cô lập), sao lưu/khôi phục đến thời điểm, bài đo trước/sau `INCLUDE (Value)` trên vài triệu dòng, và (nếu còn thời gian) phân vùng, kèm kết quả trong `database/advanced/results/`.

**Architecture:**
- `sql/04-security/01-roles-users.sql` là file duy nhất của module chạy trên **mọi** CSDL, qua `deploy.ps1` (D2).
- Mọi thứ khác nằm trong `database/advanced/` và chỉ chạy trên CSDL có hậu tố quy định: `_Perf` cho đồng thời, đo, phân vùng; `_Bk_Dev` là nguồn sao lưu; `_Restore` là đích khôi phục. Mỗi script tự chặn hậu tố trước khi đọc `.env`.
- Script PowerShell dùng lại `database/scripts/lib.ps1` (`Read-DotEnv`, `Invoke-Sql`, `Get-SqlScalar`).

**Tech Stack:** SQL Server Express (≥ 2016 SP1, máy nhóm 2025), T-SQL, `sqlcmd` 17 (`-I -f 65001 -b`), PowerShell 5.1, Windows Task Scheduler (`schtasks`).

**Spec:** [docs/superpowers/specs/2026-10-17-swiftletcare-database-advanced-design.md](../specs/2026-10-17-swiftletcare-database-advanced-design.md) · nền: [database-core](../specs/2026-10-12-swiftletcare-database-core-design.md)

## Global Constraints

- Không đổi SP, view, trigger, bảng của database-core. Ngoại lệ duy nhất: `sql/00-schema-extras/90-sensorreadings-include-value.sql`, chỉ khi Task 11 quyết định giữ.
- `sp_SetActuatorNaive`/`sp_SetActuatorSafe` chỉ nằm trong `database/advanced/`, chỉ cài lên `SwiftletCare_Perf`; không bao giờ nằm trong `database/sql/`.
- Hậu tố bắt buộc, kiểm trước khi đọc `.env`, sai thì thoát mã **2**: `_Perf` (đồng thời, đo, phân vùng, sinh dữ liệu), `_Restore` (đích khôi phục; khác tên nguồn). `_Bk_Dev` tạo bằng `deploy.ps1 -Reset` (guard `_Dev` sẵn có).
- Trên `SwiftletCare` chỉ được làm bốn việc:
  - `deploy.ps1` không `-Reset`;
  - áp chỉ mục INCLUDE nếu giữ;
  - chuyển `RECOVERY FULL` khi bật lịch sao lưu;
  - chạy lịch sao lưu.
  Demo phân quyền trên `SwiftletCare` chỉ thử lệnh bị từ chối.
- Login `app_backend`, `app_report`: **không bao giờ `DROP LOGIN` rồi tạo lại**, chỉ `ALTER LOGIN … WITH PASSWORD` (giữ SID, tránh user mồ côi ở `_Test`/`_Restore`); `DEFAULT_DATABASE = master`; `CHECK_POLICY = ON`.
- Mật khẩu chỉ ở `database/.env` (`APP_BACKEND_PASSWORD`, `APP_REPORT_PASSWORD`), truyền qua biến môi trường; không có trong file `.sql`, log, màn hình. Mật khẩu dev ghi trong README database.
- Role `role_backend`, `role_report`; không `db_datareader`/`db_datawriter`; không `DENY`; không `DELETE`, không DDL cho hai login.
- Không bật `READ_COMMITTED_SNAPSHOT` ở đâu. `ALLOW_SNAPSHOT_ISOLATION` chỉ bật trên `_Perf`.
- Đo: số chính là **logical reads**; thời gian đo **nóng**, 5 lần, trung vị; đo lạnh chỉ khi `IS_SRVROLEMEMBER('sysadmin') = 1`, nếu không thì ghi "chỉ có số đo nóng".
- **Cấm** `GREATEST`, `LEAST`, `DATE_BUCKET`, `DATETRUNC`, `GENERATE_SERIES`, `STRING_SPLIT(…, enable_ordinal)`.
- File `.ps1` chỉ chữ ASCII không dấu. File `.sql` lưu UTF-8.
- Không commit `.bak`, `.trn`, `.mdf`, `.ldf`, `.env`, dữ liệu sinh ra. Commit script và `advanced/results/`. Đọc qua `.sqlplan` trước khi commit (tên máy → `<may>`).
- Commit message tiếng Việt, kết thúc bằng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Chạy lại `create-logins.ps1` khi login đã có**: mong SID không đổi, user trong `_Test`/`_Restore` vẫn đăng nhập được. Test ở Task 2 Step 4.
2. **`.bak` của `_Test` được tạo trước khi có login, hoặc từ máy khác**: mong `run-security-test.ps1` báo rõ "user mo coi" thay vì lỗi 229 khó hiểu. Test ở Task 3 Step 2.
3. **`measure.ps1 -Cold` khi backend hoặc demo đang chạy cùng instance**: mong script từ chối làm lạnh (vì `DROPCLEANBUFFERS` tác động cả máy chủ) và chỉ đo nóng. Test ở Task 10 Step 2.
4. **Chạy lại `pitr-demo.ps1` lần hai** (file sao lưu và `_Restore` đã có): mong chạy lại sạch, kết quả kiểm giống lần đầu. Test ở Task 8 Step 4.
5. **Chạy lại `generate-readings.sql`**: mong số dòng không đổi, không lỗi trùng UQ. Test ở Task 9 Step 2.

## Cấu trúc file

```
database/
  sql/04-security/01-roles-users.sql       # Task 3, chạy trên mọi CSDL qua deploy.ps1 (D2)
  sql/00-schema-extras/90-sensorreadings-include-value.sql   # Task 11, chỉ khi giữ
  advanced/
    README.md                               # mỗi task thêm một mục
    lib.ps1                                 # Assert-DbSuffix, Invoke-SqlWin, Invoke-SqlAs
    tests/guards.ps1                        # mọi script từ chối sai hậu tố (mã 2)
    security/create-logins.ps1, create-logins.sql
    security/security.test.sql, login-smoke.sql, run-security-test.ps1
    concurrency/demo-procs.sql, run-two-sessions.ps1
    concurrency/<kịch bản>/setup.sql, session-a.sql, session-b.sql, check.sql   # 8 thư mục
    backup/pitr-demo.ps1, restore-pitr.ps1, backup.ps1, schedule.ps1
    perf/generate-readings.sql, include-value.sql, measure.ps1, queries/Q1.sql..Q4.sql
    partition/partition.sql, switch-out.sql
    results/                                # checks.md, security.md, concurrency.md, backup.md, perf.md, partition.md, ...
```

**Ghi chú so với spec** (không đổi quyết định):
- Spec 1.4 vẽ ba thư mục `lost-update/ deadlock/ isolation/`. Plan dùng **một thư mục mỗi kịch bản** (8 thư mục), vì `run-two-sessions.ps1 -Scenario <tên>` cần một bộ file cho mỗi tên.
- Spec 2.5 chạy test "bằng `sqlcmd -U app_backend`". Plan tách làm hai:
  - Ma trận quyền chạy bằng `swiftlet_dev` với `EXECUTE AS USER = N'app_backend'` / `N'app_report'`. Cách này kiểm đúng quyền của user trong CSDL, và cho phép `REVERT` để đếm `AlertHistory` (bảng mà `app_backend` không được đọc).
  - `login-smoke.sql` chạy thật bằng `sqlcmd -U app_backend` và `-U app_report`, để chứng minh đăng nhập và quyền ở mức login.

## Quy ước script `advanced/`

- Mọi `.ps1` có `-Database` gọi `Assert-DbSuffix $Database '<hậu tố>'` **ở dòng đầu**, trước `Read-DotEnv`.
- Mã thoát: 0 đạt; 1 kiểm thất bại; 2 từ chối hậu tố; 3 thiếu điều kiện (login chưa có, thiếu quyền, thiếu file).
- Test `.sql` theo quy ước của plan database-core: mỗi ca một transaction `ROLLBACK`, sai thì `THROW 59999`.

---

## Đợt 1 — Phân quyền (giao 21–22/10)

### Task 1: Kiểm chứng A1–A9 và dữ kiện nền

**Files:**
- Create: `database/advanced/results/checks.md`

**Interfaces:**
- Produces: bảng `checks.md` có các cột `# | Kiểm gì | Lệnh | Kết quả | Ngày | Ảnh hưởng`. Các task sau đọc kết quả A2 (cách truyền mật khẩu), A3 (có làm lạnh được không), A4 (lệnh xóa bộ nhớ đệm kế hoạch), A5 (tên và dạng UQ), A8 (có làm Phần 6 không).

- [ ] **Step 1: A2: `sqlcmd` đọc biến môi trường làm biến kịch bản**

```powershell
$env:SwxProbe = 'abc'
sqlcmd -S localhost,1433 -E -b -Q 'PRINT N''probe=$(SwxProbe)'''
```
Expected: `probe=abc`. Nếu lỗi "'SwxProbe' scripting variable not defined" thì ghi A2 = không, và Task 2 dùng `-v` (ghi rõ rằng mật khẩu lộ trong danh sách tiến trình).

- [ ] **Step 2: A3: tài khoản Windows của TV1 là sysadmin**

Run: `sqlcmd -S localhost,1433 -E -b -h -1 -Q "SET NOCOUNT ON; SELECT IS_SRVROLEMEMBER('sysadmin')"`
Expected: `1`. Nếu là `0`, nhờ người cài SQL Server cấp quyền, hoặc chạy các script `-E` bằng tài khoản đã cài. Không có sysadmin thì không tạo được login (Task 2) và không đo lạnh được (Task 10).

- [ ] **Step 3: A4, A5, A8 trên `SwiftletCare_Dev`**

```powershell
sqlcmd -S localhost,1433 -E -d SwiftletCare_Dev -b -I -Q "ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE; PRINT 'A4 ok'"
sqlcmd -S localhost,1433 -E -d SwiftletCare_Dev -b -W -Q "SELECT i.name, i.type_desc, i.is_unique, i.is_unique_constraint, i.is_primary_key FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.SensorReadings')"
sqlcmd -S localhost,1433 -E -d SwiftletCare_Dev -b -W -Q "SELECT SERVERPROPERTY('Edition'); CREATE PARTITION FUNCTION pf_probe (DATETIME2(0)) AS RANGE RIGHT FOR VALUES ('2026-01-01'); DROP PARTITION FUNCTION pf_probe; PRINT 'A8 ok'"
```
Expected:
- `A4 ok`.
- Có một dòng UQ trên `(DeviceId, MetricCode, RecordedAt)`: ghi tên thật và `is_unique_constraint` (kỳ vọng 1, tên do Prisma sinh, chưa kiểm chứng).
- `A8 ok`. Nếu `CREATE PARTITION FUNCTION` lỗi thì A8 = không, bỏ Task 13.

- [ ] **Step 4: A1 phần tĩnh: không có SQL động trong `database/sql/`**

Run: `Select-String -Path database/sql -Pattern 'sp_executesql','EXEC\s*\(','EXECUTE\s*\(' -Recurse` (hoặc Grep)
Expected: không có kết quả. Có kết quả thì ghi tên file; Task 3 phải thêm quyền cho đúng câu lệnh đó. Phần động của A1 kiểm ở Task 3.

- [ ] **Step 5: Danh sách quyền theo mã backend thật**

Grep `backend/src` (nếu chưa có thì grep plan backend) với các mẫu `prisma\.(\w+)\.(\w+)`, `FROM dbo\.\w+`, `JOIN dbo\.\w+`, `UPDATE dbo\.\w+`, `INSERT INTO dbo\.\w+`, `DELETE`, `EXEC dbo\.\w+`. Lập bảng bảng/view/SP → thao tác, so với spec 2.3.
Expected: khớp spec 2.3 (6 bảng ghi, đọc thêm `Metrics, Alerts, ControlLogs, BirdCounts, SensorReadings`, 9 SP, 4 view, không `DELETE` ngoài spike S7). Lệch thì ghi vào `checks.md` mục "Quyền lệch spec"; Task 3 dùng bảng đã cập nhật.

- [ ] **Step 6: Dữ kiện tay**

Ghi vào `checks.md`:
- tên tài khoản dịch vụ SQL Server (lấy từ `services.msc`, dòng "SQL Server (SQLEXPRESS)", cột Log On As);
- máy demo có SSMS không; không có thì ghi "dùng extension SQL Server của VS Code";
- A9: ngày TV2 xác nhận nhận D5, và hạn TV2 hứa.
- A6, A7 và phần `SWITCH` của A8 ghi "kiểm ở Task 8 / Task 9 / Task 13".

- [ ] **Step 7: Commit**

```bash
git add database/advanced/results/checks.md
git commit -m "docs(database-advanced): kết quả kiểm chứng A1-A9 và dữ kiện nền

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Thư viện `advanced/`, guard và tạo login

**Files:**
- Create: `database/advanced/lib.ps1`, `database/advanced/tests/guards.ps1`, `database/advanced/security/create-logins.ps1`, `database/advanced/security/create-logins.sql`, `database/advanced/README.md`

**Interfaces:**
- Consumes: `database/scripts/lib.ps1`: `Read-DotEnv` (trả hashtable, đọc thêm được `APP_BACKEND_PASSWORD`, `APP_REPORT_PASSWORD` vì regex nhận mọi khóa), `Invoke-Sql -Cfg -Database (-File|-Query) [-Variables]`, `Get-SqlScalar $cfg $db $query`.
- Produces, `advanced/lib.ps1` (dot-source `..\scripts\lib.ps1`):
  - `Assert-DbSuffix([string]$Database, [string]$Suffix)`: tên không khớp `^[A-Za-z0-9_]+$` thì in lỗi, `exit 3`. Không kết thúc đúng `$Suffix` (không phân biệt hoa thường, khớp ở **cuối** chuỗi) thì in lỗi, `exit 2`.
  - `Invoke-SqlWin -Database <db> (-File|-Query) [-OutFile <path>]`: `sqlcmd -E -b -I -f 65001`, có `-o` khi có `-OutFile`.
  - `Invoke-SqlAs -Login <name> -Password <pw> -Database <db> -Query <q>`: đặt `$env:SQLCMDPASSWORD`, chạy `sqlcmd -U`, **trả mã thoát** (không throw), để test được lệnh bị từ chối.
- Produces: `create-logins.ps1` (không tham số; `exit 3` nếu thiếu biến hoặc mật khẩu chứa `'`).

- [ ] **Step 1: Viết test guard (chưa có script nên phải fail)**

`database/advanced/tests/guards.ps1`: bảng `@( @('<script tương đối>', '<tham số tên CSDL>', <mã mong đợi>), ... )`, chạy từng dòng bằng `powershell -NoProfile -ExecutionPolicy Bypass -File`, so `$LASTEXITCODE`. Script thiếu thì `FAIL: thieu <script>`. Dòng ban đầu dùng một script mẫu `advanced/tests/fixtures/needs-perf.ps1` (gọi `Assert-DbSuffix $Database '_Perf'` rồi `exit 0`):

| Tham số | Mã mong đợi |
|---|---|
| `SwiftletCare_Perf` | 0 |
| `swiftletcare_perf` | 0 |
| `SwiftletCare_Performance` | 2 |
| `SwiftletCare` | 2 |
| `SwiftletCare_Perf_Dev` | 2 |
| `x];DROP DATABASE master;--_Perf` | 3 |

Các task sau **thêm dòng** cho script thật của mình (mỗi script: một tên đúng hậu tố mà không có CSDL thật thì không xét; một tên sai → 2).

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File database/advanced/tests/guards.ps1`
Expected: FAIL, thiếu `lib.ps1`.

- [ ] **Step 2: Viết `advanced/lib.ps1` và fixture, chạy lại guard**

Expected: `guards: PASS`.

- [ ] **Step 3: Viết `create-logins.sql` và `create-logins.ps1`**

`create-logins.sql` (biến `$(AppBackendPassword)`, `$(AppReportPassword)`), cho từng login:

```sql
IF SUSER_ID(N'app_backend') IS NULL
    CREATE LOGIN app_backend WITH PASSWORD = N'$(AppBackendPassword)', DEFAULT_DATABASE = master, CHECK_POLICY = ON, CHECK_EXPIRATION = OFF;
ELSE
    ALTER LOGIN app_backend WITH PASSWORD = N'$(AppBackendPassword)';   -- khong DROP: giu SID (spec 2.2)
```

`create-logins.ps1`:
1. `Read-DotEnv`; thiếu hoặc rỗng `APP_BACKEND_PASSWORD`/`APP_REPORT_PASSWORD` thì `exit 3`.
2. Mật khẩu chứa `'` thì `exit 3` với thông báo "mat khau khong duoc chua dau nhay don". Không in mật khẩu.
3. Đặt `$env:AppBackendPassword`, `$env:AppReportPassword`. Nếu A2 = không thì dùng `-v` thay vì biến môi trường.
4. `Invoke-SqlWin -Database master -File create-logins.sql`.
5. Xóa hai biến môi trường trong `finally`.

- [ ] **Step 4: Chạy hai lần, kiểm SID không đổi** (Review Focus 1)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File database/advanced/security/create-logins.ps1
$sid1 = sqlcmd -S localhost,1433 -E -h -1 -W -Q "SET NOCOUNT ON; SELECT CONVERT(VARCHAR(100), SUSER_SID(N'app_backend'), 1)"
powershell -NoProfile -ExecutionPolicy Bypass -File database/advanced/security/create-logins.ps1
$sid2 = sqlcmd -S localhost,1433 -E -h -1 -W -Q "SET NOCOUNT ON; SELECT CONVERT(VARCHAR(100), SUSER_SID(N'app_backend'), 1)"
if ($sid1 -ne $sid2) { 'FAIL: SID doi' } else { 'SID giu nguyen' }
```
Expected: `SID giu nguyen`. Thử thêm mật khẩu `abc` trong `.env` tạm: script dừng với lỗi chính sách mật khẩu của SQL Server; log và màn hình không có `abc` ngoài dòng lỗi của SQL Server (kiểm bằng mắt). Trả lại mật khẩu thật.

- [ ] **Step 5: README**

`database/advanced/README.md`, mục "Tạo login (một lần mỗi máy)":
- yêu cầu sysadmin;
- hai biến trong `database/.env` phải đạt chính sách mật khẩu Windows (độ dài, độ phức tạp; D3 cũng ghi chú điều này);
- không bao giờ `DROP LOGIN`;
- máy đã khôi phục `.bak` từ máy khác thì xem mục user mồ côi (Task 3).

- [ ] **Step 6: Commit**

```bash
git add database/advanced/lib.ps1 database/advanced/tests database/advanced/security/create-logins.ps1 database/advanced/security/create-logins.sql database/advanced/README.md
git commit -m "feat(database-advanced): tạo login app_backend/app_report qua biến môi trường, chỉ ALTER khi đã có; guard hậu tố CSDL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Role, user, quyền trên từng CSDL và test quyền

**Files:**
- Create: `database/sql/04-security/01-roles-users.sql`, `database/advanced/security/security.test.sql`, `database/advanced/security/login-smoke.sql`, `database/advanced/security/run-security-test.ps1`

**Interfaces:**
- Consumes: D2 (`deploy.ps1` chạy `sql\04-security`); login từ Task 2; `Invoke-SqlAs` (Task 2).
- Produces: `run-security-test.ps1 [-Database SwiftletCare_Test]`. Script `deploy.ps1 -Database SwiftletCare_Test -Reset`, kiểm login, kiểm user mồ côi, chạy `security.test.sql` (bằng `swiftlet_dev`), rồi chạy `login-smoke.sql` bằng hai login. Đạt thì in `security: PASS`.

- [ ] **Step 1: Viết `security.test.sql`**

Mỗi ca theo quy ước test của database-core. Ca chạy dưới user nào thì có `EXECUTE AS USER = N'<user>'` ngay sau `BEGIN TRAN` và `REVERT` trước khi kiểm. Kết quả SP đọc bằng `INSERT @r EXEC` vào biến bảng có đủ 7 cột `Received, Accepted, Duplicates, Rejected, AcceptedJson, NewAlertsJson, ResolvedAlertIdsJson`.

| Ca | User | Hành động | Kiểm |
|---|---|---|---|
| `ca1-ingest-vuot-nguong` | app_backend | Tiền điều kiện (trước `EXECUTE AS`): không có Alerts `AlertType='THRESHOLD' AND MetricCode='TEMP' AND Status<>'RESOLVED'` của khu vực chứa `H1-F1-SENSOR`; có thì `THROW 59998, N'ca1: tien dieu kien'`. `EXEC sp_IngestReadings` với `[{"device":"H1-F1-SENSOR","metric":"TEMP","value":35.0,"at":"<at>"}]`, với `<at>` = `CONCAT(CONVERT(CHAR(19), CAST(SYSUTCDATETIME() AS DATETIME2(0)), 126), 'Z')` | không lỗi; `(SELECT COUNT(*) FROM OPENJSON(NewAlertsJson)) = 1`; sau `REVERT`: `COUNT(*) FROM AlertHistory WHERE AlertId = <AlertId trong NewAlertsJson>` = 1 |
| `ca2-trigger-devices` | app_backend | Chỉ chạy khi `OBJECT_ID('dbo.trg_Devices_Status') IS NOT NULL`, nếu không thì `PRINT N'ca2: bo qua, khong co trg_Devices_Status'`. Trong cùng transaction: `EXEC sp_IngestReadings` TEMP 28.0 `at` hiện tại; tiền điều kiện không có `DEVICE_OFFLINE` đang mở của thiết bị; `UPDATE dbo.Devices SET Status = 'OFFLINE' WHERE Code = 'H1-F1-SENSOR'` | không lỗi; sau `REVERT`: đúng 1 Alerts `DEVICE_OFFLINE` mới của thiết bị đó |
| `ca3-doc-view` | app_backend, app_report | `SELECT TOP 1 * FROM dbo.vw_OpenAlerts` | không lỗi |
| `ca4-doc-bang` | app_backend được; app_report bị từ chối | `SELECT TOP 1 * FROM dbo.Users` | app_report: lỗi **229** |
| `ca5-exec` | app_report | `EXEC dbo.sp_GetReadingHistory …` (tham số hợp lệ) | lỗi **229** |
| `ca6-delete` | cả hai | `DELETE FROM dbo.Alerts WHERE 1 = 0` | lỗi **229** |
| `ca7-drop` | cả hai | `DROP TABLE dbo.SensorReadings` | lỗi **3701** |
| `ca8-create` | cả hai | `CREATE TABLE dbo.x_probe (a INT)` | lỗi **262** |

Số lỗi 229/3701/262 lấy theo tài liệu. Nếu chạy thật ra số khác **và** thông báo vẫn là bị từ chối quyền, thì sửa số trong test, ghi vào `results/security.md`. Không nới điều kiện thành "lỗi bất kỳ".

Trong `CATCH` của mọi ca: `IF USER_NAME() IN (N'app_backend', N'app_report') REVERT;` **trước** `ROLLBACK` và trước khi so số lỗi.

`login-smoke.sql`: `SELECT TOP 1 1 FROM dbo.vw_OpenAlerts;`.

- [ ] **Step 2: Viết `run-security-test.ps1`, gồm kiểm user mồ côi** (Review Focus 2)

`Assert-DbSuffix $Database '_Test'` (thêm dòng guard: `-Database SwiftletCare` → 2). Thứ tự:
1. `deploy.ps1 -Database <db> -Reset`.
2. Kiểm login có, kiểm user mồ côi (dưới đây).
3. `Invoke-Sql` chạy `security.test.sql` bằng `swiftlet_dev`.
4. `Invoke-SqlAs` chạy `login-smoke.sql` bằng `app_backend` rồi `app_report`; mong mã 0.
5. `Invoke-SqlAs -Login app_backend -Query 'DROP TABLE dbo.SensorReadings'`; mong **mã khác 0**.

Kiểm user mồ côi, chạy trên CSDL đích sau khi deploy:
```sql
SELECT dp.name FROM sys.database_principals dp
LEFT JOIN sys.server_principals sp ON sp.sid = dp.sid
WHERE dp.name IN (N'app_backend', N'app_report') AND sp.sid IS NULL;
```
Có dòng thì `exit 3` với thông báo `user mo coi: <ten>. Tao lai CSDL bang deploy.ps1 -Reset hoac chay ALTER USER <ten> WITH LOGIN = <ten>`.
Login chưa có (`SUSER_ID` NULL) thì `exit 3`: `chay security/create-logins.ps1 truoc`.

- [ ] **Step 3: Chạy, xác nhận fail**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File database/advanced/security/run-security-test.ps1`
Expected: FAIL ở `ca1` ("Cannot execute as the database principal…"), vì chưa có `01-roles-users.sql` nên user `app_backend` chưa có trong CSDL.

- [ ] **Step 4: Viết `sql/04-security/01-roles-users.sql`**

Chạy lại an toàn. Thứ tự:
1. Tạo `role_backend`, `role_report` nếu `DATABASE_PRINCIPAL_ID` NULL.
2. Với mỗi login có (`SUSER_ID(...) IS NOT NULL`): tạo user `FOR LOGIN` nếu chưa có; thêm vào role nếu chưa có trong `sys.database_role_members`.
3. Cấp quyền theo danh sách. Đối tượng chưa có (bị cắt) thì bỏ qua:

```sql
DECLARE @g TABLE (Obj SYSNAME, Perm VARCHAR(30), Role SYSNAME);
INSERT @g VALUES
 ('sp_IngestReadings','EXECUTE','role_backend'), ('sp_SetActuator','EXECUTE','role_backend'),
 ('sp_UpdateAlertStatus','EXECUTE','role_backend'), ('sp_GetReadingHistory','EXECUTE','role_backend'),
 ('sp_RecordBirdCount','EXECUTE','role_backend'), ('sp_CreatePredatorAlert','EXECUTE','role_backend'),
 ('sp_DetectAnomalies','EXECUTE','role_backend'), ('sp_RecordHeartbeat','EXECUTE','role_backend'),
 ('sp_Report_EnvStabilityVsYield','EXECUTE','role_backend'),
 ('vw_LatestReadings','SELECT','role_backend'), ('vw_OpenAlerts','SELECT','role_backend'),
 ('vw_DailyEnvStats','SELECT','role_backend'), ('vw_DailyBirdFlow','SELECT','role_backend'),
 ('Users','SELECT, INSERT, UPDATE','role_backend'), ('Houses','SELECT, INSERT, UPDATE','role_backend'),
 ('Zones','SELECT, INSERT, UPDATE','role_backend'), ('Devices','SELECT, INSERT, UPDATE','role_backend'),
 ('Thresholds','SELECT, INSERT, UPDATE','role_backend'), ('Harvests','SELECT, INSERT','role_backend'),
 ('Metrics','SELECT','role_backend'), ('Alerts','SELECT','role_backend'), ('ControlLogs','SELECT','role_backend'),
 ('BirdCounts','SELECT','role_backend'), ('SensorReadings','SELECT','role_backend'),
 ('vw_LatestReadings','SELECT','role_report'), ('vw_OpenAlerts','SELECT','role_report'),
 ('vw_DailyEnvStats','SELECT','role_report'), ('vw_DailyBirdFlow','SELECT','role_report');
-- GRANT cho tung doi tuong co that: duyet @g, OBJECT_ID(N'dbo.' + Obj) IS NOT NULL,
-- EXEC (N'GRANT ' + Perm + N' ON dbo.' + QUOTENAME(Obj) + N' TO ' + QUOTENAME(Role));
```

Nếu Task 1 Step 5 ghi "Quyền lệch spec" thì sửa danh sách theo đó, và ghi lý do vào `results/security.md`. **Không** thêm `DELETE`, DDL hay quyền trên schema.

Dự phòng A1: nếu `ca1`/`ca2` lỗi 229 bên trong trigger, chỉ thêm `('AlertHistory','INSERT','role_backend')` và/hoặc `('Alerts','INSERT','role_backend')`. Ghi lại.

- [ ] **Step 5: Chạy lại test, chạy deploy hai lần**

Run: `run-security-test.ps1`, rồi `deploy.ps1 -Database SwiftletCare_Dev` (không reset) **hai lần**.
Expected: `security: PASS`; hai lần deploy không lỗi (file `04-security` chạy lại an toàn).

- [ ] **Step 6: Áp lên các CSDL khác, ghi kết quả**

- `deploy.ps1 -Database SwiftletCare` (không reset) để `SwiftletCare` có user và role.
- Ghi `results/security.md`:
  - bảng quyền thực tế;
  - đoạn "rộng hơn roadmap" (copy lý do spec 2.3);
  - kết quả 8 ca;
  - A1 (chuỗi sở hữu có phủ trigger không).
- Cập nhật `checks.md` dòng A1.
- README thêm mục "Quyền và test quyền", "User mồ côi", "Demo phân quyền" (spec 2.6: đăng nhập `app_backend` vào `SwiftletCare`, thử `DROP TABLE dbo.SensorReadings`; `app_report` đọc view được, `SELECT dbo.Users` bị từ chối).

- [ ] **Step 7: Commit, báo TV2**

```bash
git add database/sql/04-security database/advanced/security database/advanced/results/security.md database/advanced/results/checks.md database/advanced/README.md
git commit -m "feat(database-advanced): role_backend/role_report quyền tối thiểu theo từng bảng, test quyền và chuỗi sở hữu qua trigger

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Báo TV2 (21–22/10):
- script đã vào `main`;
- mỗi người chạy `create-logins.ps1`, rồi `deploy.ps1` lại `_Dev`;
- **tạo lại `SwiftletCare_Test_seed.bak`** (plan backend Task 22 Step 1) **sau khi** có login, để bản `.bak` chứa user `app_backend`;
- D5 làm trước 25/10.

### Task 4: `test:contract` chạy bằng `app_backend` (sau D5)

**Files:**
- Modify: `database/advanced/results/security.md`, `database/advanced/results/checks.md`

**Interfaces:**
- Consumes: D5 xong (TV2): `backend/.env.test` có `DB_USER=app_backend`, `DB_ADMIN_USER=swiftlet_dev`.

- [ ] **Step 1: Kiểm D5**

Run: `Select-String -Path backend/.env.test.example -Pattern 'DB_ADMIN_USER'` và đọc trình chạy Task 22 trong `backend/`.
Expected: có `DB_ADMIN_USER`; `RESTORE` dùng tài khoản quản trị. Nếu chưa có thì dừng task, ghi A9 = "chưa xong ngày …", báo TV2 (= nhóm trưởng). Theo spec A9, backend tạm chạy `swiftlet_dev`.

- [ ] **Step 2: Chạy `npm run test:contract` (cùng TV2, tắt backend dev và simulator trước)**

Expected: đạt; không có lỗi 229 nào trong log. Có lỗi 229 thì thêm **đúng** quyền thiếu vào `01-roles-users.sql` (đúng bảng, đúng thao tác), chạy lại Task 3 Step 5 và Step 2 này, ghi vào `security.md` mục "Quyền thêm sau test:contract".

- [ ] **Step 3: Commit**

```bash
git add database/advanced/results database/sql/04-security
git commit -m "docs(database-advanced): test:contract chạy bằng app_backend, ghi quyền thêm nếu có

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Đợt 2 — Đồng thời, sao lưu, tối ưu (từ 26/10)

### Task 5: `_Perf`, bản sao `sp_SetActuator` và khung hai phiên (lost update)

**Files:**
- Create: `database/advanced/concurrency/demo-procs.sql`, `database/advanced/concurrency/run-two-sessions.ps1`, `database/advanced/concurrency/lost-update-naive/{setup,session-a,session-b,check}.sql`, `database/advanced/concurrency/lost-update-safe/{setup,session-a,session-b,check}.sql`
- Modify: `database/advanced/tests/guards.ps1` (thêm `run-two-sessions.ps1`), `database/advanced/README.md`

**Interfaces:**
- Consumes: D1 (`deploy.ps1 -Database SwiftletCare_Perf -Reset`).
- Produces:
  - `run-two-sessions.ps1 -Scenario <tên thư mục> [-Database SwiftletCare_Perf] [-DelayB 1]`. Các bước:
    1. chạy `setup.sql`;
    2. `Start-Process sqlcmd` cho `session-a.sql`, chờ `-DelayB` giây, rồi chạy `session-b.sql`; mỗi phiên `-o results/concurrency/<scenario>-<yyyyMMdd-HHmmss>-a.log` / `-b.log`;
    3. `Wait-Process` cả hai;
    4. chạy `check.sql` vào `-check.log`;
    5. in ba log theo thứ tự.
    Thoát 0 khi `check.sql` đạt **và** điều kiện log của kịch bản đạt (Task 6), ngược lại thoát 1. Mã thoát của hai phiên **không** dùng để xét, vì phiên nạn nhân deadlock thoát khác 0 là đúng.
  - `dbo.DemoLog(Id INT IDENTITY PK, Scenario VARCHAR(40), Sess CHAR(1), Step VARCHAR(40), Val NVARCHAR(100) NULL, At DATETIME2(3) DEFAULT SYSUTCDATETIME())` (trong `demo-procs.sql`, chỉ ở `_Perf`): phiên ghi quan sát, `check.sql` đọc.
  - `dbo.sp_SetActuatorNaive` / `dbo.sp_SetActuatorSafe` `(@DeviceCode VARCHAR(50), @IsOn BIT, @Source VARCHAR(6), @UserId INT = NULL, @DelaySeconds INT = 0)`.

- [ ] **Step 1: Dựng `_Perf` và thêm guard**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File database/scripts/deploy.ps1 -Database SwiftletCare_Perf -Reset`
Expected: `Trien khai xong: SwiftletCare_Perf`. Thêm dòng `run-two-sessions.ps1` với `-Database SwiftletCare_Dev` → 2 vào `guards.ps1`; chạy guard, fail vì chưa có script.

- [ ] **Step 2: Viết `demo-procs.sql`**

- Đầu file: `IF DB_NAME() NOT LIKE N'%[_]Perf' THROW 59997, N'demo-procs chi cai len _Perf', 1;`.
- Hai SP cùng thân, chỉ khác dòng đọc. Mỗi SP:
  1. `BEGIN TRAN`.
  2. Đọc `DeviceId, Mode, IsOn` theo `Code`. Bản Naive đọc không gợi ý khóa; bản Safe đọc `WITH (UPDLOCK, ROWLOCK)`.
  3. `IF @DelaySeconds > 0 WAITFOR DELAY <chuỗi 'hh:mm:ss' dựng từ @DelaySeconds>`.
  4. Nếu `@Source = 'AUTO'` và Mode đã đọc là `'MANUAL'`: bỏ qua.
  5. Nếu không: `UPDATE Devices SET IsOn = @IsOn, Mode = CASE WHEN @Source = 'MANUAL' THEN 'MANUAL' ELSE <Mode đã đọc> END`, rồi `INSERT ControlLogs (DeviceId, IsOn, Level, Mode, Source, UserId, Reason)` (Level giữ nguyên, Reason `N'demo'`).
  6. `COMMIT`.
  7. `INSERT DemoLog` một dòng `Step = 'xong'`, `Val` là `Mode/IsOn` cuối.
- Bản Naive ghi lại Mode **đã đọc**. Đó chính là lỗi: nó ghi đè MANUAL bằng giá trị cũ.

- [ ] **Step 3: Viết hai kịch bản lost update**

- `setup.sql` (giống nhau):
  - xóa `DemoLog` của kịch bản;
  - đặt `H1-F1-FAN` về `Mode='AUTO', IsOn=0` bằng `UPDATE` trực tiếp (`swiftlet_dev`, chỉ trên `_Perf`).
- `session-a.sql`: `EXEC <Naive|Safe> 'H1-F1-FAN', 1, 'AUTO', NULL, 5`.
- `session-b.sql`: `EXEC <Naive|Safe> 'H1-F1-FAN', 0, 'MANUAL', <UserId của owner1, tra theo Username>, 0`.
- `check.sql`:
  - `lost-update-naive`: mong trạng thái cuối **khác** `MANUAL/0`, tức lệnh tay bị mất. Đúng như mong thì `PRINT N'DAT: lenh tay bi mat (lost update)'`, ngược lại `THROW`.
  - `lost-update-safe`: mong `MANUAL/0`, và `DemoLog` có `At` của B ≥ `At` của A (B đã chờ A).

- [ ] **Step 4: Viết `run-two-sessions.ps1`, chạy hai kịch bản**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File database/advanced/concurrency/run-two-sessions.ps1 -Scenario lost-update-naive
powershell -NoProfile -ExecutionPolicy Bypass -File database/advanced/concurrency/run-two-sessions.ps1 -Scenario lost-update-safe
```
Expected: cả hai thoát 0; log check in `DAT`. Thời gian mỗi lần khoảng 6–7 giây. Guard: `guards: PASS`.

- [ ] **Step 5: README mục "Hai phiên"**

Gồm cách chạy script, và cách làm tay bằng hai cửa sổ SSMS hoặc VS Code: dán `setup.sql`, mở `session-a.sql` ở cửa sổ 1 và `session-b.sql` ở cửa sổ 2, bấm chạy cửa sổ 1 rồi trong vòng 5 giây bấm cửa sổ 2, cuối cùng chạy `check.sql`.

- [ ] **Step 6: Commit**

```bash
git add database/advanced/concurrency database/advanced/tests/guards.ps1 database/advanced/README.md database/advanced/results/concurrency
git commit -m "feat(database-advanced): khung hai phiên sqlcmd có log, kịch bản lost update Naive/Safe trên _Perf

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: Deadlock (ba kịch bản)

**Files:**
- Create: `database/advanced/concurrency/{deadlock,deadlock-fixed,deadlock-retry}/{setup,session-a,session-b,check}.sql`
- Modify: `database/advanced/concurrency/run-two-sessions.ps1` (điều kiện log theo kịch bản)

**Interfaces:**
- Consumes: `run-two-sessions.ps1` (Task 5).
- Produces: điều kiện log trong `run-two-sessions.ps1`, khai báo một lần bằng bảng `$LogRules = @{ 'deadlock' = @{ Pattern = 'Msg 1205'; Count = 1 }; 'deadlock-retry' = @{ Pattern = 'ERROR_NUMBER\(\)=1205, thu lai'; Count = 1 }; 'deadlock-fixed' = @{ Pattern = 'Msg 1205|1205'; Count = 0 } }`. `Count` là số log (a, b) khớp mẫu; không khẳng định phiên nào.

- [ ] **Step 1: Viết `deadlock`**

- Dùng `H1-F1-FAN` và ngưỡng `(khu vực của H1-F1, 'TEMP')`.
- `setup.sql`: đặt `Thresholds.TargetValue = 28`, `Devices.Name` của `H1-F1-FAN` về tên gốc.
- A: `BEGIN TRAN; UPDATE Devices SET Name = N'A' …; WAITFOR DELAY '00:00:05'; UPDATE Thresholds SET TargetValue = 28.5 …; COMMIT; INSERT DemoLog (…'commit')`.
- B: ngược thứ tự, `TargetValue = 27.5`, `Name = N'B'`.
- **Không** có `TRY/CATCH`, để `Msg 1205` hiện nguyên văn.
- `check.sql`: đúng 1 dòng `DemoLog` `Step='commit'` cho kịch bản; trạng thái cuối của cả hai bảng thuộc về **cùng một** phiên (A: `Name=N'A'` và `28.5`; hoặc B: `Name=N'B'` và `27.5`).

- [ ] **Step 2: Chạy, xác nhận đạt**

Run: `run-two-sessions.ps1 -Scenario deadlock`
Expected: thoát 0; đúng một trong `-a.log`/`-b.log` có `Msg 1205`. Chạy 3 lần; lần nào cũng đạt, dù nạn nhân có thể đổi phiên.

- [ ] **Step 3: `deadlock-fixed`, `deadlock-retry`**

- `deadlock-fixed`: B cập nhật **Devices trước rồi Thresholds**, giống A. `check.sql` mong 2 dòng `commit`, trạng thái cuối là của phiên xong sau (B, vì B chờ A).
- `deadlock-retry`: như `deadlock`, nhưng mỗi phiên bọc trong vòng lặp tối đa 2 lần:
  - lần đầu gặp 1205 thì `PRINT CONCAT(N'ERROR_NUMBER()=', ERROR_NUMBER(), N', thu lai')` và chạy lại;
  - lỗi khác thì `THROW`.
  `check.sql` mong 2 dòng `commit`.

Run: `run-two-sessions.ps1 -Scenario deadlock-fixed` rồi `-Scenario deadlock-retry`
Expected: cả hai thoát 0.

- [ ] **Step 4: Commit**

```bash
git add database/advanced/concurrency database/advanced/results/concurrency
git commit -m "feat(database-advanced): deadlock hai phiên (1205 một nạn nhân), sửa bằng thứ tự cố định và thử lại một lần

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Mức cô lập và `concurrency.md`

**Files:**
- Create: `database/advanced/concurrency/{isolation-rc,isolation-rr,isolation-snapshot}/{setup,session-a,session-b,check}.sql`, `database/advanced/results/concurrency.md`

**Interfaces:**
- Consumes: `run-two-sessions.ps1`, `DemoLog`.

- [ ] **Step 1: Viết ba kịch bản**

- `setup.sql`:
  - đặt `TargetValue = 28` cho ngưỡng TEMP của khu vực H1-F1;
  - `isolation-snapshot` chạy thêm `ALTER DATABASE CURRENT SET ALLOW_SNAPSHOT_ISOLATION ON` (sau khi kiểm `DB_NAME()` kết thúc `_Perf`).
- A:
  1. `SET TRANSACTION ISOLATION LEVEL <READ COMMITTED|REPEATABLE READ|SNAPSHOT>; BEGIN TRAN;`
  2. đọc `TargetValue` vào `@v1`; `WAITFOR DELAY '00:00:05'`; đọc vào `@v2`.
  3. Riêng snapshot: thử `UPDATE` dòng đó, bắt lỗi, ghi `ERROR_NUMBER()` vào `DemoLog Step='update'`.
  4. `COMMIT` (hoặc `ROLLBACK` nếu lỗi).
  5. `INSERT DemoLog` các bước `v1`, `v2`, `xong`.
- B: `UPDATE … SET TargetValue = 29`; `INSERT DemoLog Step='xong'`.
- `check.sql`:

| Kịch bản | Điều kiện |
|---|---|
| `isolation-rc` | `v1 = 28`, `v2 = 29`; `xong` của B trước `xong` của A |
| `isolation-rr` | `v1 = v2 = 28`; `xong` của B **sau** `xong` của A |
| `isolation-snapshot` | `v1 = v2 = 28`; `xong` của B trước `xong` của A; `update` của A = **3960** |

- [ ] **Step 2: Chạy ba kịch bản**

Expected: cả ba thoát 0.

- [ ] **Step 3: Viết `results/concurrency.md`**

Mỗi kịch bản trong 8 kịch bản gồm:
- mô tả hai phiên;
- đoạn log chính;
- trạng thái cuối;
- giải thích.

Thêm hai đoạn:
- nối với thực tế: `sp_SetActuator` dùng `UPDLOCK`, `sp_IngestReadings` duyệt theo thứ tự cố định, backend thử lại 1205 một lần rồi trả 503 `RETRY_LATER`;
- lý do không bật `READ_COMMITTED_SNAPSHOT`.

- [ ] **Step 4: Commit**

```bash
git add database/advanced/concurrency database/advanced/results
git commit -m "feat(database-advanced): so sánh READ COMMITTED, REPEATABLE READ, SNAPSHOT ở cấp phiên; tổng hợp concurrency.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 8: Sao lưu và khôi phục đến thời điểm

**Files:**
- Create: `database/advanced/backup/pitr-demo.ps1`, `database/advanced/backup/restore-pitr.ps1`, `database/advanced/results/backup.md`
- Modify: `database/advanced/tests/guards.ps1`, `database/advanced/README.md`

**Interfaces:**
- Consumes: `deploy.ps1 -Database SwiftletCare_Bk_Dev -Reset`; D4 (`*.bak`, `*.trn` trong `.gitignore`).
- Produces:
  - `restore-pitr.ps1 -Target <..._Restore> -Full <path> [-Diff <path>] -Log <path> -StopAtLocal <yyyy-MM-ddTHH:mm:ss>`:
    - `Assert-DbSuffix $Target '_Restore'`;
    - đọc `RESTORE FILELISTONLY` để lấy `LogicalName` dòng `Type = 'D'` và `'L'`;
    - `RESTORE … WITH MOVE …, NORECOVERY, REPLACE` → diff `NORECOVERY` → log `STOPAT, RECOVERY`.
  - `pitr-demo.ps1 [-Source SwiftletCare_Bk_Dev] [-Target SwiftletCare_Restore] [-Dir C:\SwiftletBackup]`: chặn `-Source` phải kết thúc `_Bk_Dev`, `-Target` phải kết thúc `_Restore` và khác `-Source`.

- [ ] **Step 1: Chuẩn bị thư mục và quyền**

```powershell
New-Item -ItemType Directory -Force C:\SwiftletBackup
icacls C:\SwiftletBackup /grant "<tai khoan dich vu tu checks.md>:(OI)(CI)M"
powershell -NoProfile -ExecutionPolicy Bypass -File database/scripts/deploy.ps1 -Database SwiftletCare_Bk_Dev -Reset
```
Expected: `icacls` báo `Successfully processed 1 files`; deploy xong. Thêm guard: `pitr-demo.ps1 -Target SwiftletCare` → 2, `-Source SwiftletCare` → 2; `restore-pitr.ps1 -Target SwiftletCare_Dev` → 2.

- [ ] **Step 2: Viết `pitr-demo.ps1` theo đúng thứ tự spec 4.2**

1. `ALTER DATABASE <src> SET RECOVERY FULL`.
2. `BACKUP DATABASE … TO DISK = '<Dir>\Bk_full.bak' WITH INIT, CHECKSUM`.
3. Chèn 10 số đo `H1-F1-SENSOR` TEMP, `RecordedAt` từ `SYSUTCDATETIME()` lùi 20 phút, cách nhau 1 phút (đánh dấu nhóm 1); `BACKUP DATABASE … WITH DIFFERENTIAL, INIT, CHECKSUM` → `Bk_diff.bak`.
4. Chèn 10 số đo nhóm 2 (lùi 10 phút).
5. Lấy `@T = SYSUTCDATETIME()` và `@TLocal` tính **trên máy chủ**: `DATEADD(MINUTE, DATEDIFF(MINUTE, SYSUTCDATETIME(), SYSDATETIME()), @T)`; in cả hai. `Start-Sleep 2`.
6. `DELETE dbo.Thresholds WHERE ZoneId = <khu vực của H1-F1-SENSOR>` (sự cố giả).
7. `BACKUP LOG … TO DISK = '<Dir>\Bk_log1.trn' WITH INIT, CHECKSUM`.
8. `RESTORE VERIFYONLY FROM DISK = …` cho ba file.
9. Gọi `restore-pitr.ps1` với `-StopAtLocal @TLocal`.
10. Kiểm và in `ThresholdsKhuVuc` và `SoDoNhom2` cho `_Restore` và `_Bk_Dev`. Mong `_Restore` có 4 ngưỡng và 10 số đo nhóm 2; `_Bk_Dev` có 0 ngưỡng. Sai thì `exit 1`.

In thời gian từng bước. Sau khi kiểm xong, phục hồi `_Bk_Dev` bằng `deploy.ps1 -Reset` **chỉ khi** chạy với `-ResetSourceAfter` (mặc định không reset, để xem lại được).

- [ ] **Step 3: Chạy lần 1**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File database/advanced/backup/pitr-demo.ps1`
Expected: `PITR: DAT`, `_Restore` có 4 ngưỡng và 10 số đo nhóm 2. Nếu số đếm sai vì giờ (A6) thì sửa cách quy đổi, ghi vào `checks.md`.

- [ ] **Step 4: Chạy lần 2** (Review Focus 4)

Run: `deploy.ps1 -Database SwiftletCare_Bk_Dev -Reset`, rồi `pitr-demo.ps1` lần nữa.
Expected: `PITR: DAT`; `INIT` ghi đè file cũ, `REPLACE` thay `_Restore`.

- [ ] **Step 5: `results/backup.md`, README, commit**

`backup.md` gồm:
- thứ tự lệnh;
- đầu ra `RESTORE FILELISTONLY`;
- `@T` UTC và giờ máy;
- số đếm kiểm;
- thời gian từng bước;
- câu "RECOVERY FULL chỉ có hiệu lực sau bản full đầu tiên";
- ghi chú không dùng `WITH COMPRESSION` (Express).

README thêm mục "Sao lưu/khôi phục" (`icacls`, demo trực tiếp spec 4.4) và nhắc **không commit** `.bak`/`.trn`.

```bash
git add database/advanced/backup database/advanced/results database/advanced/tests/guards.ps1 database/advanced/README.md
git commit -m "feat(database-advanced): full + differential + log, khôi phục đến thời điểm vào _Restore (WITH MOVE, STOPAT)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: Sinh 5 triệu dòng (H1, đề xuất TV4, chưa xác nhận)

**Files:**
- Create: `database/advanced/perf/generate-readings.sql`, `database/advanced/results/perf/size.md`

**Interfaces:**
- Consumes: `_Perf` đã deploy và seed (Task 5 Step 1), ngày neo mặc định `2026-10-12`.
- Produces: `generate-readings.sql`, biến sqlcmd `$(AnchorDateVn)` (mặc định qua `-v AnchorDateVn=2026-10-12`), `$(Days)` = 180, `$(StepSeconds)` = 75.
  - Sinh cho 6 cảm biến × 4 chỉ số, khoảng `[@End − 180 ngày, @End)` với `@End = DATEADD(DAY, -8, CAST('$(AnchorDateVn)' AS DATETIME2(0)))` (00:00 UTC). Seed bắt đầu 00:00 giờ VN ngày neo−7, tức 17:00 UTC ngày neo−8, nên hai khoảng không chồng nhau.
  - 180 × 86400 / 75 = 207.360 mốc × 24 chuỗi = **4.976.640 dòng**.

- [ ] **Step 1: Viết script**

1. `IF DB_NAME() NOT LIKE N'%[_]Perf' THROW …`.
2. `ALTER DATABASE CURRENT SET RECOVERY SIMPLE`.
3. Bảng số 0..1151 (1152 mốc mỗi ngày) bằng `CROSS JOIN` của `VALUES`.
4. Vòng lặp từng ngày, mỗi ngày một `INSERT … SELECT` 1152 × 24 dòng, `COMMIT` mỗi ngày. Ngày nào đã có dòng thì bỏ qua (`IF EXISTS (… RecordedAt >= @d AND RecordedAt < DATEADD(DAY,1,@d))`).
5. Giá trị tất định, nằm trong `[ValidMin, ValidMax]` và trong ngưỡng seed. Ví dụ TEMP: `28 + 1.5 * SIN(2π · giây trong ngày / 86400) + (chỉ số mốc % 7) * 0.1 − 0.3`. Mỗi chỉ số dùng tâm theo đích seed (TEMP 28, HUMID 82, CO2 700, LIGHT 3).
6. Không gọi SP, không dùng `RAND()`/`NEWID()`.
7. In số dòng mới và thời gian.

- [ ] **Step 2: Chạy, chạy lại** (Review Focus 5)

Run: `sqlcmd -S localhost,1433 -U swiftlet_dev -d SwiftletCare_Perf -b -I -f 65001 -v AnchorDateVn=2026-10-12 Days=180 StepSeconds=75 -i database/advanced/perf/generate-readings.sql` (mật khẩu qua `SQLCMDPASSWORD`), hai lần.
Expected:
- lần 1: `SELECT COUNT(*) FROM dbo.SensorReadings` = 54.144 + 4.976.640 = **5.030.784**;
- lần 2: không thêm dòng, không lỗi.
Ghi thời gian lô đầu và tổng thời gian vào `checks.md` (A7). Quá lâu (> 30 phút) hoặc gần 10 GB thì giảm `Days`, vẫn giữ ≥ 6 tháng nếu được, và ghi lại.

- [ ] **Step 3: `size.md`**

- số dòng;
- `EXEC sp_spaceused N'dbo.SensorReadings'`;
- kích thước CSDL (`sys.database_files`, `size * 8 / 1024` MB) trước/sau;
- kích thước từng chỉ mục:

```sql
SELECT i.name, SUM(ps.used_page_count) * 8 / 1024.0 AS used_mb, SUM(ps.row_count) AS row_count
FROM sys.dm_db_partition_stats ps JOIN sys.indexes i ON i.object_id = ps.object_id AND i.index_id = ps.index_id
WHERE ps.object_id = OBJECT_ID('dbo.SensorReadings') GROUP BY i.name;
```

- [ ] **Step 4: Commit**

```bash
git add database/advanced/perf/generate-readings.sql database/advanced/results/perf/size.md database/advanced/results/checks.md
git commit -m "feat(database-advanced): sinh ~5 triệu số đo tất định trên _Perf, trước khoảng seed, RECOVERY SIMPLE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Đo trước INCLUDE

**Files:**
- Create: `database/advanced/perf/queries/Q1.sql`..`Q4.sql`, `database/advanced/perf/measure.ps1`, `database/advanced/results/perf/timing.csv`, `database/advanced/results/perf/*-truoc.sqlplan`
- Modify: `database/advanced/tests/guards.ps1`

**Interfaces:**
- Consumes: `_Perf` có 5.030.784 dòng (Task 9); A3, A4 từ `checks.md`.
- Produces: `measure.ps1 -Phase <truoc|sau> [-Database SwiftletCare_Perf] [-Cold] [-Runs 5]`. Mỗi truy vấn chạy bỏ 1 lần rồi đo `-Runs` lần nóng. Thêm dòng vào `timing.csv` (`pha,truy_van,lan,lanh_nong,logical_reads,physical_reads,cpu_ms,elapsed_ms`). Lưu plan thật vào `results/perf/<Q>-<pha>.sqlplan`.

- [ ] **Step 1: Viết 4 truy vấn**

Tham số cố định: thiết bị `H1-F1-SENSOR`, chỉ số `TEMP`, `@to = DATEADD(DAY, -38, '2026-10-12')` (nằm trong khoảng sinh).

| File | Nội dung |
|---|---|
| `Q1.sql` | `SELECT RecordedAt, Value FROM dbo.SensorReadings WHERE DeviceId = @d AND MetricCode = 'TEMP' AND RecordedAt >= DATEADD(HOUR, -24, @to) AND RecordedAt < @to ORDER BY RecordedAt;` |
| `Q2.sql` | như Q1, `DATEADD(DAY, -30, @to)` |
| `Q3.sql` | `SELECT * FROM dbo.vw_LatestReadings;` |
| `Q4.sql` | `BEGIN TRAN; EXEC dbo.sp_IngestReadings @Json = <1000 phần tử: 6 cảm biến × 4 chỉ số × 42 mốc (bỏ 8 phần tử cuối), giá trị trong ngưỡng, at = SYSUTCDATETIME() lùi 0..41 giây, dựng bằng FOR JSON PATH>; ROLLBACK;` |

`@d` tra theo `Code`.

- [ ] **Step 2: Viết `measure.ps1`, gồm chặn `-Cold`** (Review Focus 3)

1. `Assert-DbSuffix $Database '_Perf'`.
2. Nếu có `-Cold`:
   - `IS_SRVROLEMEMBER('sysadmin')` qua `-E` phải là 1;
   - đếm `sys.dm_exec_sessions WHERE is_user_process = 1 AND session_id <> @@SPID AND database_id <> DB_ID('SwiftletCare_Perf')` phải bằng 0.
   Không đạt thì in `Bo do lanh: <ly do>` và chỉ đo nóng (thoát 0).
3. Mỗi lần đo lạnh: `CHECKPOINT; DBCC DROPCLEANBUFFERS; ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE;`. Nếu A4 = không thì dùng `DBCC FREEPROCCACHE`.
4. Mỗi lần chạy:
   - `sqlcmd -y 0` với `SET STATISTICS IO, TIME ON; SET STATISTICS XML ON;` + nội dung file;
   - tách logical/physical reads bằng regex `logical reads (\d+), physical reads (\d+)` (cộng mọi bảng);
   - tách CPU/elapsed của khối `SQL Server Execution Times` **cuối** của câu truy vấn chính;
   - tách plan bằng regex `<ShowPlanXML[\s\S]*?</ShowPlanXML>` (lần đo đầu, lưu file).

Thêm guard `measure.ps1 -Database SwiftletCare_Dev` → 2. Kiểm `-Cold` khi đang mở một phiên `sqlcmd` khác trên `SwiftletCare_Dev`: phải in `Bo do lanh`.

- [ ] **Step 3: Đo pha "trước"**

Run: `measure.ps1 -Phase truoc` (thêm `-Cold` nếu A3 = có)
Expected: `timing.csv` có 4 truy vấn × 5 lần nóng (và lạnh nếu có). `Q1-truoc.sqlplan`, `Q2-truoc.sqlplan` có `Key Lookup` (`Select-String 'Lookup="1"'` hoặc `KeyLookup`).

- [ ] **Step 4: Commit**

```bash
git add database/advanced/perf database/advanced/results/perf database/advanced/tests/guards.ps1
git commit -m "feat(database-advanced): đo Q1-Q4 trước INCLUDE (logical reads, thời gian nóng, plan thật)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: INCLUDE (Value), đo sau và quyết định

**Files:**
- Create: `database/advanced/perf/include-value.sql`, `database/advanced/results/perf.md`
- Create (chỉ khi giữ): `database/sql/00-schema-extras/90-sensorreadings-include-value.sql`

**Interfaces:**
- Consumes: tên UQ và `is_unique_constraint` (A5, `checks.md`); `measure.ps1`.
- Produces: `include-value.sql`, chạy lại an toàn trên bất kỳ CSDL nào. Script tìm chỉ mục unique trên `SensorReadings` có đúng 3 cột khóa `(DeviceId, MetricCode, RecordedAt)`. Nếu `Value` chưa là cột INCLUDE:
  - nếu là constraint thì `ALTER TABLE DROP CONSTRAINT <tên>`;
  - `CREATE UNIQUE NONCLUSTERED INDEX <cùng tên> ON dbo.SensorReadings (DeviceId, MetricCode, RecordedAt) INCLUDE (Value)` (nếu là index thì dùng `WITH (DROP_EXISTING = ON)`).
  Tên đọc động từ `sys.indexes`, không ghi cứng.

- [ ] **Step 1: Viết test**

Thêm cuối `include-value.sql` (hoặc file kiểm riêng `perf/check-include.sql`) đoạn THROW nếu sau khi chạy không có đúng một chỉ mục unique khóa `(DeviceId, MetricCode, RecordedAt)` với `Value` là INCLUDE. Chạy file kiểm trên `_Perf` trước khi áp: fail.

- [ ] **Step 2: Áp lên `_Perf`, chạy hai lần**

Expected: lần 1 tạo lại chỉ mục (in thời gian); lần 2 in `da co INCLUDE, bo qua`; file kiểm đạt. Ghi kích thước chỉ mục sau vào `size.md` (truy vấn ở Task 9 Step 3).

- [ ] **Step 3: Đo pha "sau"**

Run: `measure.ps1 -Phase sau` (cùng cờ như pha trước)
Expected: `Q1-sau.sqlplan`, `Q2-sau.sqlplan` không còn Key Lookup.

- [ ] **Step 4: Viết `perf.md` và quyết định**

- Bảng trung vị trước/sau cho Q1–Q4: logical reads, CPU, elapsed (nóng; lạnh nếu có). Thêm kích thước chỉ mục trước/sau. Ảnh plan Q2 trước/sau (`perf/*.png`).
- Ngưỡng hướng dẫn: Q2 logical reads giảm ≥ 50%, Q4 chậm thêm < 20%. **Quyết định cuối của TV1, kèm lý do** (Q4 dao động).
- Nếu không có số đo lạnh, ghi "chỉ có số đo nóng vì <lý do từ measure.ps1>".

- [ ] **Step 5: Nếu giữ**

1. Chép `include-value.sql` thành `database/sql/00-schema-extras/90-sensorreadings-include-value.sql`.
2. Chạy `npm test` trong `database/` → `Tat ca test dat`.
3. `deploy.ps1 -Database SwiftletCare_Dev` và `-Database SwiftletCare` (không reset).
4. Báo TV2 chạy lại `test:contract` và tạo lại `SwiftletCare_Test_seed.bak`.
5. Ghi vào `database/README.md` dòng: "Từ <ngày>: không dùng `prisma migrate dev` (R2, chỉ mục INCLUDE ở 00-schema-extras); thay đổi schema dùng `prisma migrate diff`".
6. Báo nhóm.

Nếu không giữ: không tạo file trong `sql/`; `perf.md` ghi lý do.

- [ ] **Step 6: Commit**

```bash
git add database/advanced/perf database/advanced/results database/sql/00-schema-extras database/README.md
git commit -m "feat(database-advanced): INCLUDE (Value) trên UQ SensorReadings, đo sau và quyết định giữ/bỏ có lý do

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 12: Lịch sao lưu bằng Task Scheduler (Nên có)

**Files:**
- Create: `database/advanced/backup/backup.ps1`, `database/advanced/backup/schedule.ps1`
- Modify: `database/advanced/README.md`, `database/advanced/results/backup.md`

**Interfaces:**
- Produces:
  - `backup.ps1 -Database <tên> -Type <Full|Log> [-Dir C:\SwiftletBackup]`, chạy bằng `sqlcmd -E` (không mật khẩu SQL):
    - ghi `<Database>_<FULL|LOG>_<yyyyMMdd_HHmmss>.<bak|trn>` với `CHECKSUM`;
    - `RESTORE VERIFYONLY`;
    - nối một dòng vào `<Dir>\backup.log`.
    `-Type Log` khi CSDL chưa `FULL` hoặc chưa có bản full thì `exit 3` với thông báo.
  - `schedule.ps1 -Action <Install|Remove> [-Database SwiftletCare]`:
    - `schtasks /Create /TN SwiftletCare-Full /SC DAILY /ST 02:00 …`;
    - `schtasks /Create /TN SwiftletCare-Log /SC MINUTE /MO 15 …`;
    - `/TR "powershell -NoProfile -ExecutionPolicy Bypass -File <đường dẫn tuyệt đối>\backup.ps1 -Database SwiftletCare -Type Full|Log"`;
    - không `/RU` kèm mật khẩu: tác vụ chạy dưới tài khoản Windows của người cài.

- [ ] **Step 1: Thử `backup.ps1` trên `_Bk_Dev`**

Run: `backup.ps1 -Database SwiftletCare_Bk_Dev -Type Full`, rồi `-Type Log`.
Expected: hai file mới, `VERIFYONLY` đạt, `backup.log` có 2 dòng. Trên CSDL `SIMPLE`, `-Type Log` → mã 3.

- [ ] **Step 2: Cài lịch cho `SwiftletCare`**

1. `ALTER DATABASE SwiftletCare SET RECOVERY FULL` (việc được phép thứ ba trên `SwiftletCare`).
2. `backup.ps1 -Database SwiftletCare -Type Full` một lần.
3. `schedule.ps1 -Action Install`.
4. Chờ 15 phút.

Expected: `schtasks /Query /TN SwiftletCare-Log /V /FO LIST` có `Last Result: 0`; có file `.trn` mới.

- [ ] **Step 3: README, `backup.md`, commit**

README ghi:
- tác vụ dùng `sqlcmd -E`, không lưu mật khẩu SQL;
- **chỉ chạy khi máy bật**, lượt lỡ không tự bù (chưa kiểm chứng tùy chọn chạy bù);
- log phải sao lưu đều, nếu không file log phình;
- lệnh `schedule.ps1 -Action Remove` sau demo.

```bash
git add database/advanced/backup database/advanced/README.md database/advanced/results/backup.md
git commit -m "feat(database-advanced): lịch sao lưu full/log bằng Task Scheduler, xác thực Windows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Phân vùng `SensorReadings` trên `_Perf` (Nếu còn thời gian)

Bỏ cả task nếu A8 = không.

**Files:**
- Create: `database/advanced/partition/partition.sql`, `database/advanced/partition/switch-out.sql`, `database/advanced/results/partition.md`

**Interfaces:**
- Consumes: `_Perf` sau Task 11; `measure.ps1` (đo bằng `-Phase phanvung`).
- Produces: `pf_ReadingsMonth` (`RANGE RIGHT`, `DATETIME2(0)`, ranh giới ngày 1 mỗi tháng phủ `[@End − 180 ngày, ngày neo + 1 tháng]`), `ps_ReadingsMonth` (`ALL TO ([PRIMARY])`), bảng `dbo.SensorReadings_Archive`.

- [ ] **Step 1: `partition.sql`**

1. Kiểm `_Perf`.
2. Tạo function và scheme.
3. Đổi PK `ReadingId` thành `(ReadingId, RecordedAt)` nonclustered trên scheme (spec 6.2: chỉ mục unique thẳng hàng phải chứa cột phân vùng).
4. `CREATE CLUSTERED INDEX <tên thật> ON dbo.SensorReadings (RecordedAt) WITH (DROP_EXISTING = ON) ON ps_ReadingsMonth(RecordedAt)`.
5. Dựng lại UQ INCLUDE trên scheme.
6. In thời gian và dung lượng log (`sys.dm_db_log_space_usage`) sau mỗi bước.

Kiểm: `SELECT COUNT(*) FROM sys.partitions WHERE object_id = OBJECT_ID('dbo.SensorReadings') AND index_id = 1` ≥ 7; mọi chỉ mục của bảng có `data_space_id` là scheme.

- [ ] **Step 2: `switch-out.sql`**

1. Dựng `SensorReadings_Archive` từ DDL thật: đọc `sys.columns`/`sys.types`/`sys.identity_columns` của `SensorReadings`, ghép `CREATE TABLE` cùng kiểu, NULL, thứ tự, cùng các chỉ mục, cùng filegroup, rỗng, không khóa ngoại. Thử trước **có** `IDENTITY` cho `ReadingId`.
2. `ALTER TABLE dbo.SensorReadings SWITCH PARTITION <tháng cũ nhất> TO dbo.SensorReadings_Archive`.
3. In số dòng tháng đó trước/sau và thời gian.

Nếu `SWITCH` lỗi: đọc thông báo, sửa bảng lưu trữ (ví dụ bỏ `IDENTITY`), chạy lại, ghi từng lỗi và cách sửa vào `partition.md` và `checks.md` (A8).

- [ ] **Step 3: Đo**

`measure.ps1 -Phase phanvung` cho Q1, Q2 và thêm `Q5.sql` (tổng hợp `AVG(Value)` theo thiết bị trong một tháng). Xem `Actual Partition Count` trong plan. `partition.md` ghi so sánh với pha "sau" và kỳ vọng thấp: chỉ giúp khi lọc theo `RecordedAt`.

- [ ] **Step 4: Commit**

```bash
git add database/advanced/partition database/advanced/perf/queries/Q5.sql database/advanced/results
git commit -m "feat(database-advanced): phân vùng SensorReadings theo tháng trên _Perf, SWITCH ra bảng lưu trữ, đo partition elimination

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 14: Nộp `results/` (hạn 04/11) và chuẩn bị thuyết trình

**Files:**
- Modify: `database/advanced/results/*`, `database/advanced/README.md`

- [ ] **Step 1: Quét tên máy và bí mật**

```powershell
Select-String -Path database/advanced/results -Recurse -SimpleMatch -Pattern $env:COMPUTERNAME, $env:USERNAME, 'Password', 'PWD='
```
Expected: không có kết quả. Có thì thay bằng `<may>`/`<nguoi dung>` trong `.sqlplan`/`.log`, rồi quét lại.

- [ ] **Step 2: Kiểm không có file cấm**

Run: `git status --short database/` và `git ls-files database | Select-String '\.(bak|trn|mdf|ldf)$|\.env$'`
Expected: lệnh thứ hai không in gì.

- [ ] **Step 3: Chạy lại toàn bộ trên máy demo (trước 01/11)**

`run-security-test.ps1`, 8 kịch bản `run-two-sessions.ps1`, `pitr-demo.ps1` đều thoát 0. `_Perf` đã có dữ liệu, `demo-procs.sql` đã cài.

README thêm mục "Thuyết trình":
- **chạy trực tiếp:** phân quyền (`DROP` bị từ chối), lost update và deadlock bằng script, khôi phục đến thời điểm trên `_Bk_Dev`;
- **chiếu kết quả đã đo:** INCLUDE trước/sau, phân vùng.

- [ ] **Step 4: Commit, báo TV5**

```bash
git add database/advanced
git commit -m "docs(database-advanced): hoàn tất results/ để đưa vào báo cáo, hướng dẫn thuyết trình

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Báo TV5: `results/` đã đủ (security, concurrency, backup, perf, partition nếu có).
