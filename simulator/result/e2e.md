# Task 8 – End-to-End Testing Results

## 1. Scenario HOT

- **Scenario:** `hot`
- **Device:** `H1-F2-SENSOR`, `H1-F2-FAN`
- **Expected:** FAN tự động bật khi nhiệt độ cao và giúp nhiệt độ giảm về mức phù hợp.

### Temperature Monitoring Results

| Time | Temperature (°C) |
|---|---:|
| 08:51:33 | 27.99 |
| 08:53:13 | 29.40 |
| 08:54:53 | 30.51 |
| 08:56:13 | 30.35 |
| 08:57:33 | 29.33 |
| 08:59:13 | 28.55 |
| 09:01:13 | 28.04 |
| 09:03:13 | 28.87 |
| 09:05:13 | 29.70 |
| 09:08:03 | 28.36 |

### Summary

| Item | Result |
|---|---|
| Total readings | 100 |
| Minimum temperature | 27.94°C |
| Maximum temperature | 30.87°C |
| Monitoring period | 08:51:33 – 09:08:03 |
| Fan mode | AUTO |
| Fan status | ON |
| Fan level | 100% |

- **Actual result:** Temperature readings changed over time, reaching a maximum of 30.87°C before decreasing. The FAN was observed in AUTO mode and ON at Level 100 when its current status was queried.
- **Status:** PARTIAL – Temperature variation and current FAN status were verified. Repeated FAN ON/OFF transitions have not yet been confirmed.

## 2. Scenario DRY

- **Scenario:** `dry`
- **Device:** `H1-F3-SENSOR`, `H1-F3-MIST`
- **Expected:** MIST tự động bật khi độ ẩm thấp và giúp độ ẩm tăng về mức phù hợp.

### Humidity Monitoring Results

| Time     | Humidity (%) |
| :------- | ------------: |
| 09:17:05 |         70.00 |
| 09:30:45 |         70.81 |
| 09:30:55 |         71.58 |
| 09:31:05 |         72.30 |
| 09:31:15 |         72.99 |
| 09:31:25 |         73.64 |
| 09:31:35 |         74.26 |

### Summary

| Item             | Result                 |
| :--------------- | :--------------------- |
| Total readings   | Not yet confirmed      |
| Minimum humidity | 70.00%                 |
| Maximum humidity | Above 82% (observed)   |
| Monitoring period| Not fully confirmed    |
| Mist mode        | AUTO                   |
| Mist status      | ON (current status)    |
| Mist level       | NULL                   |

- **Actual result:** Humidity readings changed over time, increasing from 70.00% to above 82% during the monitoring period. The MIST was observed in AUTO mode and ON when its current status was queried.
- **Status:** PARTIAL – Humidity variation and current MIST status were verified. Historical

## 3. Scenario NORMAL

- **Scenario:** `normal`
- **Device:** `H1-F0-SENSOR`, `H1-F1-SENSOR`, `H1-F2-SENSOR`, `H1-F3-SENSOR`
- **Expected:** Môi trường duy trì trong điều kiện bình thường. FAN, HEATER và MIST không tự động bật.

### Environmental Monitoring Results

| Sensor | Metric | Total Readings | Minimum | Maximum |
| :--- | :--- | ---: | ---: | ---: |
| H1-F0-SENSOR | TEMP | 1,169 | 28.00°C | 28.00°C |
| H1-F1-SENSOR | TEMP | 1,169 | 28.00°C | 28.00°C |
| H1-F2-SENSOR | TEMP | 1,169 | 27.85°C | 32.00°C |
| H1-F3-SENSOR | TEMP | 1,169 | 28.00°C | 28.00°C |
| H1-F0-SENSOR | HUMID | 1,169 | 82.00% | 82.00% |
| H1-F1-SENSOR | HUMID | 1,169 | 82.00% | 82.00% |
| H1-F2-SENSOR | HUMID | 1,169 | 82.00% | 82.00% |
| H1-F3-SENSOR | HUMID | 1,169 | 70.00% | 84.30% |

### Summary

| Item | Result |
| :--- | :--- |
| Total readings per sensor/metric | 1,169 |
| Monitoring period | 03:40:11 – 09:43:44 |
| FAN status | OFF (all 4 devices) |
| MIST status | OFF (all 4 devices) |
| FAN mode | AUTO |
| MIST mode | AUTO |

- **Actual result:** Sensor readings were successfully received and stored in SQL Server. Most sensors maintained stable temperature and humidity values. FAN and MIST devices were observed in AUTO mode and OFF when their current statuses were queried.
- **Status:** PARTIAL – Sensor data collection and current actuator statuses were verified. However, H1-F2 temperature reached 32.00°C and H1-F3 humidity varied between 70.00% and 84.30%. Further verification is needed to confirm that the NORMAL scenario was running with the intended environmental conditions throughout the monitoring period.

## 4. Manual FAN Control

- **Device:** `H1-F2-FAN`
- **Expected:** Manual control at Level 50 and Level 100 through the API.
- **Actual result:** Unable to complete because login did not return a Bearer Token.
- **Status:** BLOCKED.

## 5. Overall Result

### Test Summary

| Test Case | Result | Status |
| :--- | :--- | :--- |
| HOT | Temperature variation verified; FAN currently ON at Level 100 in the earlier check. | PARTIAL |
| DRY | Humidity variation verified; MIST currently ON in the earlier check. | PARTIAL |
| NORMAL | 1,243 readings per sensor/metric collected; FAN and MIST currently OFF. | PARTIAL |
| Manual FAN Control | Unable to complete due to login authentication issue. | BLOCKED |

### Overall Conclusion

The SwiftletCare Simulator successfully connected to the Backend through MQTT and transmitted sensor readings to SQL Server. The system collected environmental data for the HOT, DRY, and NORMAL scenarios.

Temperature and humidity variations were observed in the HOT and DRY scenarios. In the NORMAL scenario, 1,243 readings per sensor/metric were recorded from 03:40:11 to 09:56:04. FAN and MIST devices were observed in AUTO mode and OFF during the latest status check.

However, repeated actuator ON/OFF transitions have not been fully verified through historical control records. Manual FAN control testing was also blocked by an authentication issue.

**Final Result:** PARTIAL – The simulator-to-backend-to-database data flow was verified successfully. Further verification of automatic actuator transitions and manual control is required to complete all E2E test cases.