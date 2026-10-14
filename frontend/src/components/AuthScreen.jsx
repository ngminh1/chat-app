import { useState, useRef } from 'react';
import axios from 'axios';
import {
  Loader2,
  X,
  Sun,
  Moon,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Camera,
  Plus
} from 'lucide-react';
import { API_BASE } from '../config/api';
import DispatchLogo from './DispatchLogo';

export default function AuthScreen({ onLoginSuccess, isDarkMode, onToggleDarkMode }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const avatarInputRef = useRef(null);

  // Tính toán độ mạnh mật khẩu khi đăng ký
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '', text: '' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[0-9]/.test(pass) && /[a-zA-Z]/.test(pass)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
        return { score: 1, label: 'Yếu', color: 'bg-rose-500', text: 'text-rose-500' };
      case 2:
        return { score: 2, label: 'Trung bình', color: 'bg-amber-500', text: 'text-amber-500' };
      case 3:
        return { score: 3, label: 'Khá mạnh', color: 'bg-blue-500', text: 'text-blue-500' };
      case 4:
        return { score: 4, label: 'Rất mạnh', color: 'bg-emerald-500', text: 'text-emerald-500' };
      default:
        return { score: 0, label: '', color: '', text: '' };
    }
  };

  const passwordStrength = getPasswordStrength(password);

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const removeAvatar = () => {
    setSelectedAvatarFile(null);
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(null);
    }
  };

  const switchMode = (loginMode) => {
    setIsLogin(loginMode);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isLogin && !displayName.trim()) {
      setErrorMsg('Vui lòng nhập tên hiển thị');
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const res = await axios.post(`${API_BASE}/auth/login`, {
          username: username.trim(),
          password: password.trim()
        });
        onLoginSuccess(res.data);
      } else {
        let uploadedAvatarUrl = null;

        if (selectedAvatarFile) {
          setIsUploadingAvatar(true);
          const formData = new FormData();
          formData.append('file', selectedAvatarFile);
          const uploadRes = await axios.post(`${API_BASE}/media/upload`, formData, {
            params: { purpose: 'avatar' },
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          uploadedAvatarUrl = uploadRes.data.fileUrl;
        }

        await axios.post(`${API_BASE}/auth/register`, {
          username: username.trim(),
          password: password.trim(),
          displayName: displayName.trim(),
          avatarUrl: uploadedAvatarUrl
        });

        setSuccessMsg(`Tạo tài khoản "${username.trim()}" thành công. Vui lòng đăng nhập.`);
        setIsLogin(true);
        setPassword('');
        setDisplayName('');
        removeAvatar();
      }
    } catch (err) {
      const msg = typeof err.response?.data === 'string'
        ? err.response.data
        : err.response?.data?.message || 'Có lỗi xảy ra. Vui lòng kiểm tra lại thông tin.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setIsUploadingAvatar(false);
    }
  };

  return (
    <div className={`min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative select-none transition-colors ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Nút bật/tắt Chế độ sáng/tối */}
      <button
        onClick={onToggleDarkMode}
        className="absolute top-5 right-5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer"
        title={isDarkMode ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      >
        {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Khung Card chính căn giữa màn hình */}
      <div className="w-full max-w-[400px] mx-auto p-7 md:p-8 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center">
        {/* Brand Logo: Chữ D lớn ở trên, Dispatch ở dưới, căn giữa */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3 hover:scale-105 transition-transform">
            <DispatchLogo size={58} showText={true} layout="vertical" />
          </div>
          <h1 className="text-base font-bold tracking-tight text-slate-800 dark:text-slate-200">
            {isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isLogin ? 'Đăng nhập vào tài khoản của bạn' : 'Bắt đầu sử dụng Dispatch ngay hôm nay'}
          </p>
        </div>

        {/* Thông báo thành công */}
        {successMsg && (
          <div className="w-full mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Thông báo lỗi validation */}
        {errorMsg && (
          <div className="w-full mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form nhập liệu */}
        <form onSubmit={handleSubmit} className="w-full space-y-3.5">
          {/* Avatar đính kèm nút + */}
          {!isLogin && (
            <div className="flex flex-col items-center justify-center pb-1">
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <div
                  className={`w-18 h-18 rounded-full border-2 border-dashed flex flex-col items-center justify-center overflow-hidden transition-all ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-800/60 hover:border-[#0062FF] hover:bg-slate-800'
                      : 'border-slate-300 bg-slate-50 hover:border-[#0062FF] hover:bg-blue-50/40'
                  }`}
                >
                  {avatarPreviewUrl ? (
                    <img src={avatarPreviewUrl} alt="Xem trước" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-6 h-6 text-slate-400 group-hover:text-[#0062FF] transition-colors" />
                  )}
                </div>

                {/* Badge dấu + gợi ý upload */}
                {!avatarPreviewUrl ? (
                  <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#0062FF] text-white flex items-center justify-center shadow-xs border-2 border-white dark:border-slate-900 group-hover:scale-110 transition-transform">
                    <Plus className="w-3 h-3 stroke-[3]" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAvatar();
                    }}
                    className="absolute -top-1 -right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 shadow-xs transition-colors cursor-pointer"
                    title="Xóa ảnh"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <span className="text-xs text-slate-400 mt-2 font-medium">Ảnh đại diện (không bắt buộc)</span>
            </div>
          )}

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên hiển thị
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Nguyễn Văn A"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition-all focus:outline-none focus:border-[#0062FF] focus:ring-1 focus:ring-[#0062FF]/20 ${
                  errorMsg && !displayName.trim()
                    ? 'border-rose-500'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500`}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tên đăng nhập
            </label>
            <input
              type="text"
              required
              autoComplete="username"
              placeholder="Nhập tên đăng nhập..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs border transition-all focus:outline-none focus:border-[#0062FF] focus:ring-1 focus:ring-[#0062FF]/20 ${
                errorMsg && !username.trim()
                  ? 'border-rose-500'
                  : 'border-slate-200 dark:border-slate-800'
              } bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-3.5 pr-10 py-2.5 rounded-xl text-xs border transition-all focus:outline-none focus:border-[#0062FF] focus:ring-1 focus:ring-[#0062FF]/20 ${
                  errorMsg && !password.trim()
                    ? 'border-rose-500'
                    : 'border-slate-200 dark:border-slate-800'
                } bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Thanh đo độ mạnh mật khẩu khi đăng ký */}
            {!isLogin && password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Độ mạnh mật khẩu:</span>
                  <span className={`font-semibold ${passwordStrength.text}`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 h-1.5">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`h-full rounded-full transition-colors ${
                        step <= passwordStrength.score
                          ? passwordStrength.color
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || isUploadingAvatar}
            className="w-full h-10 bg-[#0062FF] hover:bg-[#0052D9] text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
          >
            {loading || isUploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLogin ? (
              'Đăng nhập'
            ) : (
              'Tạo tài khoản'
            )}
          </button>
        </form>

        {/* Chuyển đổi giữa Đăng nhập và Đăng ký */}
        <div className="mt-4 text-center">
          {isLogin ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chưa có tài khoản?{' '}
              <button
                type="button"
                onClick={() => switchMode(false)}
                className="font-semibold text-[#0062FF] hover:underline cursor-pointer"
              >
                Tạo tài khoản mới
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Đã có tài khoản?{' '}
              <button
                type="button"
                onClick={() => switchMode(true)}
                className="font-semibold text-[#0062FF] hover:underline cursor-pointer"
              >
                Đăng nhập ngay
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
