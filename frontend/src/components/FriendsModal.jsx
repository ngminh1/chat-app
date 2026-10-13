import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  X,
  Users,
  UserCheck,
  Clock,
  MessageSquare,
  Check,
  UserMinus,
  Loader2,
  Inbox
} from 'lucide-react';
import { API_BASE } from '../config/api';

export default function FriendsModal({
  isOpen,
  onClose,
  currentUserId,
  onStartChatWithUser,
  isDarkMode
}) {
  const [activeTab, setActiveTab] = useState('friends');
  const [friendsList, setFriendsList] = useState([]);
  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

const fetchFriendsAndRequests = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        axios.get(`${API_BASE}/friends/${currentUserId}`),
        axios.get(`${API_BASE}/friends/pending/${currentUserId}`)
      ]);
      setFriendsList(friendsRes.data || []);
      setPendingList(pendingRes.data || []);
    } catch (err) {
      console.error("Lỗi lấy danh sách bạn bè / lời mời:", err);
    } finally {
      setLoading(false);
    }
}, [currentUserId]);

useEffect(() => {
  if (isOpen) {
    fetchFriendsAndRequests();
  }
}, [isOpen, fetchFriendsAndRequests]);

  if (!isOpen) return null;

  const handleAcceptRequest = async (friendshipId) => {
    setActionLoadingId(friendshipId);
    try {
      await axios.put(`${API_BASE}/friends/${friendshipId}/accept`);
      await fetchFriendsAndRequests();
    } catch  {
      alert("Lỗi khi chấp nhận lời mời");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeclineRequest = async (friendshipId) => {
    setActionLoadingId(friendshipId);
    try {
      await axios.put(`${API_BASE}/friends/${friendshipId}/decline`);
      await fetchFriendsAndRequests();
    } catch {
      alert("Lỗi khi từ chối lời mời");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUnfriend = async (friendshipId, targetName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy kết bạn với "${targetName}"?`)) return;
    setActionLoadingId(friendshipId);
    try {
      await axios.delete(`${API_BASE}/friends/${friendshipId}`);
      await fetchFriendsAndRequests();
    } catch {
      alert("Lỗi khi hủy kết bạn");
    } finally {
      setActionLoadingId(null);
    }
  };

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
        {/* Header Modal */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'
        }`}>
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0062FF]" />
            Danh bạ bạn bè & Lời mời
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2 Tabs: Bạn bè & Lời mời */}
        <div className={`flex border-b px-5 pt-2 gap-4 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <button
            onClick={() => setActiveTab('friends')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'friends'
                ? 'border-[#0062FF] text-[#0062FF]'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Bạn bè ({friendsList.length})
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-all cursor-pointer relative ${
              activeTab === 'pending'
                ? 'border-[#0062FF] text-[#0062FF]'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Lời mời kết bạn
            {pendingList.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-bold">
                {pendingList.length}
              </span>
            )}
          </button>
        </div>

        {/* Nội dung danh sách */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="text-center py-12 text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#0062FF] mx-auto mb-2" />
              Đang tải danh sách...
            </div>
          ) : activeTab === 'friends' ? (
            friendsList.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Bạn chưa có bạn bè nào. Hãy dùng thanh tìm kiếm để kết bạn!
              </div>
            ) : (
              friendsList.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    isDarkMode ? 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/80' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.user.avatarUrl ? (
                      <img src={item.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0062FF] to-sky-400 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {item.user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="truncate">
                      <p className="text-xs font-semibold truncate leading-tight">{item.user.displayName}</p>
                      <p className="text-[10px] text-slate-400 truncate">@{item.user.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        onClose();
                        onStartChatWithUser(item.user);
                      }}
                      className="p-2 bg-[#0062FF] hover:bg-[#0052D9] text-white rounded-lg transition-colors cursor-pointer"
                      title="Nhắn tin ngay"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleUnfriend(item.id, item.user.displayName)}
                      disabled={actionLoadingId === item.id}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Hủy kết bạn"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            pendingList.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Không có lời mời kết bạn nào đang chờ
              </div>
            ) : (
              pendingList.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                    isDarkMode ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.user.avatarUrl ? (
                      <img src={item.user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {item.user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="truncate">
                      <p className="text-xs font-semibold truncate leading-tight">{item.user.displayName}</p>
                      <p className="text-[10px] text-slate-400 truncate">@{item.user.username} đã gửi lời mời</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAcceptRequest(item.id)}
                      disabled={actionLoadingId === item.id}
                      className="px-3 py-1.5 bg-[#0062FF] hover:bg-[#0052D9] text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Đồng ý
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(item.id)}
                      disabled={actionLoadingId === item.id}
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Từ chối
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
}