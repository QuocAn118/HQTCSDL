# SwiftletCare Mobile - TV4 E2E Results

## 1. Automated verification

- Unit tests: PASS (71/71, 19/11/2026 them test/snapshot.test.ts)
- Test suites: PASS (7/7)
- Shared copies with web: PASS (8/8)
- TypeScript typecheck: PASS
- Android Expo export: PASS

## 2. Functional verification

Kiem 19/11/2026 tren dien thoai Android that, Expo Go, backend demo (SwiftletCare_Dev, backend chay bang app_backend), cung mang hotspot.

- Login: PASS
- Session persistence: PASS (tat han Expo Go, mo lai van dang nhap)
- Dashboard realtime: PASS (demo/hot-now.ps1: F2 TEMP 31.5 roi 27.5, quat F2 tu bat/tat)
- Alert banner: PASS (canh bao nguong va canh bao thien dich)
- Alert ACK/RESOLVED: PASS
- Device control: PASS (doi trang thai, co trong nhat ky)
- Socket reconnection: PASS (che do may bay ~20 giay roi tat)
- Snapshot image: PASS sau khi sua (demo/predator-now.ps1). Lan dau FAIL: Android <Image> bo qua source.headers nen backend tra 401; sua bang fetchSnapshot (fetch kem Bearer, dua data URI cho Image).

## 3. Environment

- Expo SDK: 58
- Expo Router: 58
- socket.io-client: 4.8.3
- Vitest: 5.0.5

## 4. Conclusion

Automated va functional verification deu PASS tren Android Expo Go.
Chua kiem tren iOS.
