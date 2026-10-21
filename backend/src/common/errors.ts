export const DB_HEALTH = 'DB_HEALTH';
export interface DbHealth {
  reportFailure(err: unknown): void;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly sqlNumber: number | null = null,
    readonly details: unknown = null,
  ) {
    super(code);
  }
}

// Cau thong bao co dinh theo code (spec backend 5.5): khong bao gio chua loi SQL, duong dan, stack.
export const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Dữ liệu gửi lên không hợp lệ.',
  UNAUTHENTICATED:
    'Chưa đăng nhập, phiên đã hết hạn hoặc thông tin đăng nhập không đúng.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
  CANNOT_MODIFY_SELF: 'Không thể tự khóa hoặc tự hạ vai trò của chính mình.',
  LAST_ADMIN: 'Phải còn ít nhất một quản trị viên đang hoạt động.',
  PAYLOAD_TOO_LARGE: 'Dữ liệu gửi lên vượt kích thước cho phép.',
  UNSUPPORTED_MEDIA_TYPE:
    'Định dạng tệp không được hỗ trợ (chỉ nhận ảnh JPEG).',
  INTERNAL: 'Lỗi hệ thống. Vui lòng thử lại hoặc báo quản trị viên.',
  RETRY_LATER: 'Hệ thống đang bận hoặc chưa sẵn sàng, vui lòng thử lại sau.',
  DEVICE_NOT_CONTROLLABLE:
    'Thiết bị không điều khiển được (đã ngừng dùng hoặc không phải cơ cấu chấp hành).',
  CAMERA_NOT_FOUND: 'Không tìm thấy camera đang hoạt động với mã này.',
  ALERT_NOT_FOUND: 'Không tìm thấy cảnh báo.',
  ALERT_INVALID_TRANSITION: 'Không thể chuyển cảnh báo sang trạng thái này.',
  INVALID_JSON: 'Dữ liệu JSON không hợp lệ.',
  INVALID_PARAMETER: 'Tham số không hợp lệ.',
  CONSTRAINT_VIOLATION:
    'Dữ liệu vi phạm ràng buộc (ví dụ ngưỡng dưới phải nhỏ hơn ngưỡng trên).',
  DUPLICATE: 'Dữ liệu bị trùng với bản ghi đã có.',
};
