# Dispatch - AES-256-GCM only patch

Phạm vi của patch này:

- Chỉ AES-256-GCM.
- Không ElGamal.
- Không SHA.
- Không public/private key.
- TEXT message được encrypt/decrypt ở frontend bằng Web Crypto API.
- IMAGE/FILE giữ cơ chế hiện tại.

## Luồng

A nhập plaintext
-> frontend lấy AES key theo conversationId
-> AES-256-GCM encrypt với IV random 12 byte
-> gửi ciphertext + iv + encryptionVersion
-> backend lưu ciphertext/iv, content = null
-> REST/WebSocket trả ciphertext/iv
-> frontend decrypt
-> UI chỉ nhận plaintext sau decrypt

## Cơ chế AES key trong phase này

Để A và B ở hai browser khác nhau có thể test AES ngay khi chưa học key exchange,
backend lưu một raw AES key Base64 theo mỗi conversation và chỉ trả key cho thành viên
của conversation qua endpoint:

GET /api/chat/conversations/{conversationId}/aes-key?userId=...

Đây là DEV DEMO. Backend biết key nên CHƯA PHẢI E2EE.
Sau này có thể thay aesKeyManager bằng cơ chế key exchange mà không phải viết lại
AES encrypt/decrypt.

## File cần copy vào project

Frontend:

- frontend/src/App.jsx
- frontend/src/components/ChatArea.jsx
- frontend/src/utils/crypto.js
- frontend/src/utils/aesKeyManager.js

Backend:

- backend/src/main/java/com/chatapp/backend/entity/Conversation.java
- backend/src/main/java/com/chatapp/backend/entity/Message.java
- backend/src/main/java/com/chatapp/backend/dto/AesKeyResponse.java
- backend/src/main/java/com/chatapp/backend/dto/SendMessageRequest.java
- backend/src/main/java/com/chatapp/backend/dto/EditMessageRequest.java
- backend/src/main/java/com/chatapp/backend/dto/MessageResponse.java
- backend/src/main/java/com/chatapp/backend/dto/ReplyPreviewResponse.java
- backend/src/main/java/com/chatapp/backend/dto/ConversationResponse.java
- backend/src/main/java/com/chatapp/backend/controller/ChatController.java
- backend/src/main/java/com/chatapp/backend/service/ChatService.java

## Database

Project đang dùng spring.jpa.hibernate.ddl-auto=update nên Hibernate sẽ thêm:

conversations:
- aes_key

messages:
- ciphertext
- iv
- encryption_version

Message TEXT mới:
- content = NULL
- ciphertext = Base64
- iv = Base64
- encryption_version = AES-256-GCM

Message cũ plaintext vẫn đọc được.

## Cảnh báo về dữ liệu test AES cũ

Nếu trước đó bạn đã tạo message mã hóa bằng một AES key khác (ví dụ bản Agent lưu key
trong localStorage), ciphertext cũ KHÔNG thể decrypt bằng key mới trong patch này.
Không xóa dữ liệu thật. Với dữ liệu test, nên backup DB trước rồi xóa các row AES test cũ
hoặc dùng một conversation test mới.

## Chạy

Backend:

cd backend
.\\mvnw.cmd spring-boot:run

Frontend:

cd frontend
npm run dev

## Test bắt buộc

1. A gửi `hello`.
2. UI A vẫn hiện `hello`.
3. DB row mới phải có content = NULL và ciphertext/iv có giá trị.
4. Reload A: vẫn hiện `hello`.
5. B ở browser/profile khác mở cùng conversation: phải hiện `hello`.
6. A gửi `hello` lần nữa: ciphertext và IV phải khác message trước.
7. Edit message: ciphertext và IV mới phải thay đổi.
8. Reply preview phải đọc được plaintext.
9. Search TEXT hoạt động client-side trên dữ liệu đã decrypt.

## Kiểm tra đã thực hiện khi tạo patch

- Các file JS/JSX đã được parse bằng TypeScript parser: không có lỗi cú pháp.
- Java đã được javac parse tới bước resolve dependency; môi trường tạo patch không có
  Spring/Lombok dependencies nên không thể chạy Maven build đầy đủ tại đây.
