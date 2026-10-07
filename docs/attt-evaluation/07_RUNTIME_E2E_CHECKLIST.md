# Checklist E2E runtime cáº§n chá»¥p báº±ng chá»©ng

Cháº¡y trÃªn **mÃ´i trÆ°á»ng test riÃªng**, khÃ´ng dÃ¹ng database tháº­t náº¿u khÃ´ng muá»‘n táº¡o dá»¯ liá»‡u rÃ¡c.

1. ÄÄƒng nháº­p User A vÃ  User B trÃªn hai browser/profile khÃ¡c nhau.
2. A gá»­i: `DISPATCH_E2E_TEST_<timestamp>_Xin_chao`. B pháº£i Ä‘á»c Ä‘Ãºng sau realtime vÃ  sau F5.
3. DevTools Network/WebSocket: chá»¥p payload; pháº£i tháº¥y `ciphertext/iv/sha256`, khÃ´ng tháº¥y plaintext test.
4. Database báº£ng `messages`: record TEXT tÆ°Æ¡ng á»©ng pháº£i cÃ³ `content = NULL`; `ciphertext/iv/sha256` cÃ³ dá»¯ liá»‡u.
5. Database `conversation_members`: má»—i member cÃ³ `encrypted_aes_key_c1/c2`; sau migration `conversations.aes_key` pháº£i NULL.
6. Sá»­a 1 kÃ½ tá»± ciphertext trong báº£n test/database hoáº·c test harness: client pháº£i tá»« chá»‘i vá»›i lá»—i integrity/AES-GCM.
7. Group chat: thÃªm member má»›i sau khi conversation Ä‘Ã£ migrate, member má»›i pháº£i Ä‘á»c Ä‘Æ°á»£c tin nháº¯n má»›i; kiá»ƒm tra chÃ­nh sÃ¡ch Ä‘á»c lá»‹ch sá»­ theo yÃªu cáº§u nhÃ³m.

## áº¢nh nÃªn lÆ°u

- 01_login_two_users.png
- 02_realtime_message.png
- 03_network_ciphertext.png
- 04_database_message_no_plaintext.png
- 05_database_wrapped_keys.png
- 06_reload_history_decrypted.png
- 07_group_member_key.png
