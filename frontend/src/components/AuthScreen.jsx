import React, { useState, useRef } from 'react';
import axios from 'axios';
import {
  MessageSquare,
  Lock,
  User,
  Camera,
  ArrowRight,
  Loader2,
  X,
  Sun,
  Moon,
  CheckCircle2,
  Eye,
  EyeOff
} from 'lucide-react';
import { API_BASE } from '../config/api';

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isLogin && !displayName.trim()) {
      setErrorMsg('Vui lòng nhập tên hiển thị!');
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

        setSuccessMsg(`Đăng ký tài khoản "${username.trim()}" thành công! Vui lòng nhập mật khẩu để đăng nhập.`);
        setIsLogin(true);
        setPassword('');
        setDisplayName('');
        removeAvatar();
      }
    } catch (err) {
      const msg = typeof err.response?.data === 'string'
        ? err.response.data
        : err.response?.data?.message || 'Có lỗi xảy ra khi xử lý';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
      setIsUploadingAvatar(false);
    }
  };

  const handleQuickLogin = (demoUser) => {
    setUsername(demoUser);
    setPassword('123456');
    setErrorMsg('');
    setSuccessMsg('');
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative select-none transition-colors duration-300 ${
      isDarkMode
        ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100'
        : 'bg-gradient-to-br from-slate-100 via-sky-50 to-blue-100 text-slate-900'
    }`}>
      <button
        onClick={onToggleDarkMode}
        className={`absolute top-6 right-6 p-3 rounded-full shadow-lg border backdrop-blur-md transition-all cursor-pointer ${
          isDarkMode
            ? 'bg-slate-800/80 border-slate-700 text-amber-400 hover:bg-slate-700'
            : 'bg-white/80 border-slate-200 text-slate-700 hover:bg-white'
        }`}
        title={isDarkMode ? 'Chuyển sang Chế độ Sáng' : 'Chuyển sang Chế độ Tối'}
      >
        {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className={`w-full max-w-md p-8 rounded-3xl shadow-2xl border backdrop-blur-xl animate-in zoom-in-95 duration-200 ${
        isDarkMode
          ? 'bg-slate-900/60 border-slate-800 text-white'
          : 'bg-white/80 border-white/60 text-slate-900'
      }`}>
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-tr from-[#0084FF] to-sky-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
            <MessageSquare className="w-8 h-8 text-white stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ChatApp Realtime</h1>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Kết nối và trò chuyện tức thì
          </p>
        </div>

        <div className={`flex p-1 rounded-xl mb-6 ${isDarkMode ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
          <button
            type="button"
            onClick={() => { setIsLogin(true); setErrorMsg(''); setSuccessMsg(''); setPassword(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              isLogin
                ? 'bg-[#0084FF] text-white shadow-md'
                : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setErrorMsg(''); setSuccessMsg(''); setPassword(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              !isLogin
                ? 'bg-[#0084FF] text-white shadow-md'
                : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đăng ký
          </button>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 text-center font-medium flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-500 dark:text-red-400 text-center font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="flex flex-col items-center justify-center mb-2">
              <input
                type="file"
                ref={avatarInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <div className="relative group">
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className={`w-20 h-20 rounded-full border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-800/50 hover:border-[#0084FF]'
                      : 'border-slate-300 bg-slate-50 hover:border-[#0084FF]'
                  }`}
                >
                  {avatarPreviewUrl ? (
                    <img src={avatarPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-400 hover:text-[#0084FF]">
                      <Camera className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-medium">Tải ảnh</span>
                    </div>
                  )}
                </div>

                {avatarPreviewUrl && (
                  <button
                    type="button"
                    onClick={removeAvatar}
                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <span className={`text-[11px] mt-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Ảnh đại diện (không bắt buộc)
              </span>
            </div>
          )}

          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Tên đăng nhập
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                autoComplete="username"
                placeholder="Nhập tên đăng nhập..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:border-[#0084FF] ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:border-[#0084FF] ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 cursor-pointer"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Tên hiển thị <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: User 1..."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl text-sm border transition-all focus:outline-none focus:border-[#0084FF] ${
                  isDarkMode
                    ? 'bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || isUploadingAvatar}
            className="w-full py-3 bg-[#0084FF] hover:bg-blue-600 text-white font-semibold text-sm rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 cursor-pointer"
          >
            {loading || isUploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isLogin ? (
              'Đăng nhập ngay'
            ) : (
              'Tạo tài khoản'
            )}
            {!loading && !isUploadingAvatar && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className={`mt-6 pt-5 border-t text-center ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <p className={`text-[11px] mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Đăng nhập nhanh tài khoản Test (pass: 123456):
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { u: 'user1', label: 'User 1' },
              { u: 'user2', label: 'User 2' },
              { u: 'user3', label: 'User 3' },
              { u: 'user4', label: 'User 4' }
            ].map((acc) => (
              <button
                key={acc.u}
                type="button"
                onClick={() => handleQuickLogin(acc.u)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors border text-left flex items-center justify-between cursor-pointer ${
                  isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                }`}
              >
                <span className="truncate">{acc.label}</span>
                <span className="text-[10px] text-slate-400 font-mono">@{acc.u}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}