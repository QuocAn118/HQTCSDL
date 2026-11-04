// Ma loi hop dong -> cau tieng Viet (spec web 2.2). Khong bao gio hien message tho cua server.
export const MESSAGES: Record<string, string> = {
  ALERT_INVALID_TRANSITION: 'Cảnh báo đã đổi trạng thái. Đã tải lại danh sách.',
  DEVICE_NOT_CONTROLLABLE: 'Thiết bị đã ngừng dùng, không điều khiển được.',
  CONSTRAINT_VIOLATION: 'Ngưỡng không hợp lệ (Min phải nhỏ hơn Max).',
  DUPLICATE: 'Trùng tên hoặc trùng mã.',
  VALIDATION_ERROR: 'Dữ liệu nhập chưa đúng, kiểm tra các trường được đánh dấu.',
  INVALID_PARAMETER: 'Khoảng thời gian không hợp lệ: "Từ" phải trước "Đến"; khoảng quá dài thì gom theo nhiều phút hơn.',
  NOT_FOUND: 'Không tìm thấy.',
  RETRY_LATER: 'Hệ thống bận, vui lòng thử lại.',
  UNAUTHENTICATED: 'Sai tên đăng nhập hoặc mật khẩu.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NETWORK: 'Không kết nối được máy chủ.',
};
export const GENERIC_MESSAGE = 'Đã có lỗi, vui lòng thử lại.';

export function messageFor(code: string | null | undefined): string {
  return code && Object.hasOwn(MESSAGES, code) ? MESSAGES[code] : GENERIC_MESSAGE;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details: unknown) {
    super(code);
  }

  get fields(): string[] {
    const d = this.details as { fields?: unknown } | null;
    return Array.isArray(d?.fields) ? d.fields.filter((f): f is string => typeof f === 'string') : [];
  }
}

// Doc than loi dang {"error":{code,message,sqlNumber,details}} (hop dong 3.4).
export function toApiError(status: number, body: unknown): ApiError {
  const err = (body as { error?: { code?: unknown; details?: unknown } } | null)?.error;
  const code = typeof err?.code === 'string' ? err.code : `HTTP_${status}`;
  return new ApiError(status, code, err?.details ?? null);
}
