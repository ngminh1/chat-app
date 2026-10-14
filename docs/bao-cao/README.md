# Dispatch - tai lieu hoc code 3 thuat toan (main)
> Muc tieu: hieu de trinh bay: thuat toan -> ham thuc thi -> API -> DB/WebSocket -> demo -> test. Comment trong source de tra cuu bang tu khoa `HOC `.

## 1. Danh muc file: doc theo thu tu

| Uu tien | File | Vai tro / dieu can nho |
| --- | --- | --- |
| AES 1 | `frontend/src/utils/crypto.js` | `generateIV` 12 B, `encryptMessage` / `decryptMessage`, tag 16 B; Web Crypto AES-256-GCM |
| AES 2 | `frontend/src/utils/aesKeyManager.js` | `getConversationAESKey`: fetch key qua backend, cache RAM |
| AES 3 | `frontend/src/utils/conversationKeyCache.js` | Cache theo user/conversation, gop request, invalidation logout |
| AES 4 | `frontend/src/App.jsx` | `handleSendMessage`: lay key, encrypt, POST content=null, WebSocket/REST decrypt |
| AES 5 | `frontend/src/utils/messageDecryption.js` | Giai ma history/preview/reply, placeholder neu giai ma that bai |
| AES 6 | `backend/src/main/java/com/chatapp/backend/controller/ChatController.java` | GET AES key, POST message, GET history |
| AES 7 | `backend/src/main/java/com/chatapp/backend/service/ChatService.java` | Membership, quan ly khoa, validate ban ma, luu ciphertext, WebSocket |
| AES 8 | `backend/src/main/java/com/chatapp/backend/dto/SendMessageRequest.java` | Dinh dang payload TEXT: content/ciphertext/iv/version |
| AES 9 | `backend/src/main/java/com/chatapp/backend/entity/Message.java` | TiDB messages: content nullable, ciphertext, iv, version |
| AES 10 | `backend/src/main/java/com/chatapp/backend/entity/Conversation.java` | TiDB conversations: aes_key va wrapped_aes_key (legacy migration) |
| ElGamal 1 | `backend/src/main/java/com/chatapp/backend/security/elgamal/ElGamal.java` | keypair, wrap, unwrap, exponentiation, HKDF-SHA256, AES-GCM key wrapping |
| ElGamal 2 | `backend/src/main/java/com/chatapp/backend/security/elgamal/ElGamalKeyConfig.java` | Doc keys tu env, self-check khi startup |
| ElGamal 3 | `backend/src/main/java/com/chatapp/backend/security/elgamal/ElGamalKeyWrapService.java` | Wrap/unwrap va JSON ket noi ChatService |
| ElGamal 4 | `backend/src/main/java/com/chatapp/backend/service/ChatService.java` | Neu wrapped thi unwrap, kiem tra raw key; neu chua wrap thi migration |
| SHA 1 | `frontend/src/components/ChatArea.jsx` | Hash file bang Web Crypto, upload kem sha256, doi chieu response |
| SHA 2 | `backend/src/main/java/com/chatapp/backend/controller/MediaController.java` | /api/media/upload, kiem tra quyen va nhan SHA |
| SHA 3 | `backend/src/main/java/com/chatapp/backend/security/sha256/SHA256.java` | `hashText/hashBytes/hashStream/verifyText` qua MessageDigest |
| SHA 4 | `backend/src/main/java/com/chatapp/backend/service/FileStorageService.java` | Hash lai bytes server nhan, so sanh, tu choi neu sai |
| SHA 5 | `backend/src/main/java/com/chatapp/backend/service/SupabaseMediaStorage.java` | Luu doc file private qua backend |
| Test AES | `frontend/tests/aes-only.test.mjs` | Round-trip, IV moi, tag, sai IV/sua ciphertext |
| Test AES | `frontend/tests/conversation-key-cache.test.mjs` | Cache theo user va phien |
| Test AES | `frontend/tests/message-decryption.test.mjs` | History va failed-decrypt placeholder |
| Test E2E/H2 | `backend/src/test/java/com/chatapp/backend/service/ChatEncryptionRoundTripTest.java` | test1/test2, ciphertext DB, JSON response, missing historical key |
| Test ElGamal | `backend/src/test/java/com/chatapp/backend/security/elgamal/ElGamalTest.java` | Wrap/unwrap va sai key/context |
| Test ElGamal | `backend/src/test/java/com/chatapp/backend/security/elgamal/ElGamalKeyWrapServiceTest.java` | Tich hop JSON va keyId |
| Test SHA | `backend/src/test/java/com/chatapp/backend/security/sha256/SHA256Test.java` | Vector chuan, dung/sai plaintext |
| Test SHA | `backend/src/test/java/com/chatapp/backend/security/sha256/SHA256StreamTest.java` | Hash stream |
| Test SHA | `backend/src/test/java/com/chatapp/backend/service/FileStorageSha256ValidationTest.java` | Upload dung hash/sai hash, xoa temp, Supabase mock |
| Test media | `backend/src/test/java/com/chatapp/backend/controller/MediaControllerSecurityTest.java` | Phan quyen lay tep |

## 2. Luong AES gui - nhan
1. React `App.jsx#handleSendMessage` lay key theo (userId, conversationId).
2. `crypto.js#encryptMessage`: TextEncoder -> IV moi 12B -> Web Crypto AES-GCM key 256 bit / tag 128 bit -> Base64.
3. POST `/api/chat/messages`: `content=null`, `ciphertext`, `iv`, `encryptionVersion`.
4. `ChatService.sendMessage` kiem tra quyen + dinh dang, luu `messages.content=null`, phat ciphertext qua WebSocket.
5. Ben nhan nhan/GET history, `messageDecryption.js` dung key tu `aesKeyManager` va `crypto.js#decryptMessage` de hien thi.
**Cau hoi:** Neu sua mot bit ciphertext? AES-GCM kiem tra tag that bai, khong render plaintext sai.

## 3. Luong ElGamal (chi ma hoa KHOA)
- Khoa rieng x, khoa cong khai y=g^x mod p; P la nhom 3072 bit tu RFC 3526 group 15.
- Wrap: random r -> c1=g^r, shared=y^r; HKDF-SHA256 -> wrapping key -> AES-GCM boc AES key 32B voi AAD.
- Unwrap: shared=c1^x -> HKDF -> AES-GCM decrypt va kiem tag.
- `ChatService.getOrCreateConversationAesKey`: permission -> unwrap wrapped neu co; neu chi raw key thi migration wrap; neu mat key ma da co history thi bao loi, khong sinh de.
- Limit: `conversations.aes_key` van ton tai; backend biet raw AES key; KHONG trinh bay la E2EE.

## 4. Luong SHA-256 upload
1. Browser hash file bytes -> hex 64 ky tu -> POST multipart + sha256.
2. MediaController kiem tra quyen; FileStorageService gioi han file (toi da 25 MB).
3. `SHA256.hashStream` bam bytes da nhan; so sanh hash; sai -> HTTP 400 va khong luu.
4. Dung -> Supabase Storage private, return URL va hash; frontend doi chieu va gui message FILE/IMAGE.
- SHA-256 khong ma hoa; hash thuan khong xac thuc nguon gui, chi phat hien bytes khong khop theo quy trinh hien co.
- Rieng avatar duoc phuc vu theo luong tương thich (khong yeu cau client gui digest nhu attachment).

## 5. File chieu / thu tu 6-7 phut
1. `crypto.js` encrypt/decrypt (40s).
2. `ElGamal.java` generate/wrap/unwrap (40s).
3. `SHA256.java` hashStream + `FileStorageService.java` verify (40s).
4. `App.jsx` + `ChatService.java` cho thay tich hop (50s).
5. 3 Activity Diagram va 1 Sequence Diagram (60s).
6. Dispatch 2 browser, Network Payload, TiDB yes/no wrap, Supabase (2-3 phut).
7. Benchmark da do: AES time, IV+tag overhead; test results (60s).

## 6. Tranh khang dinh qua muc
- Network Payload chi chung minh client GUI ciphertext; backend do van co raw key.
- Mat raw key hoac doi key ID co the lam history khong giai ma; khong duoc xoa key/deploy secret ngau nhien de demo.
- Anh Supabase hien thi khong tu no chung minh SHA; phai chi code hash/verify hoac test negative.
- Bieu do chua chac la loai giang vien bat buoc: Activity cho noi bo tung thuat toan; Sequence cho tuong tac he thong. Xac nhan lai de bai.

## 7. So do UML
- `uml/01_AES_GCM_Activity.puml`
- `uml/02_ElGamal_Key_Activity.puml`
- `uml/03_SHA256_Upload_Activity.puml`
- `uml/04_Dispatch_Security_Sequence.puml`

Dung PlantUML extension hoac PlantUML online OFFLINE (tranh upload code/secret); export PNG de chieu.
