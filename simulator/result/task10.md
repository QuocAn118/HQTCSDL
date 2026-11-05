# Task 10 – Deterministic Sensor Noise

## 1. Objective

Implement deterministic sensor noise in the SwiftletCare Simulator to make simulated sensor readings more realistic.

The noise is added to the original environmental values before they are published to the MQTT broker.

The implementation must satisfy the following requirements:

- Sensor readings include small random variations.
- The same seed produces the same noise sequence.
- Different seeds produce different noise sequences.
- When noise is disabled, the original sensor values remain unchanged.
- Noise must stay within predefined limits for each metric.

## 2. Implementation

### 2.1. Noise Generator

File: `src/noise.mjs`

The simulator uses a seeded pseudo-random number generator (PRNG).

The Linear Congruential Generator (LCG) algorithm is used to generate deterministic random values.

```javascript
export function createNoise(seed) {
  let state = seed >>> 0;

  return function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
```

The generated random value is converted into a small variation based on the metric.

### 2.2. Noise Limits

Each environmental metric has its own noise range.

| Metric | Maximum Noise |
|---|---:|
| TEMP | ±0.05 °C |
| HUMID | ±0.2 % |
| CO2 | ±5 ppm |
| LIGHT | ±0.05 |

The noise value is generated within the corresponding range and added to the original sensor reading.

### 2.3. Seed Configuration

The noise generator receives its seed from the `.env` file.

```env
NOISE_SEED=12345
```

The configuration module reads and validates this value.

The seed is passed from `main.mjs` to the simulator through the `noiseSeed` parameter.

This allows the simulation to reproduce the same noise sequence when the same seed and execution conditions are used.

### 2.4. Integration with Simulator

File: `src/sim.mjs`

The simulator imports the noise generator:

```javascript
import { makeNoise } from './noise.mjs';
```

The noise function is initialized using the configured seed:

```javascript
const noise = makeNoise(noiseSeed);
```

When generating sensor readings, the noise is added to the original environmental value:

```javascript
const noisyValue = values[metric] + noise(metric);
```

The resulting value is then processed and published through MQTT.

The existing device simulation, sensor metrics, actuator commands, heartbeat, and device disconnection logic are preserved.

## 3. Execution

### 3.1. Install Dependencies

Run the following command inside the simulator directory:

```powershell
npm install
```

### 3.2. Run Unit Tests

```powershell
npm.cmd test
```

The test suite should be executed again after integrating the noise generator to ensure that the existing simulator functionality remains unchanged.

### 3.3. Run Normal Scenario

```powershell
npm.cmd start -- --scenario normal
```

### 3.4. Run HOT Scenario

```powershell
npm.cmd start -- --scenario hot
```

### 3.5. Run DRY Scenario

```powershell
npm.cmd start -- --scenario dry
```

## 4. Verification

### 4.1. Deterministic Behavior

The expected behavior is:

| Test Case | Expected Result |
|---|---|
| Same seed | Same noise sequence |
| Different seeds | Different noise sequences |
| Noise disabled | Noise value equals 0 |
| TEMP | Noise stays within ±0.05 |
| HUMID | Noise stays within ±0.2 |
| CO2 | Noise stays within ±5 |
| LIGHT | Noise stays within ±0.05 |

### 4.2. Database Precision

The `SensorReadings.Value` column was changed to `DECIMAL(12,4)` to preserve small decimal variations in sensor readings.

SQL command:

```sql
ALTER TABLE dbo.SensorReadings
ALTER COLUMN Value DECIMAL(12,4) NOT NULL;
```

This precision helps prevent small noise values from being rounded away when sensor readings are stored in SQL Server.

### 4.3. HOT Scenario Evidence

The following database records were obtained for `H1-F2-SENSOR` and its associated fan:

| Recorded At | Temperature (°C) | Fan Mode | IsOn | Level |
|---|---:|---|---:|---:|
| 2026-11-05 11:21:22 | 32.0000 | AUTO | 1 | 100 |
| 2026-11-05 11:21:32 | 31.7600 | AUTO | 1 | 100 |
| 2026-11-05 11:21:42 | 31.5300 | AUTO | 1 | 100 |

**Observation:**

- The temperature decreased from 32.00°C to 31.53°C within 20 seconds.
- The fan remained in AUTO mode.
- The fan was ON at 100% output.
- This demonstrates the HOT scenario and automatic fan operation.

**Important:** These records demonstrate the HOT scenario behavior. They do not independently prove that deterministic noise is being applied. Noise verification requires comparing sensor readings generated with the same and different seeds.

## 5. Expected Results

After successful implementation:

1. Sensor readings should contain small variations instead of remaining perfectly constant.
2. The same seed should reproduce the same noise sequence.
3. Changing the seed should change the generated noise sequence.
4. Noise values should remain within the defined metric limits.
5. The simulator should continue publishing sensor readings through MQTT.
6. SQL Server should preserve the decimal variations.

## 6. Current Status

| Requirement | Status |
|---|---|
| Implement seeded PRNG | Implemented |
| Define metric-specific noise limits | Implemented |
| Configure seed through `.env` | Implemented |
| Integrate noise into sensor readings | Implemented in code |
| Increase SQL Server decimal precision | Executed |
| Verify HOT scenario and fan operation | Verified |
| Verify same-seed reproducibility in actual runs | Pending evidence |
| Verify different-seed behavior in actual runs | Pending evidence |
| Verify noise values stored in SQL Server | Pending evidence |
| Run final regression tests after integration | Pending confirmation |

**Overall Status: PARTIAL**

The deterministic noise generator and simulator integration have been implemented. However, additional verification is required to confirm reproducibility, different-seed behavior, and the persistence of noise variations in SQL Server.

## 7. Conclusion

Task 10 introduces deterministic sensor noise to improve the realism of the SwiftletCare Simulator.

A seeded pseudo-random number generator allows the simulator to produce reproducible variations in environmental sensor readings. Different noise limits are defined for temperature, humidity, CO2, and light.

The implementation is integrated into the existing MQTT-based simulation workflow. Further execution and database verification are required before the task can be marked as fully completed.