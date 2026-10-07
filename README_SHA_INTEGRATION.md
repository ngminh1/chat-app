# Dispatch – SHA-256 integration

## Mục tiêu

SHA-256 được tích hợp như một fingerprint độc lập cho **encrypted payload** của tin nhắn TEXT:

```text
plaintext
  -> AES-256-GCM
  -> ciphertext + IV
  -> SHA-256(encryptionVersion + "\n" + IV + "\n" + ciphertext)
```

Không hash plaintext để tránh làm server nhận một fingerprint trực tiếp của nội dung gốc.

## Luồng gửi

1. Frontend mã hóa plaintext bằng AES-256-GCM.
2. Frontend tính SHA-256 trên `encryptionVersion`, `iv`, `ciphertext`.
3. Backend tính lại SHA-256 và từ chối request nếu hash không khớp.
4. Backend lưu `ciphertext`, `iv`, `encryption_version`, `sha256`.

## Luồng nhận

1. Frontend nhận encrypted payload + `sha256`.
2. Frontend tính lại SHA-256 trước khi giải mã.
3. Nếu hash sai, frontend không giải mã và báo payload có thể đã bị thay đổi.
4. Nếu hash đúng, AES-GCM tiếp tục xác thực tag và giải mã.

## Tương thích ngược

Tin nhắn cũ chưa có `sha256` vẫn được giải mã. Tin nhắn TEXT mã hóa mới bắt buộc phải gửi SHA-256 hợp lệ.

## Lưu ý bảo mật

AES-GCM đã có authentication tag nên SHA-256 không thay thế hay làm mạnh hơn cơ chế xác thực của GCM. SHA-256 ở đây là lớp kiểm tra integrity/fingerprint độc lập phục vụ yêu cầu ATTT và phát hiện thay đổi dữ liệu. SHA-256 thuần không chống được server độc hại có khả năng sửa cả ciphertext lẫn hash; muốn chống giả mạo cần MAC/chữ ký số hoặc AEAD như AES-GCM.
