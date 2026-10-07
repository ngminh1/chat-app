# ÄÃ¡nh giÃ¡ thá»i gian mÃ£ hÃ³a/giáº£i mÃ£

MÃ¡y cháº¡y benchmark: win32 / x64, Node v24.19.0. Má»—i kÃ­ch thÆ°á»›c cháº¡y 100 láº§n. ElGamal cháº¡y 20 láº§n.

| plaintext_bytes | iterations | aes_encrypt_avg_ms | aes_encrypt_median_ms | aes_encrypt_p95_ms | aes_decrypt_avg_ms | aes_decrypt_median_ms | aes_decrypt_p95_ms | sha256_avg_ms | sha256_median_ms | sha256_p95_ms | total_crypto_avg_ms |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 | 100 | 0.082 | 0.072 | 0.141 | 0.074 | 0.066 | 0.116 | 0.030 | 0.028 | 0.045 | 0.186 |
| 100 | 100 | 0.084 | 0.076 | 0.124 | 0.090 | 0.071 | 0.120 | 0.031 | 0.028 | 0.055 | 0.205 |
| 1024 | 100 | 0.109 | 0.094 | 0.182 | 0.084 | 0.072 | 0.142 | 0.032 | 0.028 | 0.048 | 0.224 |
| 10240 | 100 | 0.182 | 0.165 | 0.334 | 0.095 | 0.082 | 0.152 | 0.040 | 0.034 | 0.063 | 0.317 |
| 102400 | 100 | 1.206 | 0.980 | 2.096 | 0.493 | 0.472 | 0.673 | 0.295 | 0.264 | 0.465 | 1.994 |

## ElGamal wrap AES key

| iterations | keypair_two_users_avg_ms | keypair_two_users_p95_ms | wrap_aes_key_avg_ms | wrap_aes_key_p95_ms | unwrap_aes_key_avg_ms | unwrap_aes_key_p95_ms | wrapped_key_json_bytes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 20 | 18.843 | 19.438 | 18.930 | 19.971 | 9.943 | 10.389 | 1304 |


**Diá»…n giáº£i:** AES/SHA thay Ä‘á»•i theo kÃ­ch thÆ°á»›c message; ElGamal chá»‰ wrap khÃ³a AES 256-bit nÃªn chi phÃ­ gáº§n nhÆ° Ä‘á»™c láº­p kÃ­ch thÆ°á»›c message.
