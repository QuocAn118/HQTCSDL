# SwiftletCare — hướng dẫn cho cả nhóm và agent

Đề tài môn Hệ quản trị CSDL: hệ thống IoT nhà yến gồm simulator (cảm biến, cơ cấu chấp hành ảo qua MQTT), AI đếm chim và phát hiện thiên địch trên video (YOLOv8n + ByteTrack), backend NestJS, web Next.js, mobile Expo. **SQL Server là phần được chấm sâu nhất**: nghiệp vụ nằm trong SP/trigger/view. Đề bài gốc: [Project.md](Project.md).

Nhóm 5 người (TV1–TV5), 4 tuần, hạn nộp **09/11/2026** (chờ thầy xác nhận). Cả nhóm dùng **Windows**.

## Đọc trước khi làm

1. [Roadmap](docs/superpowers/specs/2026-10-12-swiftletcare-roadmap.md) — module, phụ thuộc, phân công, mốc tuần, ranh giới cắt.
2. **Spec và plan của module mình** (bảng dưới). **Đọc hết spec trước khi viết dòng code nào.**
3. [integration-contract](docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md) — nếu module của bạn gửi/nhận dữ liệu với module khác (hầu như mọi module).

| Module | Chủ | Spec | Plan |
|---|---|---|---|
| `database-core` | TV1 | [spec](docs/superpowers/specs/2026-10-12-swiftletcare-database-core-design.md) | [plan](docs/superpowers/plans/2026-10-14-swiftletcare-database-core.md) |
| `integration-contract` | TV2 (TV1 cùng duyệt) | [spec](docs/superpowers/specs/2026-10-13-swiftletcare-integration-contract-design.md) | [plan](docs/superpowers/plans/2026-10-14-swiftletcare-integration-contract.md) |
| `database-advanced` | TV1 | chưa viết | chưa viết |
| `ai-vision` | TV3 | [spec](docs/superpowers/specs/2026-10-15-swiftletcare-ai-vision-design.md) | [plan](docs/superpowers/plans/2026-10-16-swiftletcare-ai-vision.md) |
| `backend` | TV2 | [spec](docs/superpowers/specs/2026-10-15-swiftletcare-backend-design.md) | [plan](docs/superpowers/plans/2026-10-16-swiftletcare-backend.md) |
| `simulator` | TV5 | [spec](docs/superpowers/specs/2026-10-16-swiftletcare-simulator-design.md) | [plan](docs/superpowers/plans/2026-10-16-swiftletcare-simulator.md) |
| `web` | TV4 | [spec](docs/superpowers/specs/2026-10-16-swiftletcare-web-design.md) | [plan](docs/superpowers/plans/2026-10-16-swiftletcare-web.md) |
| `mobile` | TV4 | [spec](docs/superpowers/specs/2026-10-16-swiftletcare-mobile-design.md) | [plan](docs/superpowers/plans/2026-10-16-swiftletcare-mobile.md) |

Spec/plan mới nằm trong `docs/superpowers/specs/` và `docs/superpowers/plans/`, tên `YYYY-MM-DD-swiftletcare-<module>[-design].md`. Có file mới thì cập nhật bảng này.

## Quy tắc làm việc

- **Không tự đổi hợp đồng.** Mọi thay đổi topic, payload, endpoint, sự kiện, mã lỗi, fixture đi qua **Pull Request** sửa spec integration-contract và `contracts/fixtures/` **trong cùng PR**. TV2 duyệt; đụng SP thì TV1 cùng duyệt. Merge xong **báo cả nhóm** (trường gì đổi, module nào bị ảnh hưởng). Module chỉ sửa theo sau khi PR hợp đồng đã merge.
- **Không tự đổi spec module khác.** Thấy spec sai hoặc thiếu thì báo chủ module.
- **Làm theo plan bằng `superpowers:executing-plans`**, từng task: viết test trước, chạy cho fail, code cho đạt, commit. Không bỏ bước test.
- Mỗi module làm trên nhánh riêng, vào `main` qua PR.
- PR thường cần **ít nhất một người duyệt** trước khi merge vào `main`; PR hợp đồng cần **cả TV2 và TV1** duyệt.
- Commit message tiếng Việt, mô tả việc đã làm.
- **Không commit bí mật:** chỉ commit `.env.example`, không commit `.env`, `infra/mosquitto/passwd`, mật khẩu, khóa dịch vụ, token. Không ghi thông tin cá nhân vào repo.
- Mục dưới **ranh giới cắt** (roadmap) chỉ làm khi mục Bắt buộc phía trên đã xong.

## Quy ước đã chốt (chi tiết trong spec)

**Dữ liệu và thời gian**
- Mọi mốc thời gian lưu `DATETIME2(0)` **UTC**. JSON/API dùng ISO 8601 **bắt buộc có `Z`**; thiếu `Z` hoặc `+07:00` bị từ chối (REST 400, MQTT bỏ phần tử).
- Ngày nghiệp vụ giờ Việt Nam (`harvestDate`, `fromVnDate`, `toVnDate`) dạng `YYYY-MM-DD`. Giờ VN = UTC+7.
- Tên trường API camelCase; cột SP PascalCase, backend đổi ở **một bộ tuần tự hóa chung**. Trường rỗng trả `null`, không bỏ khóa. DECIMAL ra `number`.
- MQTT/AI dùng **mã thiết bị** (`H1-F2-FAN`); REST dùng **id số INT**.

**SQL Server**
- Bảng do Prisma định nghĩa; nghiệp vụ trong **SP/trigger/view** (`database/sql/`). SP nhận dữ liệu lô bằng **JSON qua `OPENJSON`** (không TVP); mỗi SP trả **đúng 1 tập kết quả**.
- `FOR JSON` chỉ trong truy vấn con, luôn `INCLUDE_NULL_VALUES`.
- **Cấm** `GREATEST`, `LEAST`, `DATE_BUCKET`, `DATETRUNC`, `GENERATE_SERIES`, `STRING_SPLIT(…, enable_ordinal)` — máy chấm có thể là SQL Server cũ (≥ 2016 SP1, compatibility level ≥ 130). Dùng `CASE WHEN`.
- Không ghi bảng có trigger bằng `prisma.<model>.create/update` (Prisma sinh `OUTPUT` không `INTO`); dùng SP hoặc `$executeRaw` có tham số.
- Ba CSDL: `SwiftletCare_Dev` (phát triển), `SwiftletCare_Test` (test, tạo lại mỗi lần), `SwiftletCare` (demo, **không bao giờ reset**). `deploy.ps1 -Reset` chỉ chạy với tên kết thúc `_Dev`/`_Test`.

**Tích hợp**
- MQTT: `swiftlet/devices/{code}/readings|heartbeat|command`; `command` là trạng thái mong muốn, retained.
- AI gửi kết quả cho backend qua **HTTP** với header `X-Service-Key`; AI không ghi thẳng SQL Server.
- WebSocket (Socket.IO): mọi sự kiện phát vào phòng `house:{houseId}`; client không gửi sự kiện lên.
- Fixture ở `contracts/fixtures/`, không có mốc thời gian hay id cố định (`{{now}}`, `{{ref:…}}`, `{{any:id}}`). Thay chỗ giữ chỗ và so khớp **chỉ bằng** `contracts/lib/fixtures.mjs`. Mỗi chuỗi fixture chạy trên CSDL vừa phục hồi về dữ liệu mẫu.

## Cấu trúc thư mục

```
docs/superpowers/specs/   spec đã duyệt (roadmap + từng module)
docs/superpowers/plans/   plan triển khai từng module
database/                 Prisma schema + migration, sql/ (view, SP, trigger, seed), tests/*.test.sql, scripts/*.ps1
contracts/                fixture hợp đồng + thư viện so khớp + test (npm test)
infra/mosquitto/          cấu hình Mosquitto mẫu + hướng dẫn tài khoản
backend/  simulator/  ai-vision/  web/  mobile/   (tạo theo plan từng module)
```

Thư mục chỉ có sau khi plan tương ứng được thực thi.

## Phiên bản đã chốt

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| SQL Server | Express ≥ 2016 SP1 (máy nhóm: 2025) | compatibility level ≥ 130; bật Mixed Mode + TCP/IP 1433 |
| `sqlcmd` | máy nhóm: 17 (mức tối thiểu chưa kiểm chứng) | chạy với `-I -f 65001 -b` |
| Node.js | `^20.19 \|\| ^22.12 \|\| >=24` (máy nhóm: 25) | Prisma báo lỗi phiên bản Node → cài LTS 24 |
| Prisma, `@prisma/adapter-mssql` | **7.10.0** (ghim chính xác) | `latest` trên npm đang là 8.0.0-rc — không cài không ghi phiên bản |
| PowerShell | 5.1 (có sẵn trên Windows) | file `.ps1` chỉ dùng ký tự ASCII |
| Mosquitto | 2.x | mặc định chỉ nghe `127.0.0.1` |
| NestJS, Next.js, Expo SDK, Python + Ultralytics | chốt trong spec từng module | |

## Cần cài trên máy mỗi thành viên

| Ai | Cài |
|---|---|
| Mọi người | Git, Node.js (theo bảng trên), VS Code + Claude Code, `gh` (GitHub CLI, chạy `gh auth login`), quyền truy cập repo GitHub của nhóm |
| Mọi người | SQL Server Express + `sqlcmd` (chạy database cục bộ để test module của mình) |
| Mọi người chạy backend/simulator | Mosquitto 2.x — làm theo `infra/mosquitto/README.md` (dừng dịch vụ Mosquitto do bộ cài tạo, tạo tài khoản bằng `mosquitto_passwd`) |
| TV3 (ai-vision) | Python + môi trường ảo, Ultralytics — chốt trong spec ai-vision |
| TV4 (mobile) | Expo Go trên điện thoại hoặc Android Emulator |

Mỗi module có `.env.example`; chép thành `.env` rồi điền giá trị của máy mình.

## Plugin, MCP, skill của Claude Code

Cài plugin bằng `/plugin install <tên>@<marketplace>`. Marketplace ngoài `claude-plugins-official` thì thêm bằng `/plugin marketplace add <nguồn>` trước (xin nguồn từ người quản lý repo).

| Plugin / MCP | Dùng để |
|---|---|
| `superpowers@claude-plugins-official` | Quy trình: `brainstorming` → spec, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review` |
| `code-review@claude-plugins-official` | Rà PR trước khi nhờ người duyệt |
| `ponytail@ponytail` | Giữ code tối thiểu, không thêm thứ không ai yêu cầu |
| `frontend-design@claude-plugins-official`, `taste-skill@taste-skill` | Thiết kế giao diện web/mobile |
| `playwright@claude-plugins-official` (MCP) | Mở trình duyệt kiểm thử web |
| `expo@claude-plugins-official` (MCP + skill) | Expo Router, UI, gọi dữ liệu, EAS |
| `mobile-mcp@mobile-mcp` (MCP) | Điều khiển emulator/điện thoại thật để kiểm thử app |
| MCP `codebase-memory-mcp` | Tìm hàm, lời gọi, kiến trúc trong repo |
| MCP `stitch` | Phác thảo màn hình (cách cấu hình/khóa: chưa kiểm chứng; không commit khóa) |

| Module | Dùng |
|---|---|
| `database-core`, `database-advanced` | superpowers (`executing-plans`, `test-driven-development`, `systematic-debugging`), codebase-memory-mcp, ponytail |
| `integration-contract` | superpowers, code-review |
| `backend` | superpowers, codebase-memory-mcp, code-review, ponytail |
| `simulator` | superpowers, ponytail |
| `ai-vision` | superpowers (`systematic-debugging` khi mô hình cho kết quả lạ), ponytail |
| `web` | superpowers, frontend-design, taste-skill, stitch, playwright |
| `mobile` | superpowers, expo (skill `expo-router`, `expo-ui`, `expo-data-fetching`), mobile-mcp, frontend-design, taste-skill |
