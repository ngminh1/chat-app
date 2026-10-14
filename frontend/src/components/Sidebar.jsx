import React, { useState, useRef } from 'react';
import {
  Search,
  Users,
  UserPlus,
  LogOut,
  Sun,
  Moon,
  MessageSquarePlus,
  UserCheck,
  Clock,
  MessageSquare,
  SearchX
} from 'lucide-react';
import { formatSidebarTime } from '../utils/formatTime';
import { SidebarSkeleton } from './Skeletons';
import DispatchLogo from './DispatchLogo';

export default function Sidebar({
  currentUser,
  conversations,
  activeConvId,
  onSelectConversation,
  searchQuery,
  onSearchChange,
  searchResults,
  onSelectUserToChat,
  onSendFriendRequest,
  onOpenFriendsModal,
  onOpenProfileModal,
  onOpenCreateGroupModal,
  isDarkMode,
  onToggleDarkMode,
  onLogout,
  presenceMap,
  isLoadingConversations,
  onGoHome
}) {
  // Quản lý độ rộng thanh bên có lưu vào localStorage
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const isResizingRef = useRef(false);

  const startResizing = (e) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent) => {
      if (!isResizingRef.current) return;
      let nextWidth = moveEvent.clientX;
      if (nextWidth < 220) nextWidth = 220;
      if (nextWidth > 480) nextWidth = 480;
      setSidebarWidth(nextWidth);
      localStorage.setItem('sidebar_width', nextWidth);
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <aside
      style={{ '--sidebar-width': `${sidebarWidth}px` }}
      className={`${
        activeConvId ? 'hidden md:flex' : 'flex'
      } w-full md:w-[var(--sidebar-width)] relative flex-col h-full border-r flex-shrink-0 select-none transition-colors duration-200 ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-900'
      }`}
    >
      {/* 1. Header: Brand Bar + Khối Profile User */}
      <div
        className={`p-3 border-b flex flex-col gap-2.5 flex-shrink-0 ${
          isDarkMode ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200/80 bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <div
            onClick={onGoHome}
            className="flex items-center gap-2 cursor-pointer hover:opacity-85 transition-opacity"
            title="Trang chủ Dispatch"
          >
            <DispatchLogo size={26} />
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
              Dispatch
            </span>
          </div>

          <div className="flex items-center gap-0.5">
            <button
              onClick={onToggleDarkMode}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={isDarkMode ? 'Chế độ Sáng' : 'Chế độ Tối'}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={onOpenFriendsModal}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Danh bạ bạn bè"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={onOpenCreateGroupModal}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Tạo nhóm chat"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Khối người dùng */}
        <div
          onClick={onOpenProfileModal}
          className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-xl border cursor-pointer transition-all ${
            isDarkMode
              ? 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800'
              : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100'
          }`}
          title="Cài đặt tài khoản"
        >
          <div className="relative flex-shrink-0">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0062FF] to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-bold truncate leading-tight text-slate-900 dark:text-white">
              {currentUser?.displayName || currentUser?.username}
            </h1>
            <p className="text-[11px] text-slate-400 truncate mt-0.5">@{currentUser?.username}</p>
          </div>
        </div>
      </div>

      {/* 2. Ô tìm kiếm */}
      <div className="p-3 flex-shrink-0">
        <div
          className={`relative flex items-center rounded-xl px-3 py-1.5 border transition-all ${
            isDarkMode
              ? 'bg-slate-800/60 border-slate-700/80 focus-within:border-[#0062FF] focus-within:bg-slate-800'
              : 'bg-slate-100/90 border-slate-200/80 focus-within:border-[#0062FF] focus-within:bg-white'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Tìm kiếm người dùng hoặc cuộc trò chuyện..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full text-xs bg-transparent border-none focus:outline-none placeholder:text-slate-400 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Kết quả tìm kiếm */}
      {searchQuery.trim() && (
        <div className="flex-1 overflow-y-auto px-2.5 space-y-1.5">
          <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Kết quả ({searchResults.length})
          </div>
          {searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2 text-slate-400">
                <SearchX className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Không tìm thấy người dùng.</p>
            </div>
          ) : (
            searchResults.map((user) => (
              <div
                key={user.id}
                className={`p-2 rounded-xl flex items-center justify-between gap-2 border transition-colors ${
                  isDarkMode
                    ? 'border-slate-800 hover:bg-slate-800/60'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                  onClick={() => onSelectUserToChat(user)}
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {user.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-xs font-semibold truncate leading-tight">{user.displayName}</p>
                    <p className="text-[11px] text-slate-400 truncate">@{user.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onSelectUserToChat(user)}
                    className="p-1.5 bg-[#0062FF] hover:bg-[#0052D9] text-white rounded-lg transition-colors cursor-pointer"
                    title="Nhắn tin"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                  </button>

                  {user.friendshipStatus === 'ACCEPTED' ? (
                    <span className="p-1 text-emerald-500" title="Bạn bè">
                      <UserCheck className="w-3.5 h-3.5" />
                    </span>
                  ) : user.friendshipStatus === 'PENDING' ? (
                    <span className="p-1 text-amber-500" title="Đã gửi lời mời">
                      <Clock className="w-3.5 h-3.5" />
                    </span>
                  ) : (
                    <button
                      onClick={() => onSendFriendRequest(user.id)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
                      title="Kết bạn"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 4. Danh sách cuộc trò chuyện */}
      {!searchQuery.trim() && (
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {isLoadingConversations ? (
            <div className="p-2 space-y-2">
              <SidebarSkeleton isDarkMode={isDarkMode} />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-center px-4">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2.5 text-slate-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Chưa có cuộc trò chuyện nào.</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-[180px] leading-relaxed">
                Tìm kiếm liên hệ để bắt đầu nhắn tin.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConvId === conv.conversationId;
              const isGroup = conv.type === 'GROUP';
              const title = conv.title || (conv.otherUser ? conv.otherUser.displayName : 'Đoạn chat');
              const avatar = conv.avatarUrl || (conv.otherUser ? conv.otherUser.avatarUrl : '');

              const otherUserId = conv.otherUser?.id;
              const isOnline = !isGroup && otherUserId ? (presenceMap[otherUserId] ?? false) : false;

              return (
                <div
                  key={conv.conversationId}
                  onClick={() => onSelectConversation(conv)}
                  className={`p-2.5 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all ${
                    isActive
                      ? isDarkMode
                        ? 'bg-blue-950/30 border border-blue-900/50 text-white shadow-2xs'
                        : 'bg-blue-50/70 border border-blue-200/60 text-slate-900 shadow-2xs'
                      : isDarkMode
                      ? 'hover:bg-slate-800/50 text-slate-300 border border-transparent'
                      : 'hover:bg-slate-50 text-slate-700 border border-transparent'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs ${
                        isGroup ? 'bg-gradient-to-tr from-purple-600 to-indigo-500' : 'bg-gradient-to-tr from-[#0062FF] to-sky-400'
                      }`}>
                        {title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {!isGroup && (
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${
                        isDarkMode ? 'border-slate-900' : 'border-white'
                      } ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-900 dark:text-slate-100'}`}>
                        {title}
                      </h3>
                      {conv.lastMessageTime && (
                        <span className={`text-[11px] font-normal flex-shrink-0 ${
                          conv.unreadCount > 0 ? 'text-[#0062FF] font-semibold' : 'text-slate-400'
                        }`}>
                          {formatSidebarTime(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate leading-tight ${
                        conv.unreadCount > 0
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {conv.lastMessage || 'Chưa có tin nhắn'}
                      </p>

                      {conv.unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 bg-[#0062FF] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 shadow-xs">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Thanh kéo chỉnh độ rộng Sidebar (Drag Handle) */}
      <div
        onMouseDown={startResizing}
        className="hidden md:block absolute top-0 -right-1 w-2 h-full cursor-col-resize hover:bg-[#0062FF]/40 active:bg-[#0062FF] transition-colors z-30"
        title="Kéo để thay đổi độ rộng thanh bên"
      />
    </aside>
  );
}