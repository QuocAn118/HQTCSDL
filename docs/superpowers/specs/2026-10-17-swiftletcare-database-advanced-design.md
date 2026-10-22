# SwiftletCare — database-advanced: phân quyền, đồng thời, sao lưu, tối ưu

Chủ module: **TV1**. Roadmap mục `database-advanced`. Spec này phải được TV1 xác nhận **trước 22/10**. **Hạn nộp `results/`: 04/11**, để TV5 kịp đưa vào báo cáo.

Lịch làm có hai đợt:
- **Đợt 1: Phần 2 (phân quyền) làm sớm.** TV1 giao script sau database-core Task 6 (khoảng **21–22/10**), để TV2 chuyển backend sang `app_backend` ngay trong M2 và bắt sớm lỗi thiếu quyền.
- **Đợt 2: Phần 3–6 (đồng thời, sao lưu, tối ưu, phân vùng) làm từ 26/10** (tuần 3).

Ký hiệu: **(chưa kiểm chứng)** là điều chưa thử trên máy nhóm; plan phải có bước kiểm. **(quyết định của agent)** là chỗ chồng chưa chốt, agent chọn mặc định; chồng sửa được khi duyệt.

## Phần 1 — Phạm vi, nguyên tắc, cấu trúc

### 1.1 Phạm vi và thứ tự ưu tiên

| Mức | Việc |
|---|---|
| Bắt buộc 1 | Phân quyền: login/user/role theo quyền tối thiểu (Phần 2) |
| Bắt buộc 2 | Đồng thời: lost update, deadlock, so sánh mức cô lập bằng hai phiên (Phần 3) |
| Bắt buộc 3 | Sao lưu/phục hồi: full + differential + log, khôi phục đến thời điểm (Phần 4) |
| Bắt buộc 4 | Tối ưu: script sinh vài triệu dòng; execution plan, STATISTICS IO/TIME trước/sau `INCLUDE (Value)` (Phần 5) |
| Nên có | Lịch sao lưu bằng `sqlcmd` + Windows Task Scheduler (Express không có SQL Agent). Làm sau cùng (4.6) |
| Nếu còn thời gian | Phân vùng `SensorReadings` theo tháng, chỉ trên `_Perf` (Phần 6) |

Thứ tự cắt khi trễ: phân vùng → lịch Task Scheduler → bỏ bước differential (vẫn giữ full + log + khôi phục đến thời điểm). Bắt buộc 1–2 không cắt.

### 1.2 Nguyên tắc

- **Không đụng nghiệp vụ.** Mọi SP, view, trigger, bảng của `database-core` giữ nguyên. Ngoại lệ duy nhất là chỉ mục `INCLUDE (Value)`, và chỉ khi số đo cho thấy cải thiện rõ (5.5).
- **Không làm thí nghiệm trên `_Dev`, `_Test` hay `SwiftletCare`.** Thí nghiệm (đồng thời, đo, phân vùng, sự cố giả để khôi phục) chạy trên ba CSDL riêng (1.3). Trên `SwiftletCare` chỉ được làm bốn việc:
  - `deploy.ps1` (không `-Reset`) áp file `04-security`;
  - nếu giữ, áp chỉ mục INCLUDE (5.5);
  - chuyển sang `RECOVERY FULL` khi bật lịch sao lưu (Nên có, 4.6);
  - chạy lịch sao lưu đó.

  Phần thuyết trình phân quyền trên `SwiftletCare` chỉ thử các lệnh bị từ chối.
- **Không có bí mật trong git.** Mật khẩu login đi qua biến môi trường hoặc biến `sqlcmd`, không bao giờ ghi vào file `.sql`. Mật khẩu dev ghi trong README database. Không commit `.bak`, `.trn`, dữ liệu sinh ra hay `.env`.
- **Hàm T-SQL bị cấm** như database-core (`GREATEST`, `LEAST`, `DATE_BUCKET`, `DATETRUNC`, `GENERATE_SERIES`, `STRING_SPLIT(…, enable_ordinal)`). File `.ps1` chỉ dùng ký tự ASCII; `sqlcmd` chạy với `-I -f 65001 -b`.

### 1.3 Các CSDL

| CSDL | Dùng cho | Tạo bằng |
|---|---|---|
| `SwiftletCare_Perf` | Đo hiệu năng (vài triệu dòng), đồng thời, phân vùng | `deploy.ps1 -Database SwiftletCare_Perf -Reset`, rồi script sinh dữ liệu |
| `SwiftletCare_Bk_Dev` | Nguồn cho bài sao lưu: CSDL nhỏ, có dữ liệu mẫu | `deploy.ps1 -Database SwiftletCare_Bk_Dev -Reset` (quyết định của agent: dùng hậu tố `_Dev` để tạo lại được mà không cần đổi guard) |
| `SwiftletCare_Restore` | Đích khôi phục; không bao giờ ghi đè CSDL nguồn | `RESTORE … WITH MOVE`; script chỉ nhận tên đích kết thúc `_Restore` |

### 1.4 Cấu trúc thư mục

```
database/
  sql/
    00-schema-extras/
      90-sensorreadings-include-value.sql   # chỉ thêm khi 5.5 kết luận giữ (TV1)
    04-security/
      01-roles-users.sql                    # role, user, GRANT; chạy trên mọi CSDL qua deploy.ps1
  advanced/
    README.md                               # cách chạy từng phần, demo tay bằng hai cửa sổ
    security/
      create-logins.ps1                     # tạo/đổi mật khẩu 2 login, chạy 1 lần mỗi máy
      security.test.sql                     # chạy dưới app_backend và app_report
      run-security-test.ps1
    concurrency/
      demo-procs.sql                        # sp_SetActuatorNaive, sp_SetActuatorSafe (chỉ cài lên _Perf)
      lost-update/  deadlock/  isolation/   # session-a.sql, session-b.sql, check.sql
      run-two-sessions.ps1
    backup/
      backup.ps1  restore-pitr.ps1  pitr-demo.ps1
    perf/
      generate-readings.sql  measure.ps1  queries/*.sql
    partition/                              # Nếu còn thời gian
      partition.sql  switch-out.sql  measure.ps1
    results/                                # nộp 04/11 (Phần 7)
```

- **`sp_SetActuatorNaive` và `sp_SetActuatorSafe` không bao giờ nằm trong `database/sql/`.** Nếu nằm đó, `deploy.ps1` sẽ cài chúng lên mọi CSDL, và một lỗi đặt tên có thể ghi đè SP thật.
- Script `advanced/` chỉ đọc `database/.env` để lấy thông tin kết nối, giống `deploy.ps1`. Các script này từ chối chạy nếu tên CSDL không đúng hậu tố quy định: `_Perf` cho đồng thời, đo và phân vùng; `_Restore` cho đích khôi phục.

### 1.5 Phụ thuộc vào module khác (chủ module sửa và báo nhóm)

| # | Thay đổi | Ai | Hạn |
|---|---|---|---|
| D1 | `deploy.ps1`: guard `-Reset` nhận thêm hậu tố `_Perf`. **Sửa cả `tests/deploy-guard.ps1`**: chấp nhận `SwiftletCare_Perf`, vẫn từ chối `SwiftletCare_Performance` (hậu tố phải khớp đúng ở cuối tên) và `SwiftletCare` | TV1 sửa plan database-core, báo nhóm | trước 26/10 |
| D2 | `deploy.ps1` chạy thêm thư mục `sql\04-security` sau `03-triggers`, trước seed | TV1, plan database-core | **21–22/10** (cùng Phần 2) |
| D3 | `database/.env.example` thêm `APP_BACKEND_PASSWORD=`, `APP_REPORT_PASSWORD=` (để trống) | TV1 | cùng D2 |
| D4 | `.gitignore` gốc: **chỉ thêm dòng còn thiếu** `*.bak`, `*.trn` | TV1 | cùng D2 |
| D5 | Backend chạy bằng `app_backend`: `backend/.env.example` `DB_USER=app_backend`. Trình chạy `test:contract` (plan backend Task 22) dùng **tài khoản quản trị riêng** (`DB_ADMIN_USER`, `DB_ADMIN_PASSWORD` = `swiftlet_dev`) cho `BACKUP`/`RESTORE`, còn backend dưới test chạy bằng `app_backend` trên `SwiftletCare_Test` | TV2 (= nhóm trưởng) tự sửa plan backend (không đổi hợp đồng; agent không sửa hộ). **Chưa xác nhận** | trong M2, **trước 25/10** |

Hiện plan backend Task 22 dùng cùng `DB_USER` cho `RESTORE` và cho backend. `app_backend` không có quyền `RESTORE`, nên D5 là điều kiện bắt buộc.

**Chuyển máy sang `app_backend`** (quyết định của agent): mọi máy chạy backend đều chuyển, theo đúng chỉ đạo "backend chạy bằng `app_backend`". Mỗi người chạy `create-logins.ps1` một lần (cần sysadmin, A3) rồi `deploy.ps1` lại `_Dev`. Máy nào chưa tạo được login thì tạm để `DB_USER=swiftlet_dev`. Máy TV1, máy demo và các lượt `test:contract` bắt buộc phải dùng `app_backend`.

### 1.6 Ai làm phần nào

| Phần | Người làm | Hạn | Ghi chú |
|---|---|---|---|
| Phần 2 phân quyền (script, test) | TV1 tự làm | giao 21–22/10 | đợt 1 |
| Phần 4 sao lưu/phục hồi | TV1 tự làm | 30/10 | chạy thử trên máy demo trước 01/11 |
| `perf/generate-readings.sql` (5 triệu dòng) | **TV4** (đề xuất, sau khi web đạt M2), **chưa xác nhận** | 29/10 | Không giao TV5: TV5 đã có simulator, gán nhãn, máy demo, báo cáo. TV1 duyệt PR |
| `concurrency/run-two-sessions.ps1` (khung chạy hai phiên, gom log) | TV1 tự làm | 29/10 | cùng các file `session-*.sql` |
| Phần 3 kịch bản, Phần 5 đo và kết luận INCLUDE, Phần 6 | TV1 | `results/` 04/11 | |

- Người hỗ trợ chỉ nhận việc thêm khi phần **Bắt buộc của module mình đã đạt M2**. Nếu không ai nhận, TV1 tự làm và cắt theo 1.1.
- Mọi việc giao cho người ngoài TV1 (ở bảng này và D1–D5) đều ghi **"chưa xác nhận"** cho tới khi người nhận xác nhận. Nhóm trưởng sẽ hỏi họ.

## Phần 2 — Phân quyền

### 2.1 Login, user, role

| Login | Dùng cho | Server role |
|---|---|---|
| `swiftlet_dev` (đã có) | Prisma migration, `deploy.ps1`, seed, sao lưu, script `advanced/` | giữ như database-core (`dbcreator`, `db_owner` từng CSDL) |
| `app_backend` | Backend NestJS khi chạy dev, demo, `test:contract` | không có |
| `app_report` | Đọc báo cáo (TV5, công cụ ngoài) | không có |

- **Role:** `role_backend`, `role_report`. Quyền cấp cho role, user là thành viên role. (Quyết định của agent: tên role khác tên user, vì user và role dùng chung không gian tên trong một CSDL.)
- **Không dùng `db_datareader`/`db_datawriter`.** Hai role này quá rộng. Nếu sau này phải `DENY` bớt thì `DENY` thắng `GRANT`, rất khó lần ra quyền thực tế.
- **Không dùng `DENY`.** Quyền tối thiểu là chỉ `GRANT` đúng thứ cần; thứ không cấp thì không có.

### 2.2 Tạo login (một lần mỗi máy)

- `advanced/security/create-logins.ps1` đọc `APP_BACKEND_PASSWORD` và `APP_REPORT_PASSWORD` từ `database/.env`, đặt chúng vào **biến môi trường** của tiến trình rồi gọi `sqlcmd`. Script `.sql` dùng `$(AppBackendPassword)`; `sqlcmd` lấy biến môi trường làm biến kịch bản, nên mật khẩu không hiện trên dòng lệnh (chưa kiểm chứng với `sqlcmd` 17; nếu không được thì truyền `-v` và ghi rõ rằng mật khẩu lộ trong danh sách tiến trình của máy).
- **Không bao giờ `DROP LOGIN` rồi `CREATE LOGIN` lại.** Login đã có thì chỉ `ALTER LOGIN … WITH PASSWORD`. Lý do: `_Test` và `_Restore` được khôi phục từ `.bak`, và user trong đó gắn với login qua SID. Tạo lại login sinh SID mới, khiến user thành mồ côi (orphaned user): đăng nhập được vào máy chủ nhưng không vào được CSDL.
- Login có `DEFAULT_DATABASE = master`, không đặt `SwiftletCare`, vì `CREATE LOGIN` lỗi nếu CSDL đó chưa có trên máy.
- `CHECK_POLICY = ON`: mật khẩu phải đạt chính sách mật khẩu Windows (độ dài, độ phức tạp). `database/.env.example` (dòng chú thích cạnh hai biến) và `advanced/README.md` ghi rõ yêu cầu này. Mật khẩu không đạt thì `create-logins.ps1` dừng và in lỗi của SQL Server, không in mật khẩu.
- Script chạy bằng Windows authentication (`sqlcmd -E`), vì `swiftlet_dev` không có quyền tạo login (chưa kiểm chứng tài khoản Windows của TV1 có là sysadmin của Express không). Script không in mật khẩu ra màn hình hay log.

### 2.3 User và quyền trên từng CSDL

`sql/04-security/01-roles-users.sql` chạy lại an toàn nhiều lần (idempotent):
- tạo hai role nếu chưa có;
- tạo user `app_backend`, `app_report` **chỉ khi login tương ứng đã có** (`SUSER_ID(N'app_backend') IS NOT NULL`), rồi thêm user vào role;
- cấp quyền theo bảng dưới.

Vì `deploy.ps1` chạy file này (D2), mọi CSDL đều có user: `_Dev`, `_Test` (tạo lại mỗi lần test), `SwiftletCare`, `_Perf` và `_Bk_Dev`. `_Restore` nhận user theo bản sao lưu. Máy chưa tạo login thì file chỉ tạo role, không lỗi.

**`role_backend`:**

| Đối tượng | Quyền | Lý do |
|---|---|---|
| Từng SP: `sp_IngestReadings`, `sp_SetActuator`, `sp_UpdateAlertStatus`, `sp_GetReadingHistory`, `sp_RecordBirdCount`, `sp_CreatePredatorAlert`, `sp_DetectAnomalies`, `sp_RecordHeartbeat`, `sp_Report_EnvStabilityVsYield` | `EXECUTE` từng SP, **không** cấp trên schema `dbo` | SP nào không có (bị cắt) thì bỏ qua bằng `IF OBJECT_ID(...) IS NOT NULL` |
| `vw_LatestReadings`, `vw_OpenAlerts`, `vw_DailyEnvStats`, `vw_DailyBirdFlow` | `SELECT` | backend đọc view |
| `Users`, `Houses`, `Zones`, `Devices`, `Thresholds` | `SELECT, INSERT, UPDATE` | CRUD trực tiếp bằng Prisma/`$executeRaw` (plan backend Task 16 và các task khác) |
| `Harvests` | `SELECT, INSERT` (`UPDATE` chỉ khi plan backend có lệnh sửa) | nhập thu hoạch |
| `Metrics`, `Alerts`, `ControlLogs`, `BirdCounts`, `SensorReadings` | `SELECT` | đọc danh sách, lịch sử |

- **Không** có `DELETE` trên bảng nào. **Không** có quyền DDL (`CREATE`, `ALTER`, `DROP`).
- Danh sách trên lấy từ plan backend ngày 17/10. Plan database-advanced phải **grep lại mã backend thật** (`prisma.<model>.`, `$queryRaw`, `$executeRaw`) trước khi chốt, rồi cập nhật bảng.

**Quyền rộng hơn roadmap, phải ghi vào báo cáo:** roadmap ghi "backend chỉ EXECUTE các SP cần thiết". Thực tế backend ghi trực tiếp 6 bảng (CRUD nhà, khu vực, thiết bị, ngưỡng, người dùng, thu hoạch) bằng Prisma và đọc khoảng 10 bảng. Chuyển các thao tác đó thành SP trong tuần 3 sẽ phải viết lại phần lớn CRUD của backend, rủi ro trễ M3. Vì vậy quyền được cấp **theo từng bảng, chỉ các thao tác cần**: không xóa, không DDL, không đọc bảng không dùng. Báo cáo ghi rõ mức đã đạt và hướng làm tiếp: chuyển CRUD sang SP, rồi thu hồi quyền bảng.

**`role_report`:** chỉ `SELECT` trên bốn view kể trên. Không có quyền trên bảng, không có `EXECUTE`.

### 2.4 Trigger và chuỗi sở hữu

- Trigger chạy dưới quyền của người gửi câu lệnh gốc. Nhưng SP, trigger và bảng đều thuộc `dbo`, nên **chuỗi sở hữu** (ownership chaining) bỏ qua kiểm quyền trên các bảng mà SP hoặc trigger chạm tới. Vì vậy `app_backend` **không cần** `INSERT` trên `AlertHistory` (do `trg_Alerts_History` ghi khi SP đổi `Alerts`), và **không cần** quyền trên `Alerts` (do `trg_Devices_Status` ghi khi backend `UPDATE Devices` trực tiếp). Đây là kết luận lý thuyết, **chưa kiểm chứng**: test 2.5 phải chứng minh.
- **Phương án dự phòng:** nếu test cho thấy `app_backend` bị từ chối khi trigger ghi `AlertHistory` hoặc `Alerts`, thì chỉ cấp thêm `INSERT` trên **đúng các bảng đó**, không cấp gì khác. Ghi lại trong `results/security.md`.
- Chuỗi sở hữu **đứt** nếu SP dùng SQL động (`sp_executesql`, `EXEC(@sql)`). Plan kiểm `database/sql/` không có SQL động. Nếu có, cấp thêm quyền cho đúng câu lệnh đó và ghi lại.

### 2.5 Kiểm thử

`advanced/security/security.test.sql` chạy bằng `sqlcmd -U app_backend` rồi `-U app_report` trên `SwiftletCare_Test`, qua `run-security-test.ps1`. Mỗi ca dùng `TRY/CATCH` và so `ERROR_NUMBER()`. Số lỗi dự kiến:
- **229**: bị từ chối quyền trên đối tượng (`SELECT`, `DELETE`, `EXECUTE`);
- **3701**: bị từ chối `DROP` (thông báo "không tồn tại hoặc không có quyền");
- **262**: bị từ chối `CREATE TABLE`.

Đây là số theo tài liệu, plan chốt theo kết quả chạy thật. Ca `UPDATE Devices` chỉ chạy khi `trg_Devices_Status` có (mục 11 của core nằm dưới ranh giới cắt, R1 có thể bỏ trigger này). Nếu không có trigger đó, ca 1 (qua `trg_Alerts_History`) vẫn đủ chứng minh 2.4.

| Ca | `app_backend` | `app_report` |
|---|---|---|
| Ca 1: `EXEC sp_IngestReadings` một số đo **vượt ngưỡng**, trong transaction rồi `ROLLBACK` | được; có thêm 1 dòng `Alerts` THRESHOLD và 1 dòng `AlertHistory` (chứng minh 2.4) | bị từ chối |
| Ca 2: `UPDATE Devices` đổi `Status` sang OFFLINE, trong transaction rồi `ROLLBACK` | được; trigger ghi 1 dòng `Alerts` DEVICE_OFFLINE, không lỗi quyền | bị từ chối |
| `SELECT` từ `vw_OpenAlerts` | được | được |
| `SELECT` từ `dbo.Users` | được | bị từ chối |
| `DELETE FROM dbo.Alerts WHERE 1 = 0` | bị từ chối | bị từ chối |
| `DROP TABLE dbo.SensorReadings` (trong transaction, `ROLLBACK`) | bị từ chối | bị từ chối |
| `CREATE TABLE dbo.x(a INT)` | bị từ chối | bị từ chối |

**Dữ liệu cụ thể của hai ca** (seed của database-core: mọi khu vực có ngưỡng TEMP 26–30):

- **Ca 1:** `{"device":"H1-F1-SENSOR","metric":"TEMP","value":35.0,"at":"<SYSUTCDATETIME() làm tròn giây>Z"}`. Giờ `at` là giờ hiện tại để không bị coi là lô đến muộn.
  - Tiền điều kiện kiểm đầu ca: khu vực `H1-F1` chưa có cảnh báo THRESHOLD TEMP đang mở. Nếu đã có, ca đó báo lỗi tiền điều kiện và dừng, không đếm là đạt.
  - Kiểm: `NewAlertsJson` có đúng 1 phần tử; số dòng `AlertHistory` của `AlertId` đó là 1.
- **Ca 2:** cũng `H1-F1-SENSOR`, trong cùng một transaction.
  - Trước tiên `EXEC sp_IngestReadings` một số đo TEMP 28.0 (trong ngưỡng, `at` hiện tại), để thiết bị chắc chắn đang ONLINE.
  - Kiểm tiền điều kiện: không có cảnh báo DEVICE_OFFLINE đang mở cho thiết bị này.
  - Rồi `UPDATE dbo.Devices SET Status = 'OFFLINE' WHERE Code = 'H1-F1-SENSOR'`. Kiểm có đúng 1 cảnh báo DEVICE_OFFLINE mới.

Ngoài ra **`npm run test:contract` của backend chạy bằng `app_backend` trên `SwiftletCare_Test`** (sau D5), để lộ sớm quyền còn thiếu. Lỗi 229 ở đó nghĩa là bảng 2.3 thiếu một dòng. Khi đó sửa bảng 2.3, không cấp rộng hơn.

### 2.6 Demo trực tiếp

Đăng nhập `app_backend` vào `SwiftletCare` trong SSMS hoặc VS Code, thử `DROP TABLE dbo.SensorReadings`, thấy bị từ chối. Thử `SELECT` view bằng `app_report` thành công, `SELECT dbo.Users` bị từ chối. Không lệnh nào trong demo thay đổi dữ liệu.

## Phần 3 — Transaction và đồng thời

### 3.1 Cách chạy hai phiên

- **Chính:** `advanced/concurrency/run-two-sessions.ps1 -Scenario <lost-update-naive|lost-update-safe|deadlock|deadlock-fixed|deadlock-retry|isolation-rc|isolation-rr|isolation-snapshot> -Database SwiftletCare_Perf`.
  - Script mở hai tiến trình `sqlcmd` (`Start-Process`), mỗi tiến trình chạy `session-a.sql` hoặc `session-b.sql` và ghi đầu ra vào file log riêng (`-o`). Phiên B khởi động sau phiên A khoảng 1 giây.
  - Script **chờ cả hai tiến trình kết thúc**, rồi chạy `check.sql` (trạng thái cuối) và in ba phần theo thứ tự: log A, log B, kết quả kiểm.
  - Log nằm ở `advanced/results/concurrency/<scenario>-<yyyyMMdd-HHmmss>-{a,b,check}.log`.
- **Làm tay:** `advanced/README.md` hướng dẫn mở hai cửa sổ truy vấn (SSMS, hoặc extension SQL Server của VS Code nếu máy không có SSMS) và dán từng khối theo thứ tự đánh số. **Cần hỏi TV1: máy demo có SSMS không** (chưa kiểm chứng).
- Chỉ chạy trên `_Perf`. Script từ chối tên CSDL khác.

### 3.2 Lost update

- **Bối cảnh thật:** `sp_SetActuator` bỏ qua lệnh AUTO khi thiết bị đang MANUAL. Nếu không khóa dòng, có thể xảy ra chuỗi sau: bộ điều khiển (AUTO) đọc thấy Mode = AUTO; người dùng bấm tắt tay (MANUAL, `IsOn = 0`); bộ điều khiển ghi `IsOn = 1` theo dữ liệu đã đọc. Lệnh tay của người dùng bị mất.
- `concurrency/demo-procs.sql` (chỉ cài lên `_Perf`) tạo hai bản sao rút gọn của logic `sp_SetActuator`:
  - `sp_SetActuatorNaive`: đọc `Devices` **không** khóa, `WAITFOR DELAY` theo tham số `@DelaySeconds`, rồi ghi.
  - `sp_SetActuatorSafe`: giống hệt, nhưng đọc `WITH (UPDLOCK)` như SP thật.
  - Cả hai bản bọc đọc → `WAITFOR` → ghi trong **một `BEGIN TRAN … COMMIT` tường minh**. Thiếu transaction này thì `UPDLOCK` nhả ngay sau câu đọc, và bản Safe cũng mất cập nhật. Plan đối chiếu với SP thật để chắc SP thật cũng giữ khóa trong transaction.
  - Quyết định của agent: dùng hai bản sao thay vì sửa SP thật, vì không chèn được `WAITFOR` vào SP thật.
- **Kịch bản:** phiên A gọi bản sao với `Source = AUTO`, `IsOn = 1`, `@DelaySeconds = 5`. Phiên B gọi với `Source = MANUAL`, `IsOn = 0`.
  - `Naive`: trạng thái cuối là `IsOn = 1`, lệnh tay bị mất.
  - `Safe`: B chờ A xong, trạng thái cuối là MANUAL, `IsOn = 0`.
  - `check.sql` in trạng thái cuối và số dòng ControlLogs mới.

### 3.3 Deadlock

- **`deadlock`:** phiên A `BEGIN TRAN`, `UPDATE Devices` (một thiết bị), `WAITFOR DELAY '00:00:05'`, `UPDATE Thresholds` (một ngưỡng), `COMMIT`. Phiên B làm như vậy theo thứ tự ngược lại. Độ trễ 5 giây đủ dài để cả hai phiên kịp giữ khóa đầu tiên.
- SQL Server chọn **một** phiên làm nạn nhân (lỗi 1205), và **không đoán trước được phiên nào**. `check.sql` và script chỉ khẳng định: **đúng một** trong hai log có `Msg 1205`, phiên còn lại `COMMIT` được. Script không khẳng định phiên cụ thể.
- **`deadlock-fixed`:** cả hai phiên cập nhật theo **cùng thứ tự** (Devices rồi Thresholds). Không có 1205; phiên B chờ rồi xong.
- **`deadlock-retry`** (kịch bản riêng): giống `deadlock`, nhưng mỗi phiên bọc transaction trong `TRY/CATCH`; gặp 1205 thì in `ERROR_NUMBER()=1205, thu lai` và thử lại **một lần**, giống backend. Script khẳng định đúng một log có dòng đó, và `check.sql` thấy cả hai thay đổi. Kịch bản `deadlock` không có `TRY/CATCH`, để `Msg 1205` hiện nguyên văn.
- Báo cáo nối với thực tế: `sp_IngestReadings` duyệt các cặp (ZoneId, MetricCode) theo thứ tự cố định; backend thử lại 1205 một lần, rồi trả 503 `RETRY_LATER`.

### 3.4 Mức cô lập

So ở **cấp phiên** bằng `SET TRANSACTION ISOLATION LEVEL`. Phiên A đọc cùng một dòng `Thresholds` hai lần, cách nhau 5 giây. Phiên B sửa dòng đó ở giữa.

| Kịch bản | Kỳ vọng |
|---|---|
| `isolation-rc` (READ COMMITTED) | A đọc hai giá trị khác nhau (non-repeatable read); B không bị chặn |
| `isolation-rr` (REPEATABLE READ) | A đọc hai lần cùng giá trị; B bị chặn đến khi A xong |
| `isolation-snapshot` (SNAPSHOT) | A đọc hai lần cùng giá trị; B **không** bị chặn. Nếu sau đó A cũng sửa dòng đó thì A nhận lỗi xung đột cập nhật 3960 |

- SNAPSHOT cần `ALTER DATABASE SwiftletCare_Perf SET ALLOW_SNAPSHOT_ISOLATION ON`; script bật lệnh này **chỉ trên `_Perf`**.
- **Không bật `READ_COMMITTED_SNAPSHOT`** trên CSDL nào: nó đổi hành vi đọc của mọi SP đang chạy. Báo cáo ghi lý do này.

## Phần 4 — Sao lưu và phục hồi

### 4.1 Thư mục và quyền

- File sao lưu nằm ở `C:\SwiftletBackup\`. Tài khoản dịch vụ SQL Server cần quyền ghi vào thư mục này. TV1 tra tên tài khoản trong `services.msc` hoặc SQL Server Configuration Manager (thường có dạng `NT Service\MSSQL$SQLEXPRESS`, chưa kiểm chứng), rồi cấp quyền bằng `icacls`. README ghi lệnh này.
- `.bak` và `.trn` không bao giờ vào git (D4).
- **Không dùng `WITH COMPRESSION`**: Express không hỗ trợ nén khi sao lưu (chưa kiểm chứng; nếu lệnh chạy được thì vẫn không dùng, để giống máy chấm).

### 4.2 Thứ tự bắt buộc

`RECOVERY FULL` chỉ có hiệu lực sau bản sao lưu **full** đầu tiên. Trước bản full đó, CSDL vẫn chạy như SIMPLE, nên log backup báo lỗi. Thứ tự trong `pitr-demo.ps1` (chạy trên `SwiftletCare_Bk_Dev`):

1. `ALTER DATABASE … SET RECOVERY FULL`.
2. `BACKUP DATABASE … TO DISK = 'C:\SwiftletBackup\Bk_full.bak' WITH INIT, CHECKSUM`.
3. Thay đổi lần 1 (thêm vài số đo), rồi `BACKUP DATABASE … WITH DIFFERENTIAL, CHECKSUM` → `Bk_diff.bak`.
4. Thay đổi lần 2 (thêm số đo). Ghi lại **thời điểm T** (UTC, `SYSUTCDATETIME()`), chờ 2 giây, rồi làm "sự cố": `DELETE` toàn bộ `Thresholds` của một khu vực.
5. `BACKUP LOG … TO DISK = 'C:\SwiftletBackup\Bk_log1.trn' WITH CHECKSUM`.
6. `RESTORE VERIFYONLY` từng file.
7. Khôi phục vào `SwiftletCare_Restore` (4.3) với `STOPAT = T`.
8. Kiểm tra: `_Restore` có đủ ngưỡng của khu vực bị xóa và có số đo của thay đổi lần 2; `_Bk_Dev` vẫn thiếu ngưỡng. Script in hai số đếm này.

`STOPAT` nhận giờ theo **giờ của máy chủ SQL** (giờ địa phương), không theo UTC (chưa kiểm chứng). Script đổi T sang giờ máy trước khi truyền vào, và log in cả hai giờ.

### 4.3 Khôi phục đến thời điểm (`restore-pitr.ps1`)

Tên tệp logic lấy bằng `RESTORE FILELISTONLY FROM DISK = 'C:\SwiftletBackup\Bk_full.bak'`, cột `LogicalName` (một dòng `D` cho dữ liệu, một dòng `L` cho log). Script đọc tự động, không ghi cứng. Lệnh mẫu:

```sql
RESTORE DATABASE SwiftletCare_Restore FROM DISK = N'C:\SwiftletBackup\Bk_full.bak'
  WITH MOVE N'<LogicalName dữ liệu>' TO N'C:\SwiftletBackup\SwiftletCare_Restore.mdf',
       MOVE N'<LogicalName log>'     TO N'C:\SwiftletBackup\SwiftletCare_Restore_log.ldf',
       NORECOVERY, REPLACE;
RESTORE DATABASE SwiftletCare_Restore FROM DISK = N'C:\SwiftletBackup\Bk_diff.bak' WITH NORECOVERY;
RESTORE LOG SwiftletCare_Restore FROM DISK = N'C:\SwiftletBackup\Bk_log1.trn'
  WITH STOPAT = N'2026-10-28T14:05:30', RECOVERY;
```

- `REPLACE` chỉ được dùng vì đích là `_Restore`. Script từ chối mọi tên đích không kết thúc bằng `_Restore`, và từ chối khi đích trùng tên nguồn.
- Đặt `.mdf`/`.ldf` của `_Restore` trong `C:\SwiftletBackup\` là quyết định của agent (thư mục đã có quyền ghi). Đường dẫn khác thì tham số hóa.

### 4.4 Demo trực tiếp

Chạy `pitr-demo.ps1` trên `SwiftletCare_Bk_Dev` (CSDL nhỏ, vài giây mỗi bước; chưa đo), rồi mở `_Restore` cho thấy dữ liệu đã về.

### 4.5 Không làm

Không sao lưu `_Perf` (lớn, không cần). Không khôi phục đè `SwiftletCare`.

### 4.6 Nên có: lịch sao lưu bằng Task Scheduler (làm sau cùng)

- `backup.ps1 -Database SwiftletCare -Type Full|Log` ghi file có dấu thời gian vào `C:\SwiftletBackup\`, chạy `RESTORE VERIFYONLY`, ghi một dòng log.
- Hai tác vụ `schtasks`: full mỗi ngày, log mỗi 15 phút. Đây là quyết định của agent; chu kỳ do TV1 chỉnh.
- Tác vụ dùng **xác thực Windows** (`sqlcmd -E`) dưới tài khoản Windows của người tạo tác vụ, nên **không lưu mật khẩu SQL** ở đâu cả.
- Task Scheduler chỉ chạy **khi máy đang bật**. Lượt bị lỡ lúc máy tắt không tự bù, trừ khi bật tùy chọn chạy bù của tác vụ (chưa kiểm chứng). README ghi rõ hạn chế này; báo cáo cũng ghi rằng máy chủ thật cần chạy liên tục.
- Muốn có log backup thì `SwiftletCare` phải ở `RECOVERY FULL`, và log phải được sao lưu đều, nếu không file log sẽ phình. README ghi rõ lệnh xóa hai tác vụ sau khi demo xong.

## Phần 5 — Tối ưu truy vấn

### 5.1 Dữ liệu

- `perf/generate-readings.sql` chạy trên `SwiftletCare_Perf` sau khi deploy và seed. Script sinh **khoảng 5 triệu dòng** `SensorReadings` (quyết định của agent; TV1 chỉnh) cho các thiết bị cảm biến của dữ liệu mẫu, trải **ít nhất 6 tháng**, để phần phân vùng có nhiều tháng.
- **Trước khi sinh:** `ALTER DATABASE SwiftletCare_Perf SET RECOVERY SIMPLE`, để log tự cắt sau mỗi lô. Script kiểm tên CSDL là `_Perf` trước lệnh này.
- **Khoảng thời gian sinh nằm hoàn toàn trước ngày bắt đầu của seed.** Seed phủ 8 ngày trước ngày neo, nên dữ liệu sinh kết thúc trước (ngày neo − 8 ngày) và không bao giờ trùng `UQ(DeviceId, MetricCode, RecordedAt)` với seed.
- **Tất định:** giá trị tính bằng công thức từ chỉ số dòng, không dùng `RAND()` hay `NEWID()`. Bảng số sinh bằng `CROSS JOIN`. Script chèn theo lô (VD mỗi lô một ngày) để log không phình. Chạy lại không tạo dòng trùng: script bỏ qua nếu khoảng ngày đã có dữ liệu.
- **Không** gọi `sp_IngestReadings` khi sinh dữ liệu, vì sẽ mở cảnh báo hàng loạt; chèn thẳng bằng `swiftlet_dev`.
- Ghi vào `results/perf/size.md`: số dòng, kết quả `sp_spaceused 'dbo.SensorReadings'` và kích thước CSDL trước/sau. **Express giới hạn 10 GB dữ liệu mỗi CSDL**; 5 triệu dòng ước dưới 1 GB (chưa đo).

### 5.2 Truy vấn đo

| # | Truy vấn | Vì sao |
|---|---|---|
| Q1 | Lịch sử một thiết bị/chỉ số trong 24 giờ: `WHERE DeviceId = @d AND MetricCode = @m AND RecordedAt >= @from AND RecordedAt < @to`, lấy `RecordedAt, Value` | Giống `sp_GetReadingHistory`; dùng `UQ(DeviceId, MetricCode, RecordedAt)` rồi Key Lookup lấy `Value` |
| Q2 | Như Q1 nhưng 30 ngày | Số dòng lookup lớn, chênh lệch rõ hơn |
| Q3 | Giá trị mới nhất mỗi thiết bị/chỉ số (logic của `vw_LatestReadings`) | Truy vấn dashboard |
| Q4 | Chèn một lô 1000 số đo qua `sp_IngestReadings`, giá trị trong ngưỡng, trong `BEGIN TRAN … ROLLBACK` | Đo **chi phí ghi** của INCLUDE; quyết định của agent, thêm để cân bằng. Mỗi lần đo phải `ROLLBACK`, để 10 lần đo chạy trên cùng một trạng thái bảng (không dòng trùng, không mở cảnh báo) |

Tham số cố định ghi trong `queries/*.sql`.

### 5.3 Cách đo (`perf/measure.ps1`)

- **Số đo chính là logical reads** (`STATISTICS IO`). Số này không phụ thuộc bộ nhớ đệm, nên không cần quyền đặc biệt.
- **Thời gian đo ở trạng thái nóng**: chạy bỏ một lần, rồi đo **5 lần** và lấy **trung vị** (`STATISTICS TIME`: CPU ms, elapsed ms).
- **Đo lạnh chỉ làm khi có quyền.** `DBCC DROPCLEANBUFFERS` có thể cần sysadmin, mà `swiftlet_dev` chỉ có `dbcreator` (chưa kiểm chứng). `measure.ps1 -Cold` chạy bằng `sqlcmd -E` và kiểm `IS_SRVROLEMEMBER('sysadmin')` trước. Không có quyền thì bỏ phần lạnh, in một dòng thông báo, và **báo cáo nêu rõ** là chỉ có số đo nóng.
  - Khi có quyền, trước mỗi lần đo lạnh chạy `CHECKPOINT; DBCC DROPCLEANBUFFERS;` và xóa bộ nhớ đệm kế hoạch.
  - Để xóa bộ nhớ đệm kế hoạch, dùng `ALTER DATABASE SCOPED CONFIGURATION CLEAR PROCEDURE_CACHE` (chỉ xóa của `_Perf`) thay cho `DBCC FREEPROCCACHE` (xóa của **cả máy chủ**). Đây là quyết định của agent. Nếu máy không có lệnh này thì dùng `DBCC FREEPROCCACHE` và ghi lại.
  - `DBCC DROPCLEANBUFFERS` luôn tác động **cả máy chủ**, nên chỉ chạy khi trên cùng instance không có demo, test hay backend nào đang chạy.
- Script chỉ chạy khi tên CSDL là `SwiftletCare_Perf`.
- Kết quả ghi vào `results/perf/timing.csv`, các cột `pha, truy_van, lan, lanh_nong, logical_reads, physical_reads, cpu_ms, elapsed_ms`.
- Lưu **execution plan thật** bằng `SET STATISTICS XML ON`, mỗi truy vấn một file `results/perf/<Q>-<truoc|sau>.sqlplan`. Chụp ảnh plan trong SSMS hoặc VS Code để đưa vào báo cáo.
- **So bằng số đo IO và thời gian, không chỉ nhìn plan.** Plan mất Key Lookup chưa đủ để kết luận; phải có logical reads giảm, và thời gian nóng không tăng.

### 5.4 Bài trước/sau

1. **Trước:** đo Q1–Q4 với chỉ mục của core. Plan Q1/Q2 kỳ vọng có `Index Seek` + `Key Lookup`.
2. **Thêm INCLUDE trên `_Perf`:** tạo lại chỉ mục unique cùng khóa `(DeviceId, MetricCode, RecordedAt)` kèm `INCLUDE (Value)`.
   - `UNIQUE CONSTRAINT` không có `INCLUDE`, nên nếu Prisma tạo UQ dưới dạng constraint thì phải `DROP CONSTRAINT` rồi `CREATE UNIQUE INDEX` **cùng tên**. Dạng thật của UQ (constraint hay index) và tên của nó kiểm bằng `sys.indexes.is_unique_constraint` (chưa kiểm chứng).
3. **Sau:** đo lại Q1–Q4. Kỳ vọng: Key Lookup biến mất, logical reads của Q1/Q2 giảm mạnh, Q4 chậm hơn một chút.

### 5.5 Quyết định giữ hay bỏ

- **Ngưỡng hướng dẫn:** logical reads của Q2 giảm ≥ 50% và Q4 chậm thêm < 20%. Đây chỉ là hướng dẫn. Thời gian của Q4 dao động, nên **quyết định cuối là của TV1, kèm lý do** ghi trong `perf.md`.
- **Đo thêm kích thước chỉ mục** trước và sau INCLUDE: `used_page_count`, `row_count` của từng chỉ mục trên `SensorReadings`, lấy từ `sys.dm_db_partition_stats` join `sys.indexes`. Ghi vào `results/perf/size.md`.
- **Cải thiện rõ** → **giữ vĩnh viễn**: thêm `sql/00-schema-extras/90-sensorreadings-include-value.sql`. File này chạy lại an toàn (chỉ tạo lại khi `Value` chưa là cột INCLUDE) và áp cho mọi CSDL qua `deploy.ps1`.
  - **Từ lúc đó không được dùng `prisma migrate dev`** (R2: Prisma sẽ coi chỉ mục này là lệch và đòi reset). Thay đổi schema sau đó dùng `prisma migrate diff` như plan database-core. TV1 báo nhóm và ghi vào README database.
  - Chạy lại `npm test` của database và `test:contract` của backend sau khi thêm file.
- **Không rõ** → không thêm vào `sql/`. Báo cáo ghi số đo và lý do không giữ.

## Phần 6 — Phân vùng (Nếu còn thời gian, chỉ trên `_Perf`)

### 6.1 Kiểm trước

- `SELECT SERVERPROPERTY('Edition')`, rồi thử `CREATE PARTITION FUNCTION` trên `_Perf`. Theo tài liệu, Express hỗ trợ phân vùng từ 2016 SP1 (chưa kiểm chứng trên máy nhóm). Lỗi thì dừng phần này và ghi vào báo cáo.

### 6.2 Thiết kế

- `pf_ReadingsMonth`: `RANGE RIGHT` trên `DATETIME2(0)`, mỗi ranh giới là ngày đầu tháng (UTC) phủ khoảng dữ liệu sinh ở 5.1. `ps_ReadingsMonth`: `ALL TO ([PRIMARY])`, vì Express với một ổ đĩa không cần nhiều filegroup.
- Dựng lại chỉ mục cụm `RecordedAt` lên `ps_ReadingsMonth(RecordedAt)` bằng `CREATE CLUSTERED INDEX … WITH (DROP_EXISTING = ON)`. Bảng đã có dữ liệu nên bước này **ghi lại toàn bộ bảng**: đo thời gian và dung lượng log.
- **Chỉ mục phải thẳng hàng (aligned) thì mới `SWITCH` được.**
  - `UQ(DeviceId, MetricCode, RecordedAt)` đã chứa cột phân vùng, nên chỉ cần dựng lại lên scheme.
  - PK `ReadingId` không chứa `RecordedAt`: chỉ mục unique thẳng hàng bắt buộc phải chứa cột phân vùng, nên trên `_Perf` phải đổi PK thành `(ReadingId, RecordedAt)`.
  - Đây là lý do nữa để **không đưa phân vùng vào schema chính** (thêm lệch Prisma theo R2, đổi khóa chính).

### 6.3 `SWITCH` một tháng cũ ra bảng lưu trữ

Bảng `SensorReadings_Archive` phải:
- cùng cấu trúc cột (kiểu, NULL, thứ tự). Bảng được **sinh từ DDL thật của `SensorReadings`** đọc từ `sys.columns`/`sys.types`/`sys.identity_columns` trên `_Perf`, không gõ tay. `ReadingId` có giữ `IDENTITY` ở bảng lưu trữ hay không thì chưa kiểm chứng; nếu `SWITCH` từ chối, TV1 đọc thông báo lỗi, sửa và ghi kết quả vào `partition.md`;
- cùng các chỉ mục, cùng filegroup;
- rỗng;
- không bị khóa ngoại nào tham chiếu tới.

Khi `SWITCH` **ra** một bảng rỗng thì đích không cần `CHECK`. `CHECK` chỉ bắt buộc khi `SWITCH` **vào** từ một bảng thường. Theo tài liệu, chỉ khóa ngoại **tham chiếu tới** nguồn hoặc đích mới chặn `SWITCH`. Khóa ngoại của chính `SensorReadings` tới `Devices`/`Metrics` thì không chặn, và bảng lưu trữ không cần các khóa đó (chưa kiểm chứng; TV1 thử, ghi kết quả). `switch-out.sql` in số dòng của tháng trước/sau và thời gian (kỳ vọng gần như tức thì, vì chỉ đổi siêu dữ liệu).

### 6.4 Đo

- Kỳ vọng **thấp**. Phân vùng chỉ giúp truy vấn lọc theo `RecordedAt` (partition elimination, xem `Actual Partition Count` trong plan). Truy vấn theo `DeviceId` mà không lọc thời gian có thể chậm hơn.
- Đo Q1, Q2 và một truy vấn tổng hợp một tháng, có và không có phân vùng, cùng cách đo 5.3. Kết quả **chiếu đã đo**, không chạy trực tiếp.

## Phần 7 — Nộp kết quả và thuyết trình

### 7.1 `advanced/results/` (hạn 04/11)

| File | Nội dung |
|---|---|
| `security.md` | Bảng quyền 2.3, lý do rộng hơn roadmap, kết quả `security.test.sql` và `test:contract` dưới `app_backend` |
| `concurrency.md` + `concurrency/*.log` | Mỗi kịch bản: mô tả, log hai phiên, trạng thái cuối, giải thích |
| `backup.md` | Thứ tự lệnh, `RESTORE FILELISTONLY`, thời điểm T, số đếm kiểm 4.2 bước 8, thời gian từng bước |
| `perf.md`, `perf/size.md`, `perf/timing.csv`, `perf/*.sqlplan`, `perf/*.png` | Bảng trước/sau theo trung vị, kết luận giữ/bỏ INCLUDE |
| `partition.md` (nếu làm) | Như `perf.md` + thời gian `SWITCH` |

- **Đọc qua từng `.sqlplan` trước khi commit**: file có thể chứa tên máy hoặc đường dẫn. Thay bằng `<may>` nếu có.
- **Không commit dữ liệu sinh ra** (CSDL, `.bak`, `.trn`, `.mdf`); chỉ commit script sinh và `results/`.
- TV5 lấy từ `results/` để viết chương CSDL của báo cáo.

### 7.2 Thuyết trình

| Chạy trực tiếp | Chiếu kết quả đã đo |
|---|---|
| Phân quyền (2.6): `app_backend` thử `DROP` bị từ chối | So sánh trước/sau INCLUDE trên vài triệu dòng |
| Lost update và deadlock bằng `run-two-sessions.ps1` | Phân vùng (nếu làm) |
| Khôi phục đến thời điểm trên `SwiftletCare_Bk_Dev` | |

Trước buổi tập 01/11: `_Perf` đã có dữ liệu, `demo-procs.sql` đã cài, và `pitr-demo.ps1` đã chạy thử ít nhất một lần trên máy demo.

## Rủi ro cần kiểm chứng

| # | Rủi ro | Cách kiểm | Nếu xảy ra |
|---|---|---|---|
| A1 | Chuỗi sở hữu không phủ trigger như 2.4 | Ca 1–2 của `security.test.sql` | Cấp `INSERT` cho đúng bảng trigger ghi; ghi vào báo cáo |
| A2 | `sqlcmd` 17 không lấy biến môi trường làm biến kịch bản | Chạy `create-logins.ps1` | Dùng `-v`; ghi rõ mật khẩu lộ trong danh sách tiến trình |
| A3 | Tài khoản Windows của TV1 không phải sysadmin | `SELECT IS_SRVROLEMEMBER('sysadmin')` | Nhờ người cài SQL Server cấp, hoặc chạy bằng tài khoản đã cài |
| A4 | `CLEAR PROCEDURE_CACHE` không có trên bản máy chấm | Chạy trên máy nhóm (2025) và đọc tài liệu cho 2016 SP1 | Dùng `DBCC FREEPROCCACHE`, ghi lại |
| A5 | UQ do Prisma tạo là constraint, tên khác dự kiến | `sys.indexes` | Script 5.4 đọc tên thật, không ghi cứng |
| A6 | `STOPAT` hiểu giờ khác dự kiến | Bước 8 của 4.2 cho số đếm sai | Đổi cách quy đổi giờ, ghi vào `backup.md` |
| A7 | Sinh 5 triệu dòng quá lâu hoặc vượt 10 GB | Đo lô đầu tiên, ngoại suy | Giảm số dòng, giữ ≥ 6 tháng |
| A8 | Express không cho phân vùng; `SWITCH` bị chặn vì một điều kiện ở 6.3 | 6.1, 6.3 | Sửa bảng lưu trữ theo thông báo lỗi; nếu vẫn không được thì dừng Phần 6, ghi vào báo cáo |
| A9 | D5 chưa xong trước 25/10 | Hỏi TV2 khi giao script 21–22/10 | Tạm để backend chạy `swiftlet_dev`, ghi vào báo cáo; `security.test.sql` vẫn chạy |
