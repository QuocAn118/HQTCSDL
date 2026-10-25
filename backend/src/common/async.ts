export const RETRY_DELAYS_MS = [1000, 2000, 5000, 10000, 30000];
export const retryDelay = (attempt: number): number =>
  RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
export const sleep = (ms: number): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let t: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
    }),
  ]);
}
