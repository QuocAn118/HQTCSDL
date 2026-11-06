Ban ghi cu cua TV5, da duoc thay bang simulator/result/e2e.md (06/11/2026). Muc PARTIAL/BLOCKED trong file nay da duoc kiem lai va dat; viec ALTER COLUMN Value DECIMAL(12,4) khong con hieu luc, CSDL nhom la DECIMAL(9,2) (da reset bang deploy.ps1 -Reset).

# Task 11 – Manual Sensor Disconnection & Recovery Test

## 1. Objective

Kiểm tra khả năng xử lý khi một cảm biến bị ngắt kết nối trong quá trình hoạt động và được khôi phục sau đó.

Các mục tiêu kiểm thử:

- Mô phỏng việc cảm biến mất kết nối với MQTT Broker.
- Kiểm tra khả năng kết nối lại sau một khoảng thời gian.
- Kiểm tra cơ chế lưu tạm dữ liệu trong thời gian mất kết nối.
- Kiểm tra dữ liệu cảm biến tiếp tục được ghi nhận vào SQL Server sau khi kết nối được khôi phục.

## 2. Test Configuration

| Parameter | Value |
|---|---|
| Scenario | `normal` |
| Sensor | `H1-F1-SENSOR` |
| Drop after | 1 minute |
| Drop duration | 7 minutes |
| Reading interval | 10 seconds |
| Heartbeat interval | 30 seconds |
| MQTT QoS | 1 |

### Execution Command

```powershell
npm.cmd start -- --scenario normal --drop H1-F1-SENSOR --drop-after 1 --drop-for 7
```

## 3. Test Execution Results

### 3.1. Sensor Disconnection

Simulator ghi nhận cảm biến được ngắt kết nối theo lịch kiểm thử:

```text
[DROP] Disconnecting: H1-F1-SENSOR
[DROP] Disconnected: H1-F1-SENSOR
[MAIN] Drop completed
```

Kết quả: Cảm biến `H1-F1-SENSOR` đã được ngắt kết nối thành công.

### 3.2. Sensor Reconnection

Sau khoảng thời gian ngắt kết nối, Simulator thực hiện khôi phục:

```text
[MAIN] Restore scheduled
[RESTORE] Reconnecting: H1-F1-SENSOR
[H1-F1-SENSOR] Connected
[RESTORE] H1-F1-SENSOR: 42 queued messages
[RESTORE] Completed: H1-F1-SENSOR
[MAIN] Restore completed
```

Kết quả:

- Cảm biến kết nối lại thành công.
- Simulator ghi nhận 42 tin nhắn đang được lưu trong hàng đợi.
- Quá trình khôi phục được hoàn tất ở phía Simulator.

Lưu ý: Log trên xác nhận số lượng tin nhắn trong hàng đợi, chưa xác nhận toàn bộ 42 tin nhắn đã được MQTT Broker chuyển đến Backend và lưu thành công vào SQL Server.

## 4. SQL Server Verification

Sử dụng câu truy vấn sau để kiểm tra dữ liệu của cảm biến:

```sql
SELECT TOP 100
    d.Code,
    s.MetricCode,
    s.Value,
    s.RecordedAt
FROM dbo.SensorReadings s
JOIN dbo.Devices d
    ON d.DeviceId = s.DeviceId
WHERE d.Code = 'H1-F1-SENSOR'
ORDER BY s.RecordedAt DESC;
```

Kết quả truy vấn ghi nhận dữ liệu của cảm biến với bốn thông số:

- `TEMP`: Temperature
- `HUMID`: Humidity
- `CO2`: Carbon dioxide
- `LIGHT`: Light intensity

Các bản ghi được lưu vào SQL Server với độ chính xác bốn chữ số thập phân.

Kết quả cho thấy SQL Server tiếp tục có dữ liệu của cảm biến sau quá trình kiểm thử.

## 5. Data Interval Verification

Sử dụng câu truy vấn sau để kiểm tra khoảng thời gian giữa hai lần ghi nhận dữ liệu liên tiếp:

```sql
WITH TimePoints AS (
    SELECT DISTINCT s.RecordedAt
    FROM dbo.SensorReadings s
    JOIN dbo.Devices d
        ON d.DeviceId = s.DeviceId
    WHERE d.Code = 'H1-F1-SENSOR'
      AND s.RecordedAt >= '2026-11-05 11:20:00'
      AND s.RecordedAt <= '2026-11-05 11:40:00'
),
TimeCheck AS (
    SELECT
        RecordedAt,
        LAG(RecordedAt) OVER (
            ORDER BY RecordedAt
        ) AS PreviousTime
    FROM TimePoints
)
SELECT
    PreviousTime,
    RecordedAt,
    DATEDIFF(SECOND, PreviousTime, RecordedAt) AS GapSeconds
FROM TimeCheck
WHERE PreviousTime IS NOT NULL
ORDER BY RecordedAt;
```

### Observed Results

| Time interval | Gap |
|---|---:|
| Most recorded intervals | 10 seconds |
| 11:25:02 – 11:25:13 | 11 seconds |
| 11:30:23 – 11:30:48 | 25 seconds |

Phần lớn các bản ghi có khoảng cách 10 giây, phù hợp với chu kỳ gửi dữ liệu đã cấu hình.

Tại khoảng `11:30:23–11:30:48`, hệ thống ghi nhận khoảng cách 25 giây. Đây là một khoảng trễ bất thường so với chu kỳ thông thường.

Sau khoảng thời gian này, dữ liệu tiếp tục được ghi nhận với chu kỳ chủ yếu là 10 giây.

## 6. Evaluation

| Test Case | Expected Result | Actual Result | Status |
|---|---|---|---|
| Sensor disconnection | Sensor disconnects | Disconnection confirmed in log | PASS |
| Sensor reconnection | Sensor reconnects | Reconnection confirmed in log | PASS |
| Message queue | Messages are queued during disconnection | 42 queued messages reported | PASS |
| SQL Server persistence | Sensor readings are stored | Sensor readings found in SQL Server | PASS |
| Data interval | Readings are recorded approximately every 10 seconds | Mostly 10-second intervals; one 25-second gap | PARTIAL |
| Queued message delivery | Queued messages are successfully delivered and stored | Not independently verified | NOT VERIFIED |

## 7. Conclusion

The manual sensor disconnection and recovery test demonstrated that the Simulator can disconnect and reconnect the `H1-F1-SENSOR` device.

During the recovery process, the Simulator reported 42 queued messages. SQL Server also continued to contain sensor readings after the reconnection.

The database verification showed that most readings were recorded at approximately 10-second intervals. However, one 25-second gap was observed during the test period.

Although the Simulator reported that the queued messages were restored, the successful delivery and persistence of all 42 messages have not yet been independently verified through Backend logs and SQL Server records.

**Final Status: PARTIAL**

Further verification of MQTT message delivery and Backend processing is required before considering the entire recovery mechanism fully validated.