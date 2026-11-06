
const LIMITS = {
  TEMP: 0.05,
  HUMID: 0.2,
  CO2: 5,
  LIGHT: 0.05
};

// Bộ tạo số ngẫu nhiên có thể tái lập bằng seed.
export function createNoise(seed) {
  let state = seed >>> 0;

  return function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Giữ tên cũ để tương thích với các file đang sử dụng.
export const createRandom = createNoise;

// Tạo giá trị nhiễu theo từng loại cảm biến.
export function makeNoise(seed) {
  if (seed === null || seed === undefined) {
    return () => 0;
  }

  if (!Number.isInteger(seed) || seed < 0) {
    throw new Error('Seed must be a non-negative integer');
  }

  const random = createNoise(seed);

  return function (metric) {
    const limit = LIMITS[metric];

    if (limit === undefined) {
      throw new Error(`Unsupported metric: ${metric}`);
    }

    return (random() * 2 - 1) * limit;
  };
}
