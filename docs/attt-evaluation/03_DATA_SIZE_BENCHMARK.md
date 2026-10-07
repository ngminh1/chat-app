# ÄÃ¡nh giÃ¡ kÃ­ch thÆ°á»›c dá»¯ liá»‡u sau mÃ£ hÃ³a

| plaintext_bytes | ciphertext_binary_bytes | ciphertext_base64_chars | iv_binary_bytes | iv_base64_chars | sha256_hex_chars | encryption_version_chars | transmitted_crypto_fields_bytes_no_json | overhead_vs_plaintext_percent |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 26 | 36 | 12 | 16 | 64 | 11 | 127 | 1170.00 |
| 100 | 116 | 156 | 12 | 16 | 64 | 11 | 247 | 147.00 |
| 1024 | 1040 | 1388 | 12 | 16 | 64 | 11 | 1479 | 44.43 |
| 10240 | 10256 | 13676 | 12 | 16 | 64 | 11 | 13767 | 34.44 |
| 102400 | 102416 | 136556 | 12 | 16 | 64 | 11 | 136647 | 33.44 |


- AES-GCM binary ciphertext gá»“m ciphertext + authentication tag.
- Dá»¯ liá»‡u truyá»n qua JSON Ä‘ang dÃ¹ng Base64/hex nÃªn lá»›n hÆ¡n binary.
- TrÆ°á»ng `transmitted_crypto_fields_bytes_no_json` chÆ°a tÃ­nh tÃªn field, dáº¥u ngoáº·c JSON, WebSocket/HTTP headers hoáº·c metadata message.
- Wrapped AES key ElGamal khoáº£ng **1304 byte JSON** cho má»—i user/conversation key entry trong láº§n Ä‘o nÃ y.
