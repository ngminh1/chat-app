# Dispatch - AES-256-GCM + ElGamal key wrapping

## Kiến trúc

- Nội dung message vẫn được mã hóa bằng AES-256-GCM ở frontend.
- ElGamal **không mã hóa message trực tiếp**. ElGamal chỉ mã hóa (wrap) AES conversation key.
- Mỗi user có một ElGamal key pair:
  - public key `y`: lưu ở bảng `users`.
  - private key `x`: chỉ lưu tại browser của user (`localStorage` trong bản demo này).
- Mỗi `conversation_members` lưu `encrypted_aes_key_c1`, `encrypted_aes_key_c2` dành riêng cho user đó.

## Migration conversation cũ

1. Client thử lấy wrapped key của chính user.
2. Nếu chưa có, client gọi endpoint raw AES key cũ.
3. Client lấy public key của các thành viên đã khởi tạo ElGamal.
4. Client wrap cùng AES key cho từng thành viên và upload các cặp `c1/c2`.
5. Backend xóa `conversations.aes_key` khi tất cả member đã có wrapped key.
6. Sau khi conversation đã migrate, backend không được sinh raw AES key mới.

Cơ chế này giữ được lịch sử AES cũ trong quá trình chuyển đổi và tránh trường hợp sinh key mới làm mất khả năng giải mã ciphertext cũ.

## File chính

Frontend:
- `frontend/src/utils/elgamal.js`
- `frontend/src/utils/aesKeyManager.js`
- `frontend/src/utils/crypto.js` (giữ AES-GCM hiện tại)

Backend:
- `User.java`: public key ElGamal.
- `ConversationMember.java`: wrapped AES key theo user.
- `ChatService.java`: migration/wrapped-key flow.
- `ChatController.java`: wrapped-key API.
- `UserController.java`: public-key API.

## Giới hạn hiện tại

- Private ElGamal key được lưu trong `localStorage` để phục vụ đồ án/demo. Nếu xóa dữ liệu browser hoặc đăng nhập cùng tài khoản ở máy khác mà không có private key cũ, client sẽ không giải mã được lịch sử đã wrap bằng public key cũ. Backend cố tình từ chối tự động ghi đè public key khác để tránh mất dữ liệu âm thầm.
- Chưa có key rotation/history khi xóa thành viên khỏi group. Thành viên đã bị xóa từng biết AES key cũ; muốn có forward secrecy/revocation đầy đủ cần key-version history và rotate AES key khi membership thay đổi.
- Các endpoint hiện vẫn kế thừa mô hình authorization hiện có của Dispatch. ElGamal không thay thế JWT/authorization.
