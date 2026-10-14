import { useState, useEffect, useRef } from 'react';
import { useAuthSession } from '../context/sessionContext';
import { X, User, Camera, Save, Loader2, Volume2, Bell, MessageSquare } from 'lucide-react';
import { requestNotificationPermission } from '../utils/browserNotifications';
import { API_BASE } from '../config/api';
import { publicMediaUrl } from '../utils/mediaAccess';

export default function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
  settings,
  onUpdateSettings
}) {
  const session = useAuthSession();
  const api = session.api;
  const [displayName, setDisplayName] = useState('');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState('');
  
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const fileInputRef = useRef(null);
  const closeTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(closeTimerRef.current), []);

  useEffect(() => {
    if (currentUser && isOpen) {
      setDisplayName(currentUser.displayName || '');
      setCurrentAvatarUrl(currentUser.avatarUrl || '');
      setSelectedAvatarFile(null);
      setAvatarPreviewUrl(null);
      setMessage({ type: '', text: '' });
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session.isActive()) return;
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: 'Tên hiển thị không được để trống' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      let finalAvatarUrl = currentAvatarUrl;

      if (selectedAvatarFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', selectedAvatarFile);

        const uploadRes = await api.post(`${API_BASE}/media/upload`, formData, {
          params: { purpose: 'avatar' },
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (!session.isActive()) return;
        finalAvatarUrl = uploadRes.data.fileUrl;
      }

      const res = await api.put(`${API_BASE}/users/${currentUser.id}`, {
        displayName: displayName.trim(),
        avatarUrl: finalAvatarUrl
      });

      if (!session.isActive()) return;
      onProfileUpdated(res.data);
      setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
      closeTimerRef.current = setTimeout(() => {
        if (session.isActive()) onClose();
      }, 1000);
    } catch (err) {
      if (!session.isActive()) return;
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật thông tin'
      });
    } finally {
      if (session.isActive()) {
        setIsLoading(false);
        setIsUploading(false);
      }
    }
  };

  const handleToggleDesktopNotif = async () => {
    if (!settings.desktopNotifications) {
      const perm = await requestNotificationPermission();
      if (!session.isActive()) return;
      if (perm === 'granted') {
        onUpdateSettings({ ...settings, desktopNotifications: true });
      } else {
        alert("Bạn đã từ chối quyền thông báo trên trình duyệt. Vui lòng cho phép quyền trong cài đặt trang web!");
      }
    } else {
      onUpdateSettings({ ...settings, desktopNotifications: false });
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <h2 className="text-sm font-bold">Cài đặt tài khoản & Thông báo</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {message.text && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold ${
                message.type === 'error'
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-900'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-900'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {avatarPreviewUrl ? (
                  <img
                    src={avatarPreviewUrl}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#0062FF] shadow-xs"
                  />
                ) : currentAvatarUrl ? (
                  <img
                    src={publicMediaUrl(currentAvatarUrl)}
                    alt=""
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#0062FF] shadow-xs"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#0062FF] to-sky-400 text-white flex items-center justify-center font-bold text-2xl shadow-xs">
                    {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span className="text-[9px] font-semibold">Đổi ảnh</span>
                </div>
              </div>
              <span className="text-xs text-slate-400 font-medium">@{currentUser.username}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên hiển thị
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nhập tên hiển thị..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-[#0062FF] transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || isUploading}
              className="w-full py-2.5 bg-[#0062FF] hover:bg-[#0052D9] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading || isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Lưu thay đổi
            </button>
          </form>

          {/* Cài đặt Thông báo & Âm thanh */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Cài đặt Thông báo & Âm thanh
            </h3>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950 text-[#0062FF] flex items-center justify-center">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Âm thanh tin nhắn</p>
                  <p className="text-[10px] text-slate-400">Phát chuông thông báo khi nhận & gửi tin</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.soundEnabled}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, soundEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0062FF]"></div>
              </label>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Thông báo máy tính</p>
                  <p className="text-[10px] text-slate-400">Nhận thông báo khi tab đang ẩn hoặc thu nhỏ</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.desktopNotifications}
                  onChange={handleToggleDesktopNotif}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0062FF]"></div>
              </label>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Thông báo nổi trong ứng dụng</p>
                  <p className="text-[10px] text-slate-400">Hiển thị thông báo nhanh tin nhắn từ người khác</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.inAppToast}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, inAppToast: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0062FF]"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
