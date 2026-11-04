# Kiểm thử đầu-cuối web (spec web 3.2)

- Ngày: 04/11/2026 · Người làm: TV4 (qua Claude Code, Playwright MCP) · Trình duyệt: Chromium của Playwright MCP
- Commit web và backend: nhánh `web`, HEAD `ce09679` cộng các thay đổi web chưa commit lúc kiểm (T7W-1, Task 8, Task 9, T9W, T11W-1/3, T15W-1/2). Backend chạy từ `backend/dist` build trên HEAD đó.
- Cách chạy: `npm run build` + `npm start` (cổng 3001), backend thật với **bản sao `.env`** thêm `CORS_ORIGINS` IP LAN, CSDL `SwiftletCare_Dev`, Mosquitto thật.
- **Chưa có simulator trong repo:** số đo gửi bằng `mosquitto_pub` theo đúng payload hợp đồng, nhịp 10 giây do script kiểm thử tạo. Bước 3, 4 vì vậy không chứng minh hành vi của simulator thật.
- **CSDL không nạp lại seed trước khi kiểm:** dùng dữ liệu Dev hiện có (có các dòng ZZ-TEST của lần kiểm trước), chụp mốc rồi trả về đúng mốc sau khi kiểm.

| # | Bước (spec 3.2) | Kết quả | Đạt |
|---|---|---|---|
| 1 | Đăng nhập sai → câu chung; `owner1` thấy nhà mình | Sai mật khẩu, tên không tồn tại và tài khoản đang khóa đều báo cùng câu "Sai tên đăng nhập hoặc mật khẩu". `owner1` vào `/houses/1`, tiêu đề H1 | Đạt |
| 2 | `owner2` gõ URL nhà H1 → "Không tìm thấy" | `/houses/1` và `/houses/1/alerts` đều hiện "Không tìm thấy" | Đạt |
| 3 | Dashboard cập nhật mỗi 10–15 giây; ngoài ngưỡng đổi màu | Gửi mỗi 10 giây bằng `mosquitto_pub`: ô đổi ở 1,1 / 11,2 / 21,2 / 30,3 giây. TEMP 40 °C: ô Nhiệt độ đỏ, ô Độ ẩm giữ nguyên; về 27,5 °C thì hết đỏ. Huy hiệu OFFLINE của F1 tắt khi có số đo | Đạt (không có simulator) |
| 4 | `--scenario hot` → FAN H1-F2 bật rồi tắt | Thay bằng số đo TEMP 38 °C rồi 27 °C: "Tắt · Tự động" → "Bật 100% · Tự động" → "Tắt · Tự động", đo sau 4 giây mỗi chiều | Đạt (không có `--scenario hot`) |
| 5 | FAN Level 50 theo phản hồi; Level 0 → tắt (`isOn: false`); nhật ký; trả về tự động | Level 50: body `{"mode":"MANUAL","isOn":true,"level":50}`, 200, hiện "Đang bật 50% · Điều khiển tay". Level 0: `{"mode":"MANUAL","isOn":false}`, hiện "Đang tắt". Nhật ký có dòng mới. "Trả về tự động": `{"mode":"AUTO"}`, hiện "Đang tắt · Tự động". Nhật ký 45 dòng: trang đầu 20, "Tải thêm" (`before=32`) thành 40, nút vẫn còn (T8W-1) | Đạt |
| 6 | ACK, RESOLVED; ACK lại → đã đổi trạng thái | ACK kèm ghi chú rồi RESOLVED: lịch sử đủ 3 dòng, hết nút, rời danh sách đang mở. Đổi trạng thái bằng API rồi bấm ACK: 409 `ALERT_INVALID_TRANSITION`, hiện "Cảnh báo đã đổi trạng thái. Đã tải lại.", tiêu đề về "Đã xử lý" | Đạt |
| 7 | Ảnh seed 404 → "Không có ảnh"; ảnh AI hiện; không còn object URL cũ | Cảnh báo #3: "Không có ảnh". Gửi thật vào `/api/ai/predator-detections`: ảnh hiện bằng URL `blob:`, rộng 160 px. Chuyển trang: `fetch` URL đó thất bại (đã thu hồi). `owner2` xem được ảnh H2; gọi ảnh của H1 nhận 404 (T9W-4) | Đạt |
| 8 | Min ≥ Max → lỗi ngưỡng | Min 31 / Max 30 và Min 30 / Max 30: "Ngưỡng không hợp lệ (Min phải nhỏ hơn Max)." Min "abc": chặn trước khi gửi | Đạt |
| 9 | Tắt/bật backend → kết nối lại, không trùng, không mất cảnh báo | Tắt: thanh "Mất kết nối máy chủ, đang kết nối lại…" hiện ngay, danh sách giữ nguyên. Bật: thanh tắt, danh sách tải lại, không có dòng trùng. Số đo gửi lúc backend tắt được broker giữ và giao sau (phiên `clean: false`), cảnh báo 41 °C hiện lên. Số đo mới trong CSDL không trùng khóa (44/44) | Đạt |
| 10 | Khóa `owner1` qua API → web về `/login` | Về `/login?reason=unauthorized` sau 253 ms. Đăng nhập lại khi đang khóa: câu chung. Đã mở khóa | Đạt |
| 11 | Mở bằng IP LAN từ máy khác | **Chỉ thử trên chính máy này** qua `http://192.168.1.43:3001`, build với `NEXT_PUBLIC_API_URL=http://192.168.1.43:3000`, `CORS_ORIGINS` qua bản sao `.env`: đăng nhập, REST, socket, số đo trực tiếp đều chạy. Không có máy thứ hai; Windows Firewall chưa có luật riêng cho cổng 3001 nên máy khác có thể bị chặn | Chưa làm phần "máy khác" |
| 12 | Ca trống, ca lỗi (5 ý) | "Chưa có số đo" (khu vực ZZ có cảm biến chưa có số đo). "Không có cảnh báo" (lọc không có dòng). "Không có dữ liệu" (biểu đồ, khoảng trống). Mất mạng ở trang Cảnh báo: báo lỗi kèm "Thử lại", sau khoảng 27 giây có thanh mất kết nối, không trắng trang. Ảnh 404: "Không có ảnh" | Đạt |
| 13 | `owner1` mở `/admin/tools` → không tìm thấy; API → 403 | Giao diện "Không tìm thấy trang", không có nút. API: 403 khi `DEMO_TOOLS=true`, 404 khi `DEMO_TOOLS=false` | Đạt |
| 14 | Đăng xuất tab A, tab B vẫn dùng được | Tab mới không có phiên, phải đăng nhập riêng. Đăng xuất tab A: tab B ở nguyên trang, chuyển trang và gửi lệnh điều khiển vẫn 200 | Đạt |
| 15 | `next build` + `next start -p 3001` chạy đủ các bước | Mọi bước chạy trên `next start`. Sau khi sửa T15W-1/2, build lại và chạy lại: đăng nhập, số đo, FAN bật/tắt, 5 tab, "Thử lại". Các bước còn lại không chạy lại. Bản cuối chỉ sửa thêm `NAME_PATTERN`; trên bản đó chỉ kiểm đăng nhập, Tổng quan và 4 ô nhập tên | Đạt |

## Các mục còn treo

| Mục | Nội dung | Kết quả | Đạt |
|---|---|---|---|
| T8W-1 | Nhật ký > 20 dòng, "Tải thêm" | Xem bước 5 | Đạt |
| T9W-4 | Tắt mạng ở trang Cảnh báo; `owner2` xem ảnh H2 | Xem bước 7, 12. Mất mạng rồi **bấm sang tab khác**: xem T15W-3 | Đạt, có hạn chế |
| T10W-5 | `owner2` trang Lịch sử; dữ liệu bù sau nối lại | Lịch sử H2 chạy đủ. Khoảng không dữ liệu: "Không có dữ liệu"; khoảng seed: có biểu đồ. Gửi số đo lúc trình duyệt mất mạng: nối lại thì REST trả về và biểu đồ hiện điểm đó | Đạt |
| T11W-5 | Tên khoảng trắng, quá dài qua prompt; mất mạng ở Cài đặt | Hủy, rỗng: không gửi. 51 ký tự: 400, báo "Dữ liệu nhập chưa đúng…" (xem T15W-6). Khoảng trắng: **trước khi sửa lưu thành tên trống**, sau khi sửa không gửi (T15W-2). Prompt được giả lập bằng cách gán `window.prompt`. Mất mạng khi lưu: báo lỗi, giữ nội dung form, không có "Thử lại" | Đạt sau khi sửa |
| T14W-2 | 503 và bấm đúp ở `/admin/tools` | 503 thật: "Hệ thống bận, vui lòng thử lại.", nút vẫn bấm được. Bấm đúp: 1 POST | Đạt |
| "Thử lại" | Hiện khi 503/NETWORK; không tự gửi lại thao tác ghi | 503 thật (backend trỏ cổng CSDL sai) và 503 giả lập: có nút ở Tổng quan (sau T15W-1), Thiết bị, Cảnh báo, Lịch sử, Cài đặt, danh sách nhà; bấm là tải lại được (trừ danh sách nhà: chỉ thấy nút). Thao tác ghi lỗi (POST điều khiển 503, PATCH ACK mất mạng, PATCH nhà mất mạng) không có nút và không tự gửi lại; CSDL xác nhận ACK không được ghi | Đạt |

## Phát hiện

| Mã | Nội dung | Xử lý |
|---|---|---|
| T15W-1 | Mở Tổng quan lúc backend 503 hoặc mất mạng: không có "Thử lại", backend hồi rồi trang vẫn kẹt ở thông báo | Đã sửa: có "Thử lại", tự tải lại khi nối lại. Xác nhận lại trên trình duyệt |
| T15W-2 | Backend nhận tên toàn khoảng trắng (`@Length(1, …)`), khu vực ZZ bị lưu tên trống | Web đã chặn ở prompt (`cleanName`, có test) và 4 form (`NAME_PATTERN`, có test). Trên trình duyệt, cả 4 ô nhận "Nhà 1" và từ chối chuỗi khoảng trắng (chỉ kiểm hợp lệ, không gửi form). Backend chưa chặn: báo TV2 |
| T15W-3 | Mất mạng rồi bấm tab: Next không tải được trang từ máy chủ web, trình duyệt hiện trang lỗi mạng | Chưa sửa, ghi hạn chế trong README |
| T15W-4 | Mở trang lúc backend lỗi: tiêu đề giữ "Nhà yến" đến khi tải lại | Chưa sửa, ghi hạn chế trong README |
| T15W-5 | Nhật ký hiện "Tắt 50%" vì backend giữ `level` khi `isOn: false`; Tổng quan và Thiết bị không bị | Chưa sửa |
| T15W-6 | Prompt tên quá dài: thông báo bảo xem trường được đánh dấu, nhưng trường đó thuộc form thêm mới, không phải prompt | Chưa sửa |

## Test hợp đồng backend

`npm run test:contract` (`backend`, CSDL `SwiftletCare_Test`): `extras.test.mjs` đạt 10/10. `run.test.mjs` lần đầu 39 ca fail ngay ở bước build vì `EPERM` khi đọc một file trong `node_modules`; chạy riêng lại đạt 45/45. Hai file không đạt trong cùng một lần chạy, nguyên nhân `EPERM` chưa rõ.

## Dữ liệu sau khi kiểm

`SwiftletCare_Dev` về đúng mốc chụp trước khi kiểm: 12 cảnh báo, lịch sử tới #18, 15 nhật ký, 54164 số đo, 864 đếm chim; checksum `Devices`, `Thresholds`, `Users`, `Houses`, `Zones` khớp. Ảnh thử trong `backend/storage` đã xóa. Các dòng ZZ-TEST có từ trước vẫn còn.
