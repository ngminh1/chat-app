# Kiá»ƒm tra server khÃ´ng lÆ°u plaintext

## Kiá»ƒm tra tÄ©nh tá»± Ä‘á»™ng

| Check | Result | Evidence |
| --- | --- | --- |
| TEXT encrypted message stores content = null | PASS | ChatService.sendMessage |
| Message entity has ciphertext + IV + SHA fields | PASS | Message.java |
| Backend User stores ElGamal public key, not ElGamal private key field | PASS | User.java |
| Per-member wrapped AES key fields exist | PASS | ConversationMember.java |
| Crypto key endpoints require authentication | PASS | SecurityConfig.java |
| Frontend persists ElGamal private key only on client | PASS | aesKeyManager.js |
| Legacy raw AES key is migration-only and deleted after wrapping | PASS | ChatService.java |


## Káº¿t luáº­n giá»›i háº¡n

Source hiá»‡n cho tháº¥y TEXT message mÃ£ hÃ³a Ä‘Æ°á»£c lÆ°u vá»›i `content = null`, cÃ²n server nháº­n/lÆ°u `ciphertext + iv + sha256`. Tuy nhiÃªn kiá»ƒm tra tÄ©nh **khÃ´ng chá»©ng minh 100% runtime database**. KhÃ´ng tá»± Ä‘á»™ng cháº¡y E2E trÃªn backend cáº¥u hÃ¬nh hiá»‡n táº¡i vÃ¬ datasource trá» Ä‘áº¿n database bÃªn ngoÃ i; tá»± táº¡o user/message test cÃ³ thá»ƒ lÃ m báº©n dá»¯ liá»‡u tháº­t. Thá»±c hiá»‡n checklist 07 trÃªn mÃ´i trÆ°á»ng test riÃªng Ä‘á»ƒ chá»¥p báº±ng chá»©ng DB/runtime.
