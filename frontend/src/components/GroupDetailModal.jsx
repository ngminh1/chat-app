import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Users,
  UserPlus,
  LogOut,
  Trash2,
  Shield,
  Edit2,
  Check,
  Loader2,
  Search,
  Palette,
  FolderOpen
} from 'lucide-react';
import { CHAT_THEMES } from '../utils/themeConfig';
import { API_BASE } from '../config/api';
import { publicMediaUrl } from '../utils/mediaAccess';

export default function GroupDetailModal({
  isOpen,
  onClose,
  conversation,
  currentUserId,
  onGroupUpdated,
  onLeftGroup,
  onOpenMediaGallery,
  isDarkMode
}) {
  const [members, setMembers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('blue');

  const isGroup = conversation?.type === 'GROUP';
  const targetAvatarUrl = conversation?.avatarUrl || conversation?.otherUser?.avatarUrl;
  const targetTitle = conversation?.title || conversation?.otherUser?.displayName || 'U';

  const fetchMembers = async () => {
    if (!conversation) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/chat/conversations/${conversation.conversationId}/members`);
      setMembers(res.data);
    } catch (err) {
      console.error("Lỗi lấy danh sách thành viên:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await axios.get(`${API_BASE}/friends/${currentUserId}`);
      setFriends(res.data);
    } catch (err) {
      console.error("Lỗi lấy danh sách bạn bè:", err);
    }
  };

  useEffect(() => {
    if (isOpen && conversation) {
      setNewTitle(conversation.title || '');
      setSelectedTheme(conversation.theme || 'blue');
      setIsEditingTitle(false);
      setIsAddingMember(false);
      setFriendSearch('');
      if (isGroup) {
        fetchMembers();
        fetchFriends();
      }
    }
  }, [isOpen, conversation]);

  if (!isOpen || !conversation) return null;

  const currentMemberObj = members.find((m) => m.userId === currentUserId);
  const isAdmin = currentMemberObj?.role === 'ADMIN';

  const handleChangeTheme = async (themeKey) => {
    setSelectedTheme(themeKey);
    onGroupUpdated({ ...conversation, theme: themeKey });

    try {
      const res = await axios.put(
        `${API_BASE}/chat/conversations/${conversation.conversationId}/theme`,
        null,
        { params: { theme: themeKey } }
      );
      onGroupUpdated(res.data);
    } catch (err) {
      console.error("Lỗi đổi theme:", err);
    }
  };

  const handleUpdateTitle = async () => {
    if (!newTitle.trim()) return;
    setActionLoading(true);
    try {
      const res = await axios.put(
        `${API_BASE}/chat/conversations/${conversation.conversationId}/group-info`,
        { title: newTitle.trim() },
        { params: { currentUserId } }
      );
      setIsEditingTitle(false);
      onGroupUpdated(res.data);
    } catch (err) {
      console.error("Lỗi đổi tên nhóm:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async (targetUserId) => {
    setActionLoading(true);
    try {
      await axios.post(
        `${API_BASE}/chat/conversations/${conversation.conversationId}/members`,
        null,
        { params: { currentUserId, targetUserId } }
      );
      await fetchMembers();
      setIsAddingMember(false);
    } catch (err) {
      alert(err.response?.data?.message || "Không thể thêm thành viên");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (targetUserId, targetName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${targetName}" khỏi nhóm?`)) return;
    setActionLoading(true);
    try {
      await axios.delete(
        `${API_BASE}/chat/conversations/${conversation.conversationId}/members/${targetUserId}`,
        { params: { currentUserId } }
      );
      await fetchMembers();
    } catch (err) {
      alert(err.response?.data?.message || "Không thể xóa thành viên");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này?")) return;
    setActionLoading(true);
    try {
      await axios.post(
        `${API_BASE}/chat/conversations/${conversation.conversationId}/leave`,
        null,
        { params: { userId: currentUserId } }
      );
      onLeftGroup(conversation.conversationId);
      onClose();
    } catch (err) {
      console.error("Lỗi rời nhóm:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const availableFriendsToAdd = friends.filter(
    (f) =>
      !members.some((m) => m.userId === f.user.id) &&
      (f.user.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
        f.user.username.toLowerCase().includes(friendSearch.toLowerCase()))
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 border ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'
        }`}>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0062FF]" />
            {isGroup ? 'Thông tin nhóm' : 'Thông tin cuộc trò chuyện'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Avatar & Tên hội thoại */}
          <div className="flex flex-col items-center text-center">
            {targetAvatarUrl ? (
              <img
                src={publicMediaUrl(targetAvatarUrl)}
                alt=""
                className="w-16 h-16 rounded-full object-cover border border-slate-200 dark:border-slate-700 shadow-xs mb-2.5 flex-shrink-0"
              />
            ) : (
              <div className={`w-16 h-16 rounded-full text-white flex items-center justify-center font-bold text-xl shadow-xs mb-2.5 flex-shrink-0 ${
                isGroup ? 'bg-gradient-to-tr from-purple-600 to-indigo-500' : 'bg-gradient-to-tr from-[#0062FF] to-sky-400'
              }`}>
                {targetTitle.charAt(0).toUpperCase()}
              </div>
            )}

            {isGroup ? (
              isEditingTitle ? (
                <div className="flex items-center gap-2 w-full max-w-xs">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold border rounded-lg focus:outline-none dark:bg-slate-800 dark:border-slate-700"
                    autoFocus
                  />
                  <button onClick={handleUpdateTitle} disabled={actionLoading} className="p-1.5 bg-[#0062FF] text-white rounded-lg cursor-pointer">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIsEditingTitle(false)} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold">{conversation.title}</h3>
                  <button onClick={() => setIsEditingTitle(true)} className="p-1 text-slate-400 hover:text-[#0062FF] cursor-pointer">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            ) : (
              <div>
                <h3 className="text-base font-bold">{conversation.otherUser?.displayName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">@{conversation.otherUser?.username}</p>
              </div>
            )}
          </div>

          {/* Nút vào kho Media */}
          <button
            onClick={() => {
              onClose();
              onOpenMediaGallery();
            }}
            className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer ${
              isDarkMode ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 text-slate-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            <span className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#0062FF]" />
              Kho lưu trữ hình ảnh & tệp đính kèm
            </span>
            <span className="text-[#0062FF]">Xem tất cả →</span>
          </button>

          {/* Đổi màu chủ đề */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Chủ đề cuộc trò chuyện (Theme)
            </h4>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {Object.values(CHAT_THEMES).map((theme) => {
                const isSelected = selectedTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleChangeTheme(theme.id)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-[#0062FF] bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-[#0062FF] shadow-xs'
                        : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="w-8 h-8 rounded-full shadow-xs transition-transform hover:scale-110 flex items-center justify-center text-white"
                      style={{ backgroundColor: theme.colorCode }}
                    >
                      {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate w-full text-center">
                      {theme.name.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quản lý thành viên nếu là nhóm */}
          {isGroup && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Thành viên ({members.length})
                </h4>
                <button
                  onClick={() => setIsAddingMember(!isAddingMember)}
                  className="text-xs font-semibold text-[#0062FF] flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Thêm thành viên
                </button>
              </div>

              {isAddingMember && (
                <div className={`p-3 border rounded-xl space-y-2 ${
                  isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-blue-50/50 border-blue-100'
                }`}>
                  <div className="relative">
                    <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm bạn bè..."
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      className={`w-full pl-7 pr-3 py-1.5 rounded-lg text-xs focus:outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                      }`}
                    />
                  </div>

                  <div className={`max-h-36 overflow-y-auto divide-y rounded-lg border p-1 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 divide-slate-800' : 'bg-white border-slate-100 divide-slate-100'
                  }`}>
                    {availableFriendsToAdd.length === 0 ? (
                      <p className="text-center py-4 text-[11px] text-slate-400">Không có bạn bè khả dụng</p>
                    ) : (
                      availableFriendsToAdd.map((f) => (
                        <div key={f.id} className="p-2 flex items-center justify-between">
                          <div className="truncate pr-2">
                            <p className="text-xs font-semibold truncate">{f.user.displayName}</p>
                            <p className="text-[10px] text-slate-400">@{f.user.username}</p>
                          </div>
                          <button
                            onClick={() => handleAddMember(f.user.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 bg-[#0062FF] text-white text-[11px] font-semibold rounded-lg cursor-pointer"
                          >
                            Thêm
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className={`divide-y border rounded-xl p-1 ${
                isDarkMode ? 'border-slate-800 divide-slate-800 bg-slate-900/50' : 'border-slate-100 divide-slate-100 bg-slate-50/30'
              }`}>
                {loading ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin text-[#0062FF] mx-auto mb-1" />
                    Đang tải danh sách...
                  </div>
                ) : (
                  members.map((m) => (
                    <div key={m.userId} className="p-2.5 flex items-center justify-between rounded-lg">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {m.avatarUrl ? (
                          <img src={publicMediaUrl(m.avatarUrl)} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {m.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate">{m.displayName}</span>
                            {m.role === 'ADMIN' && (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-[#0062FF] text-[9px] font-bold rounded flex items-center gap-0.5">
                                <Shield className="w-2.5 h-2.5" /> Quản trị viên
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">@{m.username}</span>
                        </div>
                      </div>

                      {isAdmin && m.userId !== currentUserId && (
                        <button
                          onClick={() => handleRemoveMember(m.userId, m.displayName)}
                          disabled={actionLoading}
                          className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                          title="Xóa khỏi nhóm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {isGroup && (
            <div className="pt-2">
              <button
                onClick={handleLeaveGroup}
                disabled={actionLoading}
                className="w-full py-2.5 text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Rời khỏi nhóm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
