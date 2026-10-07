# Q&A ngáº¯n cho pháº§n thá»±c nghiá»‡m

**VÃ¬ sao khÃ´ng dÃ¹ng ElGamal mÃ£ hÃ³a trá»±c tiáº¿p toÃ n bá»™ message?**  
ElGamal báº¥t Ä‘á»‘i xá»©ng cháº­m vÃ  lÃ m dá»¯ liá»‡u lá»›n. Dispatch dÃ¹ng hybrid encryption: AES-GCM mÃ£ hÃ³a message, ElGamal chá»‰ wrap khÃ³a AES.

**SHA-256 cÃ³ thay tháº¿ authentication tag cá»§a AES-GCM khÃ´ng?**  
KhÃ´ng. AES-GCM Ä‘Ã£ cÃ³ authentication tag. SHA-256 á»Ÿ Ä‘Ã¢y lÃ  fingerprint/integrity check Ä‘á»™c láº­p theo yÃªu cáº§u bÃ i; SHA thuáº§n khÃ´ng chá»©ng minh ngÆ°á»i gá»­i.

**Server cÃ³ Ä‘á»c Ä‘Æ°á»£c plaintext khÃ´ng?**  
Theo source cá»§a luá»“ng TEXT má»›i, server nháº­n/lÆ°u ciphertext vÃ  field content Ä‘Æ°á»£c Ä‘áº·t NULL. Äá»ƒ chá»©ng minh runtime, cáº§n chá»¥p Network/WebSocket + báº£n ghi DB trÃªn mÃ´i trÆ°á»ng test.

**Táº¡i sao dá»¯ liá»‡u mÃ£ hÃ³a lá»›n hÆ¡n plaintext?**  
Do authentication tag cá»§a GCM, IV, SHA-256 vÃ  Base64/JSON encoding. Overhead tá»· lá»‡ cao nháº¥t vá»›i message ngáº¯n.

**Äiá»ƒm yáº¿u lá»›n nháº¥t hiá»‡n táº¡i lÃ  gÃ¬?**  
Authorization API legacy, hard-coded secrets vÃ  private key ElGamal lÆ°u plaintext trong localStorage. Náº¿u bá»‹ XSS hoáº·c lá»™ secret, háº­u quáº£ cÃ³ thá»ƒ vÆ°á»£t qua lá»£i Ã­ch cá»§a E2EE.

**Náº¿u máº¥t localStorage thÃ¬ sao?**  
CÃ³ nguy cÆ¡ máº¥t private key vÃ  khÃ´ng giáº£i mÃ£ Ä‘Æ°á»£c lá»‹ch sá»­. Cáº§n encrypted backup/recovery hoáº·c multi-device key transfer trong phiÃªn báº£n hoÃ n thiá»‡n.
