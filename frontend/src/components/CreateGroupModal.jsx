import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Users, Check, Search, Loader2, UserPlus, Camera } from 'lucide-react';
import { API_BASE } from '../config/api';

export default function CreateGroupModal({ isOpen, onClose, currentUserId, onGroupCreated }) {
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState(null);
  
  const [friends, setFriends] = useState([]);
  const [searchFriend, setSearchFriend] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setGroupTitle('');
      setSelectedAvatarFile(null);
      setAvatarPreviewUrl(null);
      setSelectedUserIds([]);
      setSearchFriend('');

      axios.get(`${API_BASE}/friends/${currentUserId}`)
        .then((res) => setFriends(res.data))
        .catch((err) => console.error("Lỗi lấy danh sách bạn:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, currentUserId]);

  if (!isOpen) return null;

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

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const filteredFriends = friends.filter((item) => {
    const term = searchFriend.toLowerCase();
    return (
      item.user.displayName.toLowerCase().includes(term) ||
      item.user.username.toLowerCase().includes(term)
    );
  });

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (selectedUserIds.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      let uploadedAvatarUrl = null;

      if (selectedAvatarFile) {
        const formData = new FormData();
        formData.append('file', selectedAvatarFile);
        const uploadRes = await axios.post(`${API_BASE}/media/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        uploadedAvatarUrl = uploadRes.data.fileUrl;
      }

      const res = await axios.post(`${API_BASE}/chat/conversations/group`, {
        title: groupTitle.trim(),
        avatarUrl: uploadedAvatarUrl,
        creatorId: currentUserId,
        memberIds: selectedUserIds
      });

      onGroupCreated(res.data);
      onClose();
    } catch (err) {
      console.error("Lỗi tạo nhóm:", err);
      alert(err.response?.data?.message || "Không thể tạo nhóm trò chuyện. Vui lòng thử lại!");
    } finally {
      setSubmitting(false);
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-[#0062FF] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Tạo nhóm chat mới</h2>
              <p className="text-[11px] text-slate-400">Tạo không gian trò chuyện cùng bạn bè</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleCreateGroup} className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
          {/* Ảnh nhóm & Tên nhóm */}
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <div className="relative group flex-shrink-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#0062FF] flex flex-col items-center justify-center cursor-pointer overflow-hidden bg-slate-50 dark:bg-slate-800 transition-all"
              >
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-5 h-5 text-slate-400 group-hover:text-[#0062FF]" />
                )}
              </div>
              {avatarPreviewUrl && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên nhóm chat
              </label>
              <input
                type="text"
                placeholder="Nhập tên nhóm trò chuyện..."
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-[#0062FF] transition-all"
              />
            </div>
          </div>

          {/* Chọn thành viên */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Thêm thành viên
              </label>
              <span className="text-xs font-semibold text-[#0062FF] bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-full">
                {selectedUserIds.length} đã chọn
              </span>
            </div>

            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm bạn bè..."
                value={searchFriend}
                onChange={(e) => setSearchFriend(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs focus:outline-none border border-transparent focus:border-slate-300 dark:focus:border-slate-700"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl p-1 bg-slate-50/30 dark:bg-slate-900/40">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#0062FF]" />
                  <span className="text-xs">Đang tải danh sách bạn bè...</span>
                </div>
              ) : friends.length === 0 ? (
                <div className="text-center py-10 px-4 text-xs text-slate-400">
                  <UserPlus className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  Bạn chưa có bạn bè nào. Hãy kết bạn trước khi tạo nhóm!
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Không tìm thấy bạn bè phù hợp
                </div>
              ) : (
                filteredFriends.map((item) => {
                  const isSelected = selectedUserIds.includes(item.user.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelectUser(item.user.id)}
                      className={`p-2.5 flex items-center justify-between rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-950/40'
                          : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.user.avatarUrl ? (
                          <img
                            src={item.user.avatarUrl}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0062FF] to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                            {item.user.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold leading-tight">{item.user.displayName}</p>
                          <p className="text-[11px] text-slate-400">@{item.user.username}</p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'bg-[#0062FF] border-[#0062FF] text-white shadow-xs'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={selectedUserIds.length === 0 || submitting}
              className="flex-1 py-2 bg-[#0062FF] hover:bg-[#0052D9] text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tạo nhóm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}