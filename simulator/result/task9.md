

# Task 9 – MQTT Disconnection, Message Queue and Recovery

## 1. DROP / RESTORE Test

- Scenario: `normal`
- Device: `H1-F1-SENSOR`
- Drop after: 1 minute
- Drop duration: 7 minutes
- Expected: The simulator disconnects the selected device, stores QoS 1 messages during the disconnection, and reconnects the device after 7 minutes.

### Simulation Execution Results

| Parameter             | Actual Result   |
| --------------------- | --------------- |
| Scenario              | NORMAL          |
| Total devices loaded  | 26              |
| Heartbeat interval    | 30 seconds      |
| Target device         | H1-F1-SENSOR    |
| Drop configuration    | After 1 minute  |
| Restore configuration | After 7 minutes |

### MQTT Connection Results

| Device Group | Connection Result |
| ------------ | ----------------- |
| Sensors      | Connected         |
| Fans         | Connected         |
| Heaters      | Connected         |
| Misters      | Connected         |
| Speakers     | Connected         |

Actual log:

```
[SIM] Loaded 26 devices
[SIM] Simulation started
[H1-F1-SENSOR] Connected
[H1-F1-FAN] Connected
[H1-F1-MIST] Connected
[H1-F1-HEATER] Connected
```

### DROP and RESTORE Results

| Event              | Actual Result |
| ------------------ | ------------- |
| DROP initiated     | H1-F1-SENSOR  |
| MQTT disconnection | Successful    |
| Messages queued    | 42            |
| RESTORE initiated  | Successful    |
| MQTT reconnection  | Successful    |
| Restore completed  | Successful    |

Actual log:

```
[DROP] Disconnecting: H1-F1-SENSOR
[DROP] Disconnected: H1-F1-SENSOR
[MAIN] Drop completed

[RESTORE] Reconnecting: H1-F1-SENSOR
[H1-F1-SENSOR] Connected
[RESTORE] H1-F1-SENSOR: 42 queued messages
[RESTORE] Completed: H1-F1-SENSOR
[MAIN] Restore completed
```

- Actual result: H1-F1-SENSOR was successfully disconnected and reconnected. The simulator recorded 42 queued messages during the disconnection.
- Status: PASS for DROP/RESTORE; PARTIAL for independent message-delivery verification.

## 2. QoS 1 Message Queue

- Device: `H1-F1-SENSOR`
- Expected: QoS 1 messages are temporarily stored while the device is disconnected and sent again after reconnection in their original order.

### Message Queue Results

| Parameter                     | Actual Result    |
| ----------------------------- | ---------------- |
| Device                        | H1-F1-SENSOR     |
| Queued messages               | 42               |
| Queue creation                | Successful       |
| Queue processing              | Completed        |
| Broker delivery verification  | Not yet verified |
| Message ordering verification | Not yet verified |

- Actual result: The simulator recorded 42 queued messages and completed the restore process. However, complete message delivery and original ordering have not yet been independently verified.
- Status: PARTIAL.

## 3. Heartbeat Monitoring

\- Expected: Actuator devices send heartbeat messages every 30 seconds using QoS 0.

### Heartbeat Configuration Results

| Parameter                | Actual Result    |
| ------------------------ | ---------------- |
| Heartbeat interval       | 30 seconds       |
| Target devices           | Actuators        |
| QoS                      | 0                |
| Actual periodic delivery | Not yet verified |

- Actual result: The simulator confirmed the heartbeat interval was configured to 30 seconds. Actual periodic transmission has not yet been verified through Mosquitto or Backend logs.
- Status: PARTIAL.

## 4. Overall Result

### Test Summary

| Test Case           | Result                                                                               | Status  |
| ------------------- | ------------------------------------------------------------------------------------ | ------- |
| Simulator Startup   | 26 devices loaded and simulation started successfully.                               | PASS    |
| MQTT Connection     | Devices connected successfully to the MQTT Broker.                                   | PASS    |
| DROP                | H1-F1-SENSOR was successfully disconnected.                                          | PASS    |
| QoS 1 Message Queue | 42 messages were recorded in the queue; complete delivery is not yet verified.       | PARTIAL |
| RESTORE             | H1-F1-SENSOR reconnected successfully and the restore process completed.             | PASS    |
| Heartbeat           | The 30-second interval was configured; actual periodic delivery is not yet verified. | PARTIAL |

### Overall Conclusion

The simulator successfully performed the DROP and RESTORE operations using the MQTT Broker. The selected sensor was disconnected, 42 QoS 1 messages were recorded in the queue, and the device successfully reconnected after the configured disconnection period.

However, the complete delivery and ordering of queued messages, as well as actual periodic heartbeat transmission, still require further verification.

Overall Status: PARTIAL.
