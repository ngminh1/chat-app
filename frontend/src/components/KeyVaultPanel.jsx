import { useState } from 'react';
import { ShieldCheck, KeyRound, Copy, AlertCircle, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { generateRecoveryCode } from '../utils/keyVault';
import { createElGamalVaultBackup, recoverElGamalIdentity } from '../utils/aesKeyManager';

/**
 * Màn hình bảo vệ lịch sử chat khi đăng nhập. Không xuất hiện trong Profile.
 * Chỉ hiện khi thiết lập lần đầu hoặc thiết bị mới cần khôi phục.
 */
export default function KeyVaultPanel({
  mode,
  userId,
  onReady,
  onLogout,
  onRetry,
  errorText = '',
  isDarkMode = false
}) {
  const [recoveryCode, setRecoveryCode] = useState('');
  const [confirmedSave, setConfirmedSave] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const backup = async () => {
    if (!recoveryCode || !confirmedSave || busy) return;
    setBusy(true);
    setError('');
    try {
      await createElGamalVaultBackup(userId, recoveryCode);
      onReady();
    } catch (err) {
      setError(typeof err.response?.data === 'string'
        ? err.response.data
        : err.message || 'Không thể lưu bản sao lưu. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!restoreCode.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await recoverElGamalIdentity(userId, restoreCode.trim());
      setRestoreCode('');
      onReady();
    } catch (err) {
      setError(err.message === 'WRONG_RECOVERY_CODE_OR_DAMAGED_VAULT'
        ? 'Mã khôi phục không đúng hoặc bản sao lưu đã hỏng.'
        : err.message || 'Không thể khôi phục lịch sử tin nhắn.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
    } catch {
      setError('Không sao chép tự động được. Hãy chọn và sao chép mã bằng tay.');
    }
  };

  const title = mode === 'setup'
    ? 'Bảo vệ lịch sử tin nhắn'
    : mode === 'recover'
      ? 'Khôi phục tin nhắn'
      : mode === 'missing'
        ? 'Không thể mở lịch sử trên thiết bị này'
        : mode === 'error'
          ? 'Chưa thể kết nối'
          : 'Đang chuẩn bị tài khoản';

  return (
    <main className={isDarkMode
      ? 'dark min-h-[100dvh] bg-slate-950 text-slate-100 flex items-center justify-center p-5'
      : 'min-h-[100dvh] bg-slate-50 text-slate-900 flex items-center justify-center p-5'}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 space-y-4">
        <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950 text-[#0062FF]">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold">{title}</h1>

        {mode === 'checking' && (
          <p className="text-sm text-slate-500 flex gap-2 items-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang kiểm tra dữ liệu bảo mật...
          </p>
        )}

        {mode === 'setup' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Lưu mã khôi phục một lần để tiếp tục đọc tin nhắn khi đổi máy hoặc trình duyệt.
              Mã này chỉ hiển thị cho bạn và không được gửi lên máy chủ.
            </p>
            {!recoveryCode ? (
              <button type="button" onClick={() => setRecoveryCode(generateRecoveryCode())}
                className="bg-[#0062FF] hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 text-sm font-semibold">
                <KeyRound className="w-4 h-4 inline mr-2" /> Tạo mã khôi phục
              </button>
            ) : (
              <>
                <div className="break-all select-text font-mono text-sm p-3 bg-slate-100 dark:bg-slate-800 rounded-lg" aria-label="Mã khôi phục">
                  {recoveryCode}
                </div>
                <button type="button" onClick={copyCode}
                  className="text-sm text-[#0062FF] font-semibold flex gap-2 items-center">
                  <Copy className="w-4 h-4" /> Sao chép mã
                </button>
                <label className="flex gap-2 items-start text-sm cursor-pointer">
                  <input type="checkbox" checked={confirmedSave}
                    onChange={(event) => setConfirmedSave(event.target.checked)}
                    className="mt-1" />
                  <span>Tôi đã lưu mã này ở nơi an toàn. Tôi hiểu không thể khôi phục tin nhắn nếu mất cả mã và khóa trên các thiết bị.</span>
                </label>
                <button type="button" disabled={!confirmedSave || busy} onClick={backup}
                  className="w-full bg-[#0062FF] text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
                  {busy ? 'Đang bảo vệ tin nhắn...' : 'Hoàn tất và vào Dispatch'}
                </button>
              </>
            )}
          </div>
        )}

        {mode === 'recover' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Đây là thiết bị hoặc trình duyệt mới. Nhập mã khôi phục mà bạn đã lưu để đọc lại tin nhắn cũ.
            </p>
            <input type="password" autoComplete="off" value={restoreCode}
              onChange={(event) => setRestoreCode(event.target.value)}
              placeholder="Nhập mã khôi phục" aria-label="Mã khôi phục"
              className="w-full border border-slate-300 dark:border-slate-700 bg-transparent rounded-xl p-3 text-sm" />
            <button type="button" disabled={!restoreCode.trim() || busy} onClick={restore}
              className="w-full bg-[#0062FF] text-white rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {busy ? 'Đang khôi phục...' : 'Khôi phục và vào Dispatch'}
            </button>
          </div>
        )}

        {mode === 'missing' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Tài khoản này đã có dữ liệu được mã hóa nhưng chưa từng sao lưu mã khôi phục.
              Hãy mở trình duyệt cũ từng đọc được tin nhắn, đăng nhập và thực hiện bước sao lưu.
              Sau đó quay lại thiết bị này để khôi phục.
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Không xóa dữ liệu trình duyệt cũ hoặc đặt lại khóa: thao tác đó có thể khiến mất lịch sử vĩnh viễn.
            </p>
          </div>
        )}

        {mode === 'error' && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {errorText || 'Máy chủ tạm thời chưa phản hồi. Hãy thử lại.'}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {String(error)}
          </p>
        )}

        {mode !== 'checking' && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center gap-3">
            <button type="button" onClick={onLogout}
              className="text-sm text-slate-500 flex gap-1.5 items-center">
              <LogOut className="w-4 h-4" /> Đổi tài khoản
            </button>
            <button type="button" onClick={onRetry} disabled={busy}
              className="text-sm text-[#0062FF] flex gap-1.5 items-center disabled:opacity-50">
              <RefreshCw className="w-4 h-4" /> Thử lại
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
