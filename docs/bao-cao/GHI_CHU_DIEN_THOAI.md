# DISPATCH - PHIEU NHO DIEN THOAI
**Mo 5s - nhin keyword - noi 20s. Khong doc nguyen source.**

## AES (crypto.js, App.jsx)
- Key 256 bit; IV NGau nhien 12 byte; GCM tag 16 byte.
- encryptMessage: UTF-8 -> encrypt -> Base64(ciphertext+tag), iv.
- handleSendMessage: lay key -> encrypt -> POST content=null.
- decryptMessage: Base64 -> AES-GCM verify tag -> plaintext.
- Sai IV/key/tag: OperationError; khong reset key/huy ciphertext.

## ElGamal (ElGamal.java, ChatService.java)
- Keypair: private x; public y=g^x mod p (3072 bit).
- Wrap: r, c1=g^r, shared=y^r -> HKDF-SHA256 -> AES-GCM boc AES key.
- Unwrap: shared=c1^x -> HKDF -> AES-GCM decrypt.
- Server dang giu raw key de migration: CHUA PHAI E2EE.
- Key mismatch/da co history: bao loi, KHONG tao key moi.

## SHA-256 (ChatArea.jsx, SHA256.java, FileStorageService.java)
- Browser bam FILE bytes, gui digest 64 hex.
- Backend SHA256.hashStream bam lai bytes nhan duoc.
- Khop: luu Supabase; khac: HTTP 400, khong upload.
- Hash khong giai ma va khong ma hoa; digest = 32 byte.

## DEMO (chi 4 man)
1. 2 tab Dispatch: gui/nhan, reload van doc duoc.
2. Network POST messages: content=null / ciphertext / iv / version.
3. TiDB: messages co ciphertext; conversations co wrapped key (chi YES/NO).
4. Supabase: file moi da luu, gan voi hash validation.

## THUC NGHIEM + HOI DAP
- AES-GCM overhead nhi phan: +16B tag +12B IV, chua tinh Base64/JSON.
- Test: AES round-trip, tag sai, IV sai; ElGamal wrong key/context; SHA sai hash HTTP400.
- Uu: realtime, luu ciphertext, toan ven tep. Gioi han: backend biet key, secrets va nang luc hosting.
- Khong tu nhan E2EE. End-to-end TEST va end-to-end ENCRYPTION la hai viec khac nhau.

**Cau chot:** AES bao ve noi dung; ElGamal bao ve khoa; SHA-256 kiem tra toan ven tep. Bieu do -> code -> Network/DB -> test.
