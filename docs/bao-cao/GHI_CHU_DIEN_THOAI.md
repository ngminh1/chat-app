# DISPATCH - NHỚ FILE NÀO LÀM GÌ
**Đọc trên điện thoại khi chiếu code.** Mỗi file chỉ nhớ 1 nhiệm vụ, không cần đọc thuộc code.

## 1. AES - khi GỬI và NHẬN một tin TEXT

**Một câu để nói:** "Người gửi mã hóa ngay trong trình duyệt. Backend nhận và lưu bản mã. Người nhận lấy bản mã rồi giải mã trong trình duyệt."

**Các file theo đường đi của một tin nhắn:**

1. `frontend/src/components/ChatArea.jsx` - **Ô nhập tin**; gọi `onSendMessage` khi nhấn Gửi. Phần SHA của file này dùng cho đính kèm, không phải TEXT.
2. `frontend/src/App.jsx` - **Điều phối gửi tin**, hàm `handleSendMessage`: lấy khóa AES, gọi hàm mã hóa, gửi API. Với TEXT mới nó đặt `content = null`.
3. `frontend/src/utils/aesKeyManager.js` - **Hỏi khóa AES** của hội thoại từ backend qua API. Mục đích: cả hai thành viên dùng đúng khóa để đọc chung một hội thoại.
4. `frontend/src/utils/conversationKeyCache.js` - **Nhớ khóa tạm thời trong RAM** theo người dùng + hội thoại, tránh gọi backend liên tục; xóa khi đổi phiên.
5. `backend/src/main/java/com/chatapp/backend/controller/ChatController.java` - **Cửa tiếp nhận API**: nhận yêu cầu lấy khóa và POST gửi tin; kiểm tra quyền trước khi giao cho service.
6. `backend/src/main/java/com/chatapp/backend/service/ChatService.java` - **Xử lý nghiệp vụ**: kiểm tra thành viên, lấy/khôi phục khóa (liên quan ElGamal); lưu ciphertext và phát WebSocket.
7. `frontend/src/utils/crypto.js` - **Thực sự mã hóa/giải mã AES-256-GCM**: `encryptMessage()` sinh IV 12 byte, trả `ciphertext` + `iv`; `decryptMessage()` kiểm tra tag rồi trả chữ đọc được. Code gọi Web Crypto API.
8. `backend/src/main/java/com/chatapp/backend/dto/SendMessageRequest.java` - **Hình dạng dữ liệu gửi**: `conversationId`, `ciphertext`, `iv`, `encryptionVersion`, `content`.
9. `backend/src/main/java/com/chatapp/backend/entity/Message.java` - **Dạng bảng trong TiDB**: lưu ciphertext, IV, phiên bản; TEXT mã hóa mới có content NULL.
10. `frontend/src/utils/messageDecryption.js` - **Điều phối lúc nhận/lấy lịch sử**: kiểm tra kiểu tin, lấy đúng khóa, gọi `crypto.js#decryptMessage()`, hoặc hiện thông báo nếu giải mã thất bại.

**Đường đi để chỉ trên màn hình:**
`ChatArea` → `App.handleSendMessage` → `aesKeyManager` → `ChatController / ChatService` (lấy khóa) → `crypto.encryptMessage` → `ChatController / ChatService` (lưu và WebSocket) → `messageDecryption` → `crypto.decryptMessage`.

**Nhấn mạnh khi mở Network:** `content: null`, `ciphertext: Base64`, `iv: Base64`, `encryptionVersion: AES-256-GCM`. Base64 chỉ là cách biểu diễn bản mã, không phải một thuật toán mã hóa.

## 2. ElGamal - bảo vệ KHÓA AES, không mã hóa từng TEXT

**Một câu để nói:** "AES mã hóa tin. ElGamal giúp backend bọc khóa AES trước khi lưu và mở lại khi cần. Đây là cơ chế bảo vệ khóa phía server."

1. `backend/.../security/elgamal/ElGamal.java` - **Phần toán học cốt lõi**: `generateKeyPair` sinh cặp khóa; `wrapKey` tạo bí mật chung và dùng HKDF-SHA256 + AES-GCM để bọc khóa AES; `unwrapKey` mở bản bọc.
2. `backend/.../security/elgamal/ElGamalKeyConfig.java` - **Nạp cặp khóa server** từ cấu hình/biến môi trường khi chạy backend.
3. `backend/.../security/elgamal/ElGamalKeyWrapService.java` - **Bộ chuyển tiếp**: nhận khóa AES dạng Base64, gọi `ElGamal.wrapKey/unwrapKey`, đóng/mở JSON để lưu trong DB.
4. `backend/.../service/ChatService.java` - **Quyết định dùng khóa nào**: kiểm tra quyền → ưu tiên mở `wrapped_aes_key` → nếu cần mới dùng khóa AES cũ → bọc bổ sung; nếu mất khóa mà có lịch sử thì không tự tạo thay thế.
5. `backend/.../entity/Conversation.java` - **Bảng TiDB conversations** có `aes_key` (khóa thô dạng Base64 còn giữ vì tương thích dữ liệu cũ) và `wrapped_aes_key` (bản bọc ElGamal).

**Đường đi:** `aesKeyManager.js` → `ChatController` → `ChatService` → `ElGamalKeyWrapService` → `ElGamal.java` → `Conversation.java (TiDB)` → trả khóa hợp lệ về trình duyệt.

**Quan trọng:** Backend hiện vẫn truy cập được khóa AES thô, vì vậy **không phải E2EE**. HKDF-SHA256 nằm *bên trong cơ chế bọc khóa*; khác với chức năng SHA-256 kiểm tra tệp bên dưới.

## 3. SHA-256 - kiểm tra FILE nhận được có bị thay đổi không

**Một câu để nói:** "Trình duyệt băm tệp trước khi gửi. Backend băm lại chính tệp nhận được. Nếu hai kết quả khác nhau thì không lưu tệp."

1. `frontend/src/components/ChatArea.jsx` - **Chỗ người dùng chọn tệp**. Dùng `crypto.subtle.digest('SHA-256', fileBytes)`, đổi ra 64 ký tự hex, gửi cùng tệp đến API `/media/upload`.
2. `backend/src/main/java/com/chatapp/backend/controller/MediaController.java` - **Cửa tiếp nhận file upload**: kiểm tra quyền hội thoại rồi gọi service với tệp + hash.
3. `backend/src/main/java/com/chatapp/backend/service/FileStorageService.java` - **Nơi so sánh**: lưu tệp tạm, gọi hàm tính hash, so kết quả; khác hash → HTTP 400 và không upload Supabase.
4. `backend/src/main/java/com/chatapp/backend/security/sha256/SHA256.java` - **Hàm băm trên server**: `hashBytes()`, `hashStream()`, `hashText()`. Tạo digest 32 byte (64 ký tự hex), không phải mã hóa.
5. `backend/src/main/java/com/chatapp/backend/service/SupabaseMediaStorage.java` - **Kho tệp thật**: chỉ nhận tệp đã qua bước đối chiếu hash; lưu trong bucket private.
6. `frontend/src/App.jsx` - **Gửi tin IMAGE/FILE** kèm URL tệp sau khi upload thành công; khác với luồng TEXT AES-GCM.

**Đường đi:** `ChatArea (hash tệp)` → `MediaController` → `FileStorageService` → `SHA256.hashStream` → nếu khớp thì `SupabaseMediaStorage` → `ChatArea / App` gửi tin ảnh/tệp.

**Chú ý:** SHA-256 chỉ đối chiếu tính toàn vẹn của tệp nhận được, **không mã hóa file**, không phải bằng chứng người gửi đáng tin nếu kẻ tấn công có thể thay cả tệp lẫn hash. Ảnh đã lưu trên Supabase chưa đủ chứng minh SHA; phải chỉ code hoặc test sai hash.

## 4. Câu nối 3 thuật toán khi thuyết trình

- **AES:** "Ai biến chữ thành bản mã?" → `crypto.js`, gọi từ `App.jsx`.
- **ElGamal:** "Khóa AES được backend lấy và bảo vệ thế nào?" → `ChatService` + `ElGamalKeyWrapService` + `ElGamal.java`.
- **SHA:** "Ai kiểm tra file không bị đổi?" → `ChatArea` + `FileStorageService` + `SHA256.java`.

**Khi chiếu màn hình, chỉ cần mở 6 file theo thứ tự:**
`App.jsx` → `crypto.js` → `ChatService.java` → `ElGamal.java` → `ChatArea.jsx` → `FileStorageService.java`. Các file khác mở khi cần giải thích chi tiết.

**Không sửa dữ liệu TiDB, không hiển thị AES key/JWT/private key khi demo.**
