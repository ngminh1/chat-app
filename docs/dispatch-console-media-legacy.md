# Dispatch: AES lịch sử, media và console

Ngày kiểm tra: 14/10/2026. Nhánh: `fix/dispatch-console-media-legacy`.
Nền: `main` tại `00056a5`, sau khi fetch và fast-forward. Theo yêu cầu của người dùng, kiểm thử chỉ dùng dữ liệu giả lập local.

## Kết quả

| Lỗi | Nguyên nhân | File đã sửa | Cách sửa | Test | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| AES thất bại/log trùng giữa lịch sử, reply và sidebar | Dedupe cũ theo loại hiển thị/id; xử lý envelope thiếu dữ liệu và phiên bản lạ chưa đầy đủ | `App.jsx`, `messageDecryption.js`, `crypto.js` | Dedupe theo user/hội thoại/envelope/loại lỗi; thông báo rõ ràng; giữ ciphertext và IV; log chỉ mã lỗi/id an toàn | AES/decrypt Node tests | Đã sửa logic/UI; chưa kết luận riêng message 1–5 |
| Cache AES không tách người dùng và request đang chờ | Cache chỉ theo conversationId; request đồng thời chưa dùng chung; response cũ có thể hoàn tất sau logout | `aesKeyManager.js`, `conversationKeyCache.js`, `App.jsx` | Cache RAM theo user/hội thoại; dùng chung promise; xác minh conversationId; vô hiệu hóa request phiên cũ | Cache concurrency, login/logout, response sai, retry lỗi tạm thời | Đã sửa; không sinh/thay khóa |
| Mất khóa gốc bị hiển thị như lỗi tạm thời | Backend trả lỗi chung khi không còn raw/wrapped key nhưng vẫn có ciphertext | `ChatService.java`, `MissingConversationKeyException.java`, `ChatController.java`, `messageDecryption.js` | Sau kiểm tra membership, trả HTTP 409 với `CONVERSATION_AES_KEY_MISSING`; UI dùng `[Không thể giải mã tin nhắn cũ]` | HTTP 401/403/409; thiếu khóa với lịch sử thật trong H2; generic 409/500 vẫn là lỗi dịch vụ | Đã phân loại chính xác; không khôi phục khóa |
| Placeholder có thể ghi đè ciphertext khi sửa/chuyển tiếp | UI vẫn cho sửa nội dung không giải mã được; forward dùng so sánh chuỗi placeholder | `App.jsx`, `ChatArea.jsx`, `messageDecryption.js` | Cờ `decryptionFailed`, chặn ở UI và handler trước encrypt/API write; chuỗi plaintext trùng placeholder vẫn hợp lệ nếu giải mã thành công | Guard edit/forward | Đã sửa nguy cơ mất dữ liệu |
| Ảnh 404 thành khung rỗng, lỗi auth/service lẫn nhau | ProtectedMediaImage chỉ log raw Axios error rồi render img không có src | `ProtectedMediaImage.jsx`, `mediaAccess.js`, `MediaGalleryModal.jsx` | Placeholder `Ảnh không còn tồn tại`; 401/403 riêng; 5xx/network retry thủ công; không retry 404 tự động; không log Axios config | 200/404/401/403/500/503, không tự retry | Đã sửa UI; không tái tạo tệp mất |
| Ảnh cũ `/uploads/...` thiếu xác thực | Axios interceptor chung chỉ gắn token cho `/api`, trong khi route cũ vẫn yêu cầu membership | `mediaAccess.js` | Gắn Authorization cho URL media Dispatch đã được xác minh; không gửi token cho URL ngoài | Current/legacy/localhost-legacy/external URL tests | Đã sửa nguyên nhân code |
| Blob URL/request còn sống hoặc lỗi tải tệp bị log kèm cấu hình auth | Thiếu guard sau abort; preview thay thế/unmount chưa thu hồi URL; download catch raw errors | `mediaAccess.js`, `ProtectedMediaImage.jsx`, `ProtectedMediaDownload.jsx`, `ChatArea.jsx`, `MediaGalleryModal.jsx`, `App.jsx` | Abort khi unmount/source đổi; chặn late completion; revoke Blob; tải tệp có trạng thái lỗi rõ và một request đang chạy; log metadata an toàn | Abort + late success/error, revoke, download cleanup/auth/error classification | Đã sửa |
| AudioContext autoplay warning | Callback tin đến/tin gửi tạo hoặc resume AudioContext trước tương tác | `soundEffects.js`, `App.jsx` | Chỉ unlock trong trusted user gesture; không xếp hàng âm thanh cũ; catch/sanitize/dedupe lỗi resume; cleanup listeners | 9 audio tests | Đã sửa code; chưa kiểm thử mọi browser autoplay policy |
| `unload is not allowed` | `sockjs-client@1.6.1/lib/utils/event.js` đăng ký unload ngay lúc import | Không sửa dependency/header | Giữ cơ chế WebSocket/SockJS hiện tại | Đọc source dependency | Còn warning của dependency |
| `join-ad-interest-group`, `private-aggregation`, `attribution-reporting` | Không tìm thấy trong source/config hiện tại; HEAD frontend/backend health không có Permissions-Policy | Không sửa header/hosting | Ghi nhận chưa đủ bằng chứng nguồn frame/browser/header | Tìm kiếm source và HEAD chỉ đọc | Chưa xác định nguồn cụ thể; không quy kết hosting |

## Truy vết mã hóa

1. Frontend lấy AES-256 key từ endpoint hội thoại được xác thực. API trả `conversationId` và raw key Base64; cache chỉ nằm trong RAM. Message và `AesKeyResponse` hiện không có AES `keyId`.
2. `crypto.js` dùng Web Crypto AES-GCM, IV ngẫu nhiên 12 byte, tag 128 bit. `ciphertext` Base64 chứa ciphertext nối với authentication tag 16 byte; tag không có cột riêng. Việc ghi rõ `tagLength: 128` giữ nguyên mặc định trước đây.
3. Send/edit gửi `ciphertext`, `iv`, `encryptionVersion: AES-256-GCM`. `ChatService` kiểm tra version, Base64, độ dài IV/tag; lưu `content = null`. Backend không giải mã nội dung. Entity `Message` lưu nguyên các trường này; schema không đổi.
4. REST/WebSocket, reply và sidebar truyền lại envelope. Client lấy key đúng hội thoại, xác thực/decrypt trước khi render. Fallback không làm thay đổi payload đã lưu và không có API ghi lại lịch sử.
5. `Conversation` lưu AES key và/hoặc bản bọc ElGamal. `keyId` hiện chỉ thuộc bản bọc ElGamal, được so sánh với server key ID; unwrap ràng buộc conversationId. Raw/wrapped key không khớp hoặc bản bọc hỏng vẫn fail closed. Không thêm fallback sang khóa khác.
6. Nếu không có raw/wrapped key nhưng còn lịch sử mã hóa, điều kiện chặn tạo khóa đã có trên main được giữ nguyên; chỉ đổi lỗi chung thành lỗi có mã cụ thể. Hội thoại mới chưa có lịch sử vẫn giữ hành vi khởi tạo cũ.

## Tin 1–5 và các ảnh cũ

Lịch sử Git cung cấp một cơ chế hợp lý cho lỗi khóa lịch sử:

- `9b17d9e`: frontend sinh khóa theo browser và lưu ở `dispatch_phase_aes_key_${conversationId}` trong localStorage.
- `39ba5df`: chuyển sang endpoint AES key theo conversation ở server.
- `README_AES_ONLY.md` đã ghi rõ ciphertext dùng khóa localStorage cũ không giải mã được bằng khóa server mới.

Đây là bằng chứng về quá trình chuyển cơ chế khóa, **không phải xác nhận message 1–5 dùng khóa nào**. GCM authentication failure có thể do key khác, IV/ciphertext/tag bị đổi; chỉ exception `OperationError` không phân biệt được các nguyên nhân đó. Không truy cập dữ liệu TiDB production hay localStorage của người dùng để thử khóa. Nếu khóa gốc không còn, không có cách khôi phục plaintext từ ciphertext bằng bản sửa này. Khóa gốc có thể còn ở browser/origin cũ hoặc backup; không thử thay khóa hàng loạt.

Việc ảnh lúc 17:18/17:37 mất sau migration là thông tin do người dùng cung cấp; chưa đối chiếu storage production. Main hiện đã phân biệt Supabase NoSuchKey/404 với lỗi upstream và hỗ trợ fallback local khi thật sự 404. Bản sửa giữ HTTP 404 và mọi record/tin nhắn; chỉ khắc phục UI, auth route cũ và vòng đời request. HTTP 404 vẫn xuất hiện trong Network. Remount/source mới có thể kiểm tra server lại một lần; không có vòng retry tự động hoặc cache 404 toàn cục che thay đổi quyền.

## Kiểm thử và giới hạn

- `frontend`: `npm test` — **48 passed, 0 failed, 0 skipped**: 16 AES/cache/decrypt, 23 media, 9 audio.
- `frontend`: `npm run build` — thành công.
- `backend`: `.\mvnw.cmd -B -ntp compile test` — **80 passed, 0 failed, 0 errors, 0 skipped**.
- Tổng: **128 passed / 0 failed**.
- Bộ test Spring dùng H2 trong bộ nhớ, dependency chỉ ở test scope, không dùng datasource TiDB mặc định. `BackendApplicationTests` chỉ định application class để không nhầm configuration của WebSocket test. CI chạy toàn bộ backend tests/package và frontend tests/build, không nhận production secrets.
- `ChatEncryptionRoundTripTest` tạo hai tài khoản giả lập `test1`/`test2`, kiểm tra hai chiều AES-GCM qua service → database → controller DTO → JSON → decrypt. Kiểm tra raw ciphertext/IV/version không đổi, content không được lưu plaintext, lịch sử dùng key khác không bị sửa, và thiếu key không tạo replacement.
- HTTP media regression kiểm tra 401/403 trước truy cập storage; 404/500/503 giữ status và không sửa/xóa record. Các test SHA-256/ElGamal/Supabase hiện hữu vẫn chạy.
- Kiểm tra trình duyệt local với component React thật và Axios adapter giả lập: 404 đúng placeholder; 401/403 riêng; 500 có retry; 503 retry thủ công rồi ảnh giải mã/hiển thị thành công; re-render không tăng request; đổi src/unmount thu hồi URL; late response không tạo Blob. Download 404/401/403 dừng đúng trạng thái, 500 cho retry. Download thành công được chặn sự kiện click trong fixture để không ghi tệp. Sau cleanup có 4 Blob được tạo/4 được revoke; console của fixture không có warn/error. Fixture chỉ dùng loopback/CSP self, không gọi backend production; đã dọn fixture/server sau kiểm tra.
- Scoped ESLint: 0 errors; App còn 4 cảnh báo exhaustive-deps tại các effect đã có. Lint rộng hơn trên ChatArea/MediaGallery vẫn gặp pattern set-state-in-effect đã tồn tại trước bản sửa; không coi đó là lint toàn dự án đã sạch.
- Không có E2E với hai tài khoản production, TiDB hay Supabase thật; H2/mock storage không chứng minh tình trạng tài nguyên production. Chỉ kết luận luồng tin/ảnh mới vẫn đạt regression local.

## Rủi ro và ranh giới thay đổi

Không sửa schema, thuật toán/kiến trúc mã hóa, upload SHA-256, security headers, cấu hình Render/Vercel/Supabase; không xóa dữ liệu hoặc reset AES/ElGamal. Không merge/deploy. Các error handler liên quan chỉ log mã lỗi/id/status; không monkey-patch console hoặc lọc lỗi toàn cục.

Mã hiện tại cho phép backend biết/trả AES key nên **chưa phải E2EE thực sự**, như chính comment trong code và README đã nêu; ElGamal bọc key phía server không thay đổi điều đó. PR này giữ kiến trúc hiện có. Rủi ro còn lại là khác biệt browser autoplay, cơ chế auth thật, TiDB/Supabase và dữ liệu lịch sử chưa được kiểm chứng bằng môi trường production.

Nguồn warning: [SockJS 1.6.1](https://github.com/sockjs/sockjs-client/blob/v1.6.1/lib/utils/event.js), [Chrome Web Audio autoplay](https://developer.chrome.com/blog/web-audio-autoplay), [Chrome unload deprecation](https://developer.chrome.com/docs/web-platform/deprecating-unload), [Permissions Policy](https://developer.chrome.com/docs/privacy-security/permissions-policy).
