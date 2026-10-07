# ÄÃ¡nh giÃ¡ má»©c Ä‘á»™ an toÃ n vÃ  kháº£ nÄƒng triá»ƒn khai

## Äiá»ƒm Ä‘Ã£ Ä‘áº¡t

- AES-256-GCM mÃ£ hÃ³a ná»™i dung á»Ÿ client.
- ElGamal wrap AES conversation key theo tá»«ng user.
- SHA-256 kiá»ƒm tra fingerprint/integrity cá»§a encrypted payload; AES-GCM authentication tag váº«n lÃ  cÆ¡ cháº¿ xÃ¡c thá»±c ciphertext chÃ­nh.
- Backend model cÃ³ ciphertext/IV/SHA; TEXT mÃ£ hÃ³a khÃ´ng lÆ°u plaintext theo source hiá»‡n táº¡i.

## Rá»§i ro cÃ²n láº¡i

| Severity | Finding | Consequence | Recommendation |
| --- | --- | --- | --- |
| CRITICAL | DB password cÃ³ váº» hard-code trong application.properties | Náº¿u repository/file bá»‹ lá»™, database cÃ³ thá»ƒ bá»‹ truy cáº­p trÃ¡i phÃ©p. | Rotate credential vÃ  chuyá»ƒn sang biáº¿n mÃ´i trÆ°á»ng. KhÃ´ng commit secret tháº­t. |
| CRITICAL | JWT secret cÃ³ váº» hard-code trong application.properties | Náº¿u secret bá»‹ lá»™, káº» táº¥n cÃ´ng cÃ³ thá»ƒ tá»± kÃ½ JWT giáº£. | Rotate JWT secret vÃ  chuyá»ƒn sang biáº¿n mÃ´i trÆ°á»ng. |
| HIGH | Nhiá»u API legacy váº«n permitAll | CÃ³ thá»ƒ giáº£ senderId/currentUserId hoáº·c gá»i API ngoÃ i Ã½ muá»‘n; E2EE khÃ´ng thay tháº¿ authorization. | Chuyá»ƒn API nghiá»‡p vá»¥ sang authenticated() vÃ  láº¥y user tá»« JWT, khÃ´ng tin userId do client gá»­i. |
| HIGH | ElGamal private key lÆ°u plaintext trong localStorage | XSS hoáº·c script Ä‘á»™c háº¡i cÃ¹ng origin cÃ³ thá»ƒ láº¥y khÃ³a vÃ  giáº£i mÃ£ lá»‹ch sá»­. | MÃ£ hÃ³a private key báº±ng khÃ³a dáº«n xuáº¥t tá»« máº­t kháº©u/credential vÃ  lÆ°u IndexedDB; triá»ƒn khai CSP chá»‘ng XSS. |
| MEDIUM | CORS cho phÃ©p origin rá»™ng | TÄƒng bá» máº·t táº¥n cÃ´ng trÃ¬nh duyá»‡t, Ä‘áº·c biá»‡t khi káº¿t há»£p lá»—i XSS/token handling. | Chá»‰ cho phÃ©p domain frontend thá»±c táº¿ theo mÃ´i trÆ°á»ng. |
| MEDIUM | ChÆ°a cÃ³ xÃ¡c minh fingerprint/public-key giá»¯a ngÆ°á»i dÃ¹ng | Náº¿u public key bá»‹ thay trÆ°á»›c khi wrap key, cÃ³ nguy cÆ¡ MITM á»Ÿ táº§ng phÃ¢n phá»‘i khÃ³a. | Hiá»ƒn thá»‹ fingerprint/QR hoáº·c cÆ¡ cháº¿ verify key ngoÃ i bÄƒng. |
| MEDIUM | ChÆ°a cÃ³ quy trÃ¬nh backup/recovery private key | Máº¥t localStorage/trÃ¬nh duyá»‡t cÃ³ thá»ƒ lÃ m máº¥t kháº£ nÄƒng giáº£i mÃ£ lá»‹ch sá»­. | Thiáº¿t káº¿ encrypted key backup/recovery hoáº·c multi-device key transfer. |


## Káº¿t luáº­n

á»¨ng dá»¥ng phÃ¹ há»£p Ä‘á»ƒ **demo/Ä‘á»“ Ã¡n E2EE hybrid**, nhÆ°ng chÆ°a nÃªn tuyÃªn bá»‘ production-grade cho Ä‘áº¿n khi xá»­ lÃ½ authorization, secret management, private-key protection, key verification vÃ  recovery.
