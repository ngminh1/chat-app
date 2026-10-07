import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
if (!globalThis.btoa) globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
if (!globalThis.atob) globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(frontendDir, '..');
const reportDir = path.join(repoDir, 'docs', 'attt-evaluation');
fs.mkdirSync(reportDir, { recursive: true });

const {
  generateAESKey,
  exportAESKeyToBase64,
  importAESKeyFromBase64,
  encryptMessage,
  decryptMessage,
  base64ToBytes
} = await import('../src/utils/crypto.js');
const { hashEncryptedPayload } = await import('../src/utils/sha256.js');
const { default: ElGamalKeyManager } = await import('../src/utils/elgamal.js');

function avg(xs) { return xs.reduce((a,b)=>a+b,0) / xs.length; }
function median(xs) { const a=[...xs].sort((x,y)=>x-y); const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
function p95(xs) { const a=[...xs].sort((x,y)=>x-y); return a[Math.min(a.length-1, Math.ceil(a.length*0.95)-1)]; }
function f(n,d=3){ return Number(n).toFixed(d); }
function utf8Bytes(s){ return Buffer.byteLength(s, 'utf8'); }
function csvEscape(v){ const s=String(v); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }
function writeCsv(file, rows){ if(!rows.length)return; const keys=Object.keys(rows[0]); const text=[keys.join(','),...rows.map(r=>keys.map(k=>csvEscape(r[k])).join(','))].join('\n')+'\n'; fs.writeFileSync(file,text); }
function read(rel){ return fs.readFileSync(path.join(repoDir, rel), 'utf8'); }
function exists(rel){ return fs.existsSync(path.join(repoDir, rel)); }

const testStarted = new Date();
const e2ePlaintext = 'Dispatch E2E: Xin chÃ o Viá»‡t Nam ðŸ˜€ â€” AES-GCM + ElGamal + SHA-256';

// 1) Crypto E2E in-process: sender key -> ElGamal wrap -> recipient unwrap -> AES encrypt/hash/decrypt.
const sender = new ElGamalKeyManager();
const recipient = new ElGamalKeyManager();
sender.generateKeyPair();
const recipientPublic = recipient.generateKeyPair();
const aesSender = await generateAESKey();
const aesBase64 = await exportAESKeyToBase64(aesSender);
const wrapped = sender.encryptString(aesBase64, recipientPublic.y);
const aesRecipient = await importAESKeyFromBase64(recipient.decryptString(wrapped));
const encrypted = await encryptMessage(e2ePlaintext, aesSender);
const decrypted = await decryptMessage(encrypted.ciphertext, encrypted.iv, aesRecipient, encrypted.sha256);
const tamperedCipher = encrypted.ciphertext.slice(0,-1) + (encrypted.ciphertext.endsWith('A')?'B':'A');
let tamperRejected = false;
try { await decryptMessage(tamperedCipher, encrypted.iv, aesRecipient, encrypted.sha256); } catch { tamperRejected = true; }
const e2ePass = decrypted === e2ePlaintext && tamperRejected && !JSON.stringify(encrypted).includes(e2ePlaintext);

// 2) Performance benchmark.
const sizes = [10, 100, 1024, 10_240, 102_400];
const iterations = Number(process.env.DISPATCH_BENCH_ITERATIONS || 100);
const perfRows = [];
const sizeRows = [];
const benchKey = await generateAESKey();

for (const bytesTarget of sizes) {
  const unit = 'a';
  const message = unit.repeat(bytesTarget);
  const encTimes=[]; const decTimes=[]; const shaTimes=[];
  let sample = null;
  for (let i=0;i<iterations;i++) {
    let t0=performance.now();
    const enc = await encryptMessage(message, benchKey);
    let t1=performance.now();
    const encMs=t1-t0;
    t0=performance.now();
    await hashEncryptedPayload(enc.ciphertext, enc.iv, enc.encryptionVersion);
    t1=performance.now();
    const shaMs=t1-t0;
    t0=performance.now();
    const dec = await decryptMessage(enc.ciphertext, enc.iv, benchKey, enc.sha256);
    t1=performance.now();
    if (dec !== message) throw new Error(`Benchmark decrypt mismatch at ${bytesTarget} bytes`);
    encTimes.push(encMs); shaTimes.push(shaMs); decTimes.push(t1-t0); sample ??= enc;
  }
  perfRows.push({
    plaintext_bytes: bytesTarget,
    iterations,
    aes_encrypt_avg_ms:f(avg(encTimes)), aes_encrypt_median_ms:f(median(encTimes)), aes_encrypt_p95_ms:f(p95(encTimes)),
    aes_decrypt_avg_ms:f(avg(decTimes)), aes_decrypt_median_ms:f(median(decTimes)), aes_decrypt_p95_ms:f(p95(decTimes)),
    sha256_avg_ms:f(avg(shaTimes)), sha256_median_ms:f(median(shaTimes)), sha256_p95_ms:f(p95(shaTimes)),
    total_crypto_avg_ms:f(avg(encTimes)+avg(decTimes)+avg(shaTimes))
  });

  const cipherBinary = base64ToBytes(sample.ciphertext).byteLength;
  const ivBinary = base64ToBytes(sample.iv).byteLength;
  const plaintextBytes = utf8Bytes(message);
  const txNoJson = utf8Bytes(sample.ciphertext)+utf8Bytes(sample.iv)+utf8Bytes(sample.sha256)+utf8Bytes(sample.encryptionVersion);
  sizeRows.push({
    plaintext_bytes: plaintextBytes,
    ciphertext_binary_bytes: cipherBinary,
    ciphertext_base64_chars: sample.ciphertext.length,
    iv_binary_bytes: ivBinary,
    iv_base64_chars: sample.iv.length,
    sha256_hex_chars: sample.sha256.length,
    encryption_version_chars: sample.encryptionVersion.length,
    transmitted_crypto_fields_bytes_no_json: txNoJson,
    overhead_vs_plaintext_percent: f(((txNoJson-plaintextBytes)/plaintextBytes)*100,2)
  });
}

// ElGamal cost is independent of message size because it wraps the fixed 256-bit AES key.
const elgamalIterations = Number(process.env.DISPATCH_ELGAMAL_ITERATIONS || 20);
const keygenTimes=[]; const wrapTimes=[]; const unwrapTimes=[];
let wrapSize = 0;
for(let i=0;i<elgamalIterations;i++){
  let t0=performance.now();
  const a=new ElGamalKeyManager();
  a.generateKeyPair();
  const b=new ElGamalKeyManager();
  const bpub=b.generateKeyPair();
  let t1=performance.now();
  keygenTimes.push(t1-t0);
  t0=performance.now();
  const w=a.encryptString(aesBase64,bpub.y);
  t1=performance.now(); wrapTimes.push(t1-t0);
  wrapSize = utf8Bytes(JSON.stringify(w));
  t0=performance.now();
  const u=b.decryptString(w);
  t1=performance.now(); unwrapTimes.push(t1-t0);
  if(u!==aesBase64) throw new Error('ElGamal unwrap mismatch');
}
const elgamalRow={
  iterations:elgamalIterations,
  keypair_two_users_avg_ms:f(avg(keygenTimes)), keypair_two_users_p95_ms:f(p95(keygenTimes)),
  wrap_aes_key_avg_ms:f(avg(wrapTimes)), wrap_aes_key_p95_ms:f(p95(wrapTimes)),
  unwrap_aes_key_avg_ms:f(avg(unwrapTimes)), unwrap_aes_key_p95_ms:f(p95(unwrapTimes)),
  wrapped_key_json_bytes:wrapSize
};

// 3) Static server plaintext / key audit. This avoids touching the configured remote DB.
const chatService = read('backend/src/main/java/com/chatapp/backend/service/ChatService.java');
const messageEntity = read('backend/src/main/java/com/chatapp/backend/entity/Message.java');
const userEntity = read('backend/src/main/java/com/chatapp/backend/entity/User.java');
const memberEntity = read('backend/src/main/java/com/chatapp/backend/entity/ConversationMember.java');
const securityConfig = read('backend/src/main/java/com/chatapp/backend/config/SecurityConfig.java');
const aesManager = read('frontend/src/utils/aesKeyManager.js');
const appProps = read('backend/src/main/resources/application.properties');

const staticChecks = [
  {name:'TEXT encrypted message stores content = null', pass:/\.content\(encryptedText\s*\?\s*null\s*:\s*request\.getContent\(\)\)/s.test(chatService), evidence:'ChatService.sendMessage'},
  {name:'Message entity has ciphertext + IV + SHA fields', pass:/private String ciphertext;/.test(messageEntity)&&/private String iv;/.test(messageEntity)&&/private String sha256;/.test(messageEntity), evidence:'Message.java'},
  {name:'Backend User stores ElGamal public key, not ElGamal private key field', pass:/elgamalPublicKey/.test(userEntity)&&!/elgamalPrivateKey/.test(userEntity), evidence:'User.java'},
  {name:'Per-member wrapped AES key fields exist', pass:/encryptedAesKeyC1/.test(memberEntity)&&/encryptedAesKeyC2/.test(memberEntity), evidence:'ConversationMember.java'},
  {name:'Crypto key endpoints require authentication', pass:/wrapped-key[\s\S]*authenticated\(\)/.test(securityConfig)||/requestMatchers\([\s\S]*wrapped-key[\s\S]*\)\.authenticated\(\)/.test(securityConfig), evidence:'SecurityConfig.java'},
  {name:'Frontend persists ElGamal private key only on client', pass:/dispatch_elgamal_private_v1_/.test(aesManager)&&/localStorage\.setItem/.test(aesManager), evidence:'aesKeyManager.js'},
  {name:'Legacy raw AES key is migration-only and deleted after wrapping', pass:/MIGRATION ONLY/.test(chatService)&&/clearLegacyAesKeyIfFullyWrapped/.test(chatService), evidence:'ChatService.java'}
];

const findings=[];
if (/\.anyRequest\(\)\.permitAll\(\)/.test(securityConfig)) findings.push({severity:'HIGH', item:'Nhiá»u API legacy váº«n permitAll', consequence:'CÃ³ thá»ƒ giáº£ senderId/currentUserId hoáº·c gá»i API ngoÃ i Ã½ muá»‘n; E2EE khÃ´ng thay tháº¿ authorization.', recommendation:'Chuyá»ƒn API nghiá»‡p vá»¥ sang authenticated() vÃ  láº¥y user tá»« JWT, khÃ´ng tin userId do client gá»­i.'});
if (/localStorage\.setItem\(identityStorageKey\(userId\), manager\.exportPrivateKey\(\)\)/.test(aesManager)) findings.push({severity:'HIGH', item:'ElGamal private key lÆ°u plaintext trong localStorage', consequence:'XSS hoáº·c script Ä‘á»™c háº¡i cÃ¹ng origin cÃ³ thá»ƒ láº¥y khÃ³a vÃ  giáº£i mÃ£ lá»‹ch sá»­.', recommendation:'MÃ£ hÃ³a private key báº±ng khÃ³a dáº«n xuáº¥t tá»« máº­t kháº©u/credential vÃ  lÆ°u IndexedDB; triá»ƒn khai CSP chá»‘ng XSS.'});
const dbPass = /spring\.datasource\.password\s*=\s*\$\{/.test(appProps);
const jwtPass = /app\.jwt\.secret\s*=\s*\$\{/.test(appProps);
if (!dbPass) findings.push({severity:'CRITICAL', item:'DB password cÃ³ váº» hard-code trong application.properties', consequence:'Náº¿u repository/file bá»‹ lá»™, database cÃ³ thá»ƒ bá»‹ truy cáº­p trÃ¡i phÃ©p.', recommendation:'Rotate credential vÃ  chuyá»ƒn sang biáº¿n mÃ´i trÆ°á»ng. KhÃ´ng commit secret tháº­t.'});
if (!jwtPass) findings.push({severity:'CRITICAL', item:'JWT secret cÃ³ váº» hard-code trong application.properties', consequence:'Náº¿u secret bá»‹ lá»™, káº» táº¥n cÃ´ng cÃ³ thá»ƒ tá»± kÃ½ JWT giáº£.', recommendation:'Rotate JWT secret vÃ  chuyá»ƒn sang biáº¿n mÃ´i trÆ°á»ng.'});
if (/setAllowedOriginPatterns\(List\.of\("\*"\)\)/.test(securityConfig)) findings.push({severity:'MEDIUM', item:'CORS cho phÃ©p origin rá»™ng', consequence:'TÄƒng bá» máº·t táº¥n cÃ´ng trÃ¬nh duyá»‡t, Ä‘áº·c biá»‡t khi káº¿t há»£p lá»—i XSS/token handling.', recommendation:'Chá»‰ cho phÃ©p domain frontend thá»±c táº¿ theo mÃ´i trÆ°á»ng.'});
findings.push({severity:'MEDIUM', item:'ChÆ°a cÃ³ xÃ¡c minh fingerprint/public-key giá»¯a ngÆ°á»i dÃ¹ng', consequence:'Náº¿u public key bá»‹ thay trÆ°á»›c khi wrap key, cÃ³ nguy cÆ¡ MITM á»Ÿ táº§ng phÃ¢n phá»‘i khÃ³a.', recommendation:'Hiá»ƒn thá»‹ fingerprint/QR hoáº·c cÆ¡ cháº¿ verify key ngoÃ i bÄƒng.'});
findings.push({severity:'MEDIUM', item:'ChÆ°a cÃ³ quy trÃ¬nh backup/recovery private key', consequence:'Máº¥t localStorage/trÃ¬nh duyá»‡t cÃ³ thá»ƒ lÃ m máº¥t kháº£ nÄƒng giáº£i mÃ£ lá»‹ch sá»­.', recommendation:'Thiáº¿t káº¿ encrypted key backup/recovery hoáº·c multi-device key transfer.'});

writeCsv(path.join(reportDir,'02_PERFORMANCE_BENCHMARK.csv'), perfRows);
writeCsv(path.join(reportDir,'03_DATA_SIZE_BENCHMARK.csv'), sizeRows);
fs.writeFileSync(path.join(reportDir,'raw-results.json'), JSON.stringify({generatedAt:new Date().toISOString(), e2e:{pass:e2ePass,tamperRejected},performance:perfRows,dataSize:sizeRows,elgamal:elgamalRow,staticChecks,findings},null,2));

const mdTable = (rows, cols) => {
  const head='| '+cols.join(' | ')+' |\n| '+cols.map(()=> '---').join(' | ')+' |\n';
  return head+rows.map(r=>'| '+cols.map(c=>String(r[c]??'')).join(' | ')+' |').join('\n')+'\n';
};

fs.writeFileSync(path.join(reportDir,'01_CRYPTO_E2E_TEST.md'), `# Kiá»ƒm thá»­ luá»“ng mÃ£ hÃ³a Ä‘áº§u-cuá»‘i (crypto pipeline)\n\n- Thá»i Ä‘iá»ƒm: ${testStarted.toISOString()}\n- Káº¿t quáº£: **${e2ePass?'PASS':'FAIL'}**\n- Plaintext Unicode/emoji round-trip: **${decrypted===e2ePlaintext?'PASS':'FAIL'}**\n- AES key Ä‘Æ°á»£c wrap/unwrap báº±ng ElGamal: **PASS**\n- SHA-256 phÃ¡t hiá»‡n ciphertext bá»‹ sá»­a: **${tamperRejected?'PASS':'FAIL'}**\n- Encrypted payload khÃ´ng chá»©a nguyÃªn vÄƒn plaintext: **${!JSON.stringify(encrypted).includes(e2ePlaintext)?'PASS':'FAIL'}**\n\n> ÄÃ¢y lÃ  kiá»ƒm thá»­ crypto pipeline tá»± Ä‘á»™ng trong process Node, khÃ´ng pháº£i báº±ng chá»©ng runtime ráº±ng database production khÃ´ng chá»©a plaintext. Xem 04_SERVER_PLAINTEXT_AUDIT.md vÃ  07_RUNTIME_E2E_CHECKLIST.md.\n`);

fs.writeFileSync(path.join(reportDir,'02_PERFORMANCE_BENCHMARK.md'), `# ÄÃ¡nh giÃ¡ thá»i gian mÃ£ hÃ³a/giáº£i mÃ£\n\nMÃ¡y cháº¡y benchmark: ${process.platform} / ${process.arch}, Node ${process.version}. Má»—i kÃ­ch thÆ°á»›c cháº¡y ${iterations} láº§n. ElGamal cháº¡y ${elgamalIterations} láº§n.\n\n${mdTable(perfRows,Object.keys(perfRows[0]))}\n## ElGamal wrap AES key\n\n${mdTable([elgamalRow],Object.keys(elgamalRow))}\n\n**Diá»…n giáº£i:** AES/SHA thay Ä‘á»•i theo kÃ­ch thÆ°á»›c message; ElGamal chá»‰ wrap khÃ³a AES 256-bit nÃªn chi phÃ­ gáº§n nhÆ° Ä‘á»™c láº­p kÃ­ch thÆ°á»›c message.\n`);

fs.writeFileSync(path.join(reportDir,'03_DATA_SIZE_BENCHMARK.md'), `# ÄÃ¡nh giÃ¡ kÃ­ch thÆ°á»›c dá»¯ liá»‡u sau mÃ£ hÃ³a\n\n${mdTable(sizeRows,Object.keys(sizeRows[0]))}\n\n- AES-GCM binary ciphertext gá»“m ciphertext + authentication tag.\n- Dá»¯ liá»‡u truyá»n qua JSON Ä‘ang dÃ¹ng Base64/hex nÃªn lá»›n hÆ¡n binary.\n- TrÆ°á»ng \`transmitted_crypto_fields_bytes_no_json\` chÆ°a tÃ­nh tÃªn field, dáº¥u ngoáº·c JSON, WebSocket/HTTP headers hoáº·c metadata message.\n- Wrapped AES key ElGamal khoáº£ng **${wrapSize} byte JSON** cho má»—i user/conversation key entry trong láº§n Ä‘o nÃ y.\n`);

fs.writeFileSync(path.join(reportDir,'04_SERVER_PLAINTEXT_AUDIT.md'), `# Kiá»ƒm tra server khÃ´ng lÆ°u plaintext\n\n## Kiá»ƒm tra tÄ©nh tá»± Ä‘á»™ng\n\n${mdTable(staticChecks.map(x=>({Check:x.name,Result:x.pass?'PASS':'FAIL',Evidence:x.evidence})),['Check','Result','Evidence'])}\n\n## Káº¿t luáº­n giá»›i háº¡n\n\nSource hiá»‡n cho tháº¥y TEXT message mÃ£ hÃ³a Ä‘Æ°á»£c lÆ°u vá»›i \`content = null\`, cÃ²n server nháº­n/lÆ°u \`ciphertext + iv + sha256\`. Tuy nhiÃªn kiá»ƒm tra tÄ©nh **khÃ´ng chá»©ng minh 100% runtime database**. KhÃ´ng tá»± Ä‘á»™ng cháº¡y E2E trÃªn backend cáº¥u hÃ¬nh hiá»‡n táº¡i vÃ¬ datasource trá» Ä‘áº¿n database bÃªn ngoÃ i; tá»± táº¡o user/message test cÃ³ thá»ƒ lÃ m báº©n dá»¯ liá»‡u tháº­t. Thá»±c hiá»‡n checklist 07 trÃªn mÃ´i trÆ°á»ng test riÃªng Ä‘á»ƒ chá»¥p báº±ng chá»©ng DB/runtime.\n`);

const severityOrder={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};
findings.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]);
fs.writeFileSync(path.join(reportDir,'05_SECURITY_ASSESSMENT.md'), `# ÄÃ¡nh giÃ¡ má»©c Ä‘á»™ an toÃ n vÃ  kháº£ nÄƒng triá»ƒn khai\n\n## Äiá»ƒm Ä‘Ã£ Ä‘áº¡t\n\n- AES-256-GCM mÃ£ hÃ³a ná»™i dung á»Ÿ client.\n- ElGamal wrap AES conversation key theo tá»«ng user.\n- SHA-256 kiá»ƒm tra fingerprint/integrity cá»§a encrypted payload; AES-GCM authentication tag váº«n lÃ  cÆ¡ cháº¿ xÃ¡c thá»±c ciphertext chÃ­nh.\n- Backend model cÃ³ ciphertext/IV/SHA; TEXT mÃ£ hÃ³a khÃ´ng lÆ°u plaintext theo source hiá»‡n táº¡i.\n\n## Rá»§i ro cÃ²n láº¡i\n\n${mdTable(findings.map(x=>({Severity:x.severity,Finding:x.item,Consequence:x.consequence,Recommendation:x.recommendation})),['Severity','Finding','Consequence','Recommendation'])}\n\n## Káº¿t luáº­n\n\ná»¨ng dá»¥ng phÃ¹ há»£p Ä‘á»ƒ **demo/Ä‘á»“ Ã¡n E2EE hybrid**, nhÆ°ng chÆ°a nÃªn tuyÃªn bá»‘ production-grade cho Ä‘áº¿n khi xá»­ lÃ½ authorization, secret management, private-key protection, key verification vÃ  recovery.\n`);

fs.writeFileSync(path.join(reportDir,'06_TEST_SUMMARY.md'), `# Tá»•ng há»£p káº¿t quáº£ thá»±c nghiá»‡m ATTT\n\n| Háº¡ng má»¥c | Káº¿t quáº£ |\n| --- | --- |\n| AES-256-GCM encrypt/decrypt | ${e2ePass?'PASS':'FAIL'} |\n| ElGamal wrap/unwrap AES key | PASS |\n| SHA-256 phÃ¡t hiá»‡n sá»­a ciphertext | ${tamperRejected?'PASS':'FAIL'} |\n| Unicode/emoji | ${decrypted===e2ePlaintext?'PASS':'FAIL'} |\n| Benchmark thá»i gian | DONE |\n| Benchmark kÃ­ch thÆ°á»›c | DONE |\n| Static server plaintext audit | ${staticChecks.every(x=>x.pass)?'PASS':'CÃ“ Cáº¢NH BÃO'} |\n| Full runtime DB proof | MANUAL / TEST ENV REQUIRED |\n\nCÃ¡c file CSV cÃ³ thá»ƒ dÃ¹ng trá»±c tiáº¿p Ä‘á»ƒ táº¡o báº£ng/biá»ƒu Ä‘á»“ cho bÃ¡o cÃ¡o.\n`);

fs.writeFileSync(path.join(reportDir,'07_RUNTIME_E2E_CHECKLIST.md'), `# Checklist E2E runtime cáº§n chá»¥p báº±ng chá»©ng\n\nCháº¡y trÃªn **mÃ´i trÆ°á»ng test riÃªng**, khÃ´ng dÃ¹ng database tháº­t náº¿u khÃ´ng muá»‘n táº¡o dá»¯ liá»‡u rÃ¡c.\n\n1. ÄÄƒng nháº­p User A vÃ  User B trÃªn hai browser/profile khÃ¡c nhau.\n2. A gá»­i: \`DISPATCH_E2E_TEST_<timestamp>_Xin_chao\`. B pháº£i Ä‘á»c Ä‘Ãºng sau realtime vÃ  sau F5.\n3. DevTools Network/WebSocket: chá»¥p payload; pháº£i tháº¥y \`ciphertext/iv/sha256\`, khÃ´ng tháº¥y plaintext test.\n4. Database báº£ng \`messages\`: record TEXT tÆ°Æ¡ng á»©ng pháº£i cÃ³ \`content = NULL\`; \`ciphertext/iv/sha256\` cÃ³ dá»¯ liá»‡u.\n5. Database \`conversation_members\`: má»—i member cÃ³ \`encrypted_aes_key_c1/c2\`; sau migration \`conversations.aes_key\` pháº£i NULL.\n6. Sá»­a 1 kÃ½ tá»± ciphertext trong báº£n test/database hoáº·c test harness: client pháº£i tá»« chá»‘i vá»›i lá»—i integrity/AES-GCM.\n7. Group chat: thÃªm member má»›i sau khi conversation Ä‘Ã£ migrate, member má»›i pháº£i Ä‘á»c Ä‘Æ°á»£c tin nháº¯n má»›i; kiá»ƒm tra chÃ­nh sÃ¡ch Ä‘á»c lá»‹ch sá»­ theo yÃªu cáº§u nhÃ³m.\n\n## áº¢nh nÃªn lÆ°u\n\n- 01_login_two_users.png\n- 02_realtime_message.png\n- 03_network_ciphertext.png\n- 04_database_message_no_plaintext.png\n- 05_database_wrapped_keys.png\n- 06_reload_history_decrypted.png\n- 07_group_member_key.png\n`);



const largest = perfRows[perfRows.length - 1];
const smallest = perfRows[0];
fs.writeFileSync(path.join(reportDir,'08_BAO_CAO_THUC_NGHIEM.md'), `# Ná»™i dung sáºµn Ä‘á»ƒ Ä‘Æ°a vÃ o bÃ¡o cÃ¡o - Thá»±c nghiá»‡m & Ä‘Ã¡nh giÃ¡\n\n## Má»¥c tiÃªu thá»±c nghiá»‡m\n\nThá»±c nghiá»‡m kiá»ƒm tra bá»‘n má»¥c tiÃªu: (1) luá»“ng mÃ£ hÃ³a/giáº£i mÃ£ AES-256-GCM hoáº¡t Ä‘á»™ng vá»›i dá»¯ liá»‡u Unicode, (2) khÃ³a AES Ä‘Æ°á»£c báº£o vá»‡ báº±ng ElGamal, (3) SHA-256 phÃ¡t hiá»‡n thay Ä‘á»•i trÃªn encrypted payload, vÃ  (4) Ä‘o chi phÃ­ thá»i gian/kÃ­ch thÆ°á»›c dá»¯ liá»‡u.\n\n## Káº¿t quáº£ chá»©c nÄƒng\n\nLuá»“ng kiá»ƒm thá»­ tá»± Ä‘á»™ng cho káº¿t quáº£ **${e2ePass?'PASS':'FAIL'}**. Tin nháº¯n tiáº¿ng Viá»‡t vÃ  emoji Ä‘Æ°á»£c mÃ£ hÃ³a, truyá»n qua chuá»—i ciphertext/IV/hash, sau Ä‘Ã³ giáº£i mÃ£ Ä‘Ãºng á»Ÿ phÃ­a ngÆ°á»i nháº­n. Khi ciphertext bá»‹ thay Ä‘á»•i, kiá»ƒm tra SHA-256/AES-GCM tá»« chá»‘i dá»¯ liá»‡u.\n\n## Káº¿t quáº£ hiá»‡u nÄƒng\n\nVá»›i ${iterations} láº§n Ä‘o cho má»—i kÃ­ch thÆ°á»›c, message ${smallest.plaintext_bytes} byte cÃ³ tá»•ng chi phÃ­ crypto trung bÃ¬nh khoáº£ng **${smallest.total_crypto_avg_ms} ms**, cÃ²n message ${largest.plaintext_bytes} byte khoáº£ng **${largest.total_crypto_avg_ms} ms** trÃªn mÃ¡y cháº¡y benchmark. ElGamal chá»‰ dÃ¹ng Ä‘á»ƒ wrap khÃ³a AES 256-bit nÃªn chi phÃ­ khÃ´ng tÄƒng theo kÃ­ch thÆ°á»›c message; thá»i gian wrap trung bÃ¬nh Ä‘o Ä‘Æ°á»£c **${elgamalRow.wrap_aes_key_avg_ms} ms**, unwrap **${elgamalRow.unwrap_aes_key_avg_ms} ms**.\n\n## KÃ­ch thÆ°á»›c dá»¯ liá»‡u\n\nAES-GCM thÃªm authentication tag, IV Ä‘Æ°á»£c truyá»n riÃªng, SHA-256 Ä‘Æ°á»£c biá»ƒu diá»…n báº±ng 64 kÃ½ tá»± hex, vÃ  ciphertext Ä‘Æ°á»£c Base64 Ä‘á»ƒ truyá»n qua JSON. VÃ¬ váº­y dá»¯ liá»‡u truyá»n thá»±c táº¿ lá»›n hÆ¡n plaintext, Ä‘áº·c biá»‡t vá»›i message ráº¥t ngáº¯n. Báº£ng chi tiáº¿t náº±m trong \`03_DATA_SIZE_BENCHMARK.md\`.\n\n## Má»©c Ä‘á»™ an toÃ n\n\nSource hiá»‡n táº¡i cho tháº¥y TEXT message mÃ£ hÃ³a Ä‘Æ°á»£c lÆ°u vá»›i \`content = NULL\`, server giá»¯ ciphertext/IV/SHA vÃ  wrapped AES key. Tuy nhiÃªn há»‡ thá»‘ng váº«n cÃ²n cÃ¡c rá»§i ro cáº§n nÃªu rÃµ: authorization cá»§a API legacy chÆ°a cháº·t, private key ElGamal Ä‘ang lÆ°u plaintext trong localStorage, secret backend cÃ³ dáº¥u hiá»‡u hard-code, chÆ°a cÃ³ xÃ¡c minh fingerprint public key vÃ  chÆ°a cÃ³ recovery khÃ³a. VÃ¬ váº­y mÃ´ hÃ¬nh phÃ¹ há»£p cho Ä‘á»“ Ã¡n/demo E2EE hybrid nhÆ°ng **chÆ°a nÃªn tuyÃªn bá»‘ production-grade**.\n\n## Giá»›i háº¡n thá»±c nghiá»‡m\n\nKiá»ƒm tra tá»± Ä‘á»™ng khÃ´ng ghi dá»¯ liá»‡u thá»­ vÃ o database bÃªn ngoÃ i Ä‘ang cáº¥u hÃ¬nh trong project. Báº±ng chá»©ng runtime vá» DB khÃ´ng chá»©a plaintext cáº§n thá»±c hiá»‡n trÃªn mÃ´i trÆ°á»ng test riÃªng theo \`07_RUNTIME_E2E_CHECKLIST.md\`.\n`);

fs.writeFileSync(path.join(reportDir,'09_QA_BAO_CAO.md'), `# Q&A ngáº¯n cho pháº§n thá»±c nghiá»‡m\n\n**VÃ¬ sao khÃ´ng dÃ¹ng ElGamal mÃ£ hÃ³a trá»±c tiáº¿p toÃ n bá»™ message?**  \nElGamal báº¥t Ä‘á»‘i xá»©ng cháº­m vÃ  lÃ m dá»¯ liá»‡u lá»›n. Dispatch dÃ¹ng hybrid encryption: AES-GCM mÃ£ hÃ³a message, ElGamal chá»‰ wrap khÃ³a AES.\n\n**SHA-256 cÃ³ thay tháº¿ authentication tag cá»§a AES-GCM khÃ´ng?**  \nKhÃ´ng. AES-GCM Ä‘Ã£ cÃ³ authentication tag. SHA-256 á»Ÿ Ä‘Ã¢y lÃ  fingerprint/integrity check Ä‘á»™c láº­p theo yÃªu cáº§u bÃ i; SHA thuáº§n khÃ´ng chá»©ng minh ngÆ°á»i gá»­i.\n\n**Server cÃ³ Ä‘á»c Ä‘Æ°á»£c plaintext khÃ´ng?**  \nTheo source cá»§a luá»“ng TEXT má»›i, server nháº­n/lÆ°u ciphertext vÃ  field content Ä‘Æ°á»£c Ä‘áº·t NULL. Äá»ƒ chá»©ng minh runtime, cáº§n chá»¥p Network/WebSocket + báº£n ghi DB trÃªn mÃ´i trÆ°á»ng test.\n\n**Táº¡i sao dá»¯ liá»‡u mÃ£ hÃ³a lá»›n hÆ¡n plaintext?**  \nDo authentication tag cá»§a GCM, IV, SHA-256 vÃ  Base64/JSON encoding. Overhead tá»· lá»‡ cao nháº¥t vá»›i message ngáº¯n.\n\n**Äiá»ƒm yáº¿u lá»›n nháº¥t hiá»‡n táº¡i lÃ  gÃ¬?**  \nAuthorization API legacy, hard-coded secrets vÃ  private key ElGamal lÆ°u plaintext trong localStorage. Náº¿u bá»‹ XSS hoáº·c lá»™ secret, háº­u quáº£ cÃ³ thá»ƒ vÆ°á»£t qua lá»£i Ã­ch cá»§a E2EE.\n\n**Náº¿u máº¥t localStorage thÃ¬ sao?**  \nCÃ³ nguy cÆ¡ máº¥t private key vÃ  khÃ´ng giáº£i mÃ£ Ä‘Æ°á»£c lá»‹ch sá»­. Cáº§n encrypted backup/recovery hoáº·c multi-device key transfer trong phiÃªn báº£n hoÃ n thiá»‡n.\n`);

fs.mkdirSync(path.join(reportDir,'evidence'), { recursive: true });
fs.writeFileSync(path.join(reportDir,'evidence','README.md'), `# Báº±ng chá»©ng áº£nh cáº§n bá»• sung\n\nSau khi cháº¡y runtime E2E trÃªn mÃ´i trÆ°á»ng test, lÆ°u áº£nh vÃ o thÆ° má»¥c nÃ y theo tÃªn:\n\n- 01_login_two_users.png\n- 02_realtime_message.png\n- 03_network_ciphertext.png\n- 04_database_message_no_plaintext.png\n- 05_database_wrapped_keys.png\n- 06_reload_history_decrypted.png\n- 07_group_member_key.png\n\nKhÃ´ng chá»¥p/Ä‘Æ°a password, JWT token, DB credential hoáº·c private key vÃ o áº£nh bÃ¡o cÃ¡o.\n`);

console.log(`ATTT evaluation complete: ${reportDir}`);
console.log(`Crypto E2E: ${e2ePass ? 'PASS' : 'FAIL'}`);
console.log(`Reports: 01..07 + CSV + raw-results.json`);
if (!e2ePass) process.exitCode = 1;

