import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Copy, KeyRound, RefreshCw, AlertTriangle } from 'lucide-react';
import { generateRecoveryCode } from '../utils/keyVault';
import {
  getElGamalVaultStatus,
  createElGamalVaultBackup,
  recoverElGamalIdentity
} from '../utils/aesKeyManager';

export default function KeyVaultPanel({ isOpen, userId }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingCode, setPendingCode] = useState('');
  const [savedCode, setSavedCode] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');

  const loadStatus = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError('');
    try {
      setState(await getElGamalVaultStatus(userId));
    } catch (err) {
      setError(`Không thể kiểm tra khóa: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isOpen) loadStatus();
  }, [isOpen, loadStatus]);

  const backup = async () => {
    if (!savedCode || !pendingCode || busy) return;
    setBusy(true);
    setError('');
    try {
      await createElGamalVaultBackup(userId, pendingCode);
      setConfirmed(true);
      setState(await getElGamalVaultStatus(userId));
    } catch (err) {
      setError(err.response?.data || err.message || 'Không thể sao lưu khóa');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!restoreCode.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await recoverElGamalIdentity(userId, restoreCode);
      // Reload historical messages using the verified private key.
      window.location.reload();
    } catch (err) {
      setError(err.message === 'WRONG_RECOVERY_CODE_OR_DAMAGED_VAULT'
        ? 'Mã khôi phục sai hoặc bản sao lưu bị lỗi.'
        : err.message || 'Không thể khôi phục khóa');
      setBusy(false);
    }
  };

  return (
    <section className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
        <ShieldCheck className="w-4 h-4" /> Bảo vệ và khôi phục khóa ElGamal
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed">
        Mã khôi phục 256-bit chỉ hiển thị khi tạo, không gửi lên server.
        Server chỉ lưu bản mã AES-GCM của private key. Không dùng InPrivate làm nơi giữ khóa chính.
      </p>

      {error && (
        <p role="alert" className="text-xs p-3 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 whitespace-pre-wrap">
          {String(error)}
        </p>
      )}

      {!state && <p className="text-xs text-slate-500">Đang kiểm tra tình trạng khóa...</p>}

      {state && !state.hasServerKey && (
        <p className="text-xs text-amber-600 flex items-center gap-2">
          <AlertTriangle size={16} /> Server chưa nhận public key. Hãy đăng nhập lại rồi kiểm tra.
        </p>
      )}

      {state?.hasServerKey && state.matches && state.hasVault && !confirmed && (
        <p className="text-xs text-emerald-600 flex items-center gap-2">
          <ShieldCheck size={16} /> Thiết bị đang có đúng private key; vault đã tồn tại.
          Hãy giữ mã khôi phục bạn đã lưu trước đó.
        </p>
      )}

      {state?.hasServerKey && state.matches && !state.hasVault && (
        <div className="space-y-3 p-3 rounded-xl border border-amber-300 dark:border-amber-800">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            Khóa hiện chỉ có ở trình duyệt này. Tạo bản sao lưu trước khi đổi máy hoặc xóa dữ liệu.
          </p>
          {!pendingCode ? (
            <button type="button" disabled={busy}
              className="px-3 py-2 bg-[#0062FF] text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              onClick={() => setPendingCode(generateRecoveryCode())}>
              <KeyRound className="inline w-3.5 h-3.5 mr-1" /> Tạo mã khôi phục
            </button>
          ) : (
            <>
              <p className="text-xs font-semibold">Sao chép mã dưới đây ra nơi an toàn trước khi kích hoạt backup:</p>
              <div className="break-all select-text font-mono text-xs p-2 rounded bg-slate-100 dark:bg-slate-800">
                {pendingCode}
              </div>
              <button type="button" className="text-xs font-semibold text-[#0062FF] flex items-center gap-1"
                onClick={async () => { try { await navigator.clipboard.writeText(pendingCode); } catch { setError('Không sao chép tự động được, hãy chọn và sao chép mã thủ công.'); } }}>
                <Copy size={14} /> Sao chép mã
              </button>
              <label className="flex items-start gap-2 text-xs">
                <input type="checkbox" checked={savedCode} onChange={e => setSavedCode(e.target.checked)} />
                Tôi đã lưu mã khôi phục ở nơi an toàn. Tôi hiểu rằng mất mã và mất private key sẽ không thể đọc lịch sử.
              </label>
              <button type="button" disabled={!savedCode || busy}
                className="px-3 py-2 bg-[#0062FF] text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                onClick={backup}>Xác nhận sao lưu mã hóa lên server</button>
            </>
          )}
        </div>
      )}

      {confirmed && pendingCode && (
        <div className="p-3 border border-emerald-300 rounded-xl space-y-2">
          <p className="text-xs text-emerald-600 font-semibold">
            Sao lưu thành công. Đây là lần cuối mã được hiển thị.
          </p>
          <div className="break-all select-text font-mono text-xs p-2 rounded bg-slate-100 dark:bg-slate-800">
            {pendingCode}
          </div>
          <button type="button" className="text-xs text-[#0062FF] flex items-center gap-1"
            onClick={async () => { try { await navigator.clipboard.writeText(pendingCode); } catch { setError('Hãy sao chép mã thủ công.'); } }}>
            <Copy size={14} /> Sao chép lại mã khôi phục
          </button>
        </div>
      )}

      {state?.hasServerKey && !state.matches && state.hasVault && (
        <div className="p-3 border rounded-xl space-y-2">
          <p className="text-xs font-semibold text-amber-600">
            Trình duyệt chưa có private key đúng. Nhập mã khôi phục đã lưu khi sao lưu.
          </p>
          <input type="password" autoComplete="off" value={restoreCode}
            onChange={e => setRestoreCode(e.target.value)}
            className="w-full p-2 rounded-lg text-xs border bg-transparent dark:border-slate-600"
            placeholder="Mã khôi phục 8 nhóm ký tự" />
          <button type="button" disabled={busy || !restoreCode.trim()}
            className="px-3 py-2 bg-[#0062FF] text-white rounded-lg text-xs font-semibold disabled:opacity-50"
            onClick={restore}>Khôi phục và tải lại hội thoại</button>
        </div>
      )}

      {state?.hasServerKey && !state.matches && !state.hasVault && (
        <p className="text-xs text-rose-600 flex items-start gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          Tài khoản cũ chưa có vault và máy này không có private key gốc.
          Hãy mở lại profile trình duyệt đã tạo khóa ban đầu để sao lưu.
          Không xóa public key hay ghi đè dữ liệu trên server.
        </p>
      )}

      <button type="button" disabled={busy} onClick={loadStatus}
        className="text-xs text-slate-500 flex items-center gap-1 disabled:opacity-50">
        <RefreshCw size={13} /> Kiểm tra lại trạng thái khóa
      </button>
    </section>
  );
}
