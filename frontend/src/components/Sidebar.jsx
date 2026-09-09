import React from 'react';
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
  Loader2
} from 'lucide-react';
import { formatSidebarTime } from '../utils/formatTime';
import { SidebarSkeleton } from './Skeletons';

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
  isLoadingConversations
}) {
  return (
    <aside className={`w-full md:w-80 lg:w-88 flex flex-col h-full border-r flex-shrink-0 select-none transition-colors duration-200 ${
      isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200/80 text-slate-900'
    }`}>
      {/* 1. Header: Avatar, Tên & Thanh công cụ thao tác */}
      <div className={`p-3.5 border-b flex items-center justify-between gap-2 flex-shrink-0 ${
        isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200/80 bg-white'
      }`}>
        {/* Thông tin cá nhân (Bấm vào để mở Profile) */}
        <div
          onClick={onOpenProfileModal}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer hover:opacity-85 transition-opacity"
          title="Xem & Chỉnh sửa hồ sơ"
        >
          <div className="relative flex-shrink-0">
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt=""
                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900"></span>
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-xs font-bold truncate leading-tight">
              {currentUser.displayName || currentUser.username}
            </h1>
            <p className="text-[10px] text-slate-400 truncate">@{currentUser.username}</p>
          </div>
        </div>

        {/* Cụm Action Buttons: Đổi giao diện, Bạn bè, Tạo nhóm, Đăng xuất */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onToggleDarkMode}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isDarkMode ? 'Chuyển sang Chế độ Sáng' : 'Chuyển sang Chế độ Tối'}
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={onOpenFriendsModal}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Danh sách Bạn bè"
          >
            <Users className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenCreateGroupModal}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tạo nhóm trò chuyện mới"
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

      {/* 2. Search Box */}
      <div className="p-3 flex-shrink-0">
        <div className={`relative flex items-center rounded-xl px-3 py-1.5 border transition-all ${
          isDarkMode
            ? 'bg-slate-800/70 border-slate-700/80 focus-within:border-[#0084FF] focus-within:bg-slate-800'
            : 'bg-slate-100/80 border-slate-200/80 focus-within:border-[#0084FF] focus-within:bg-white'
        }`}>
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Tìm kiếm bạn bè & người dùng..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full text-xs bg-transparent border-none focus:outline-none placeholder:text-slate-400 ${
              isDarkMode ? 'text-white' : 'text-slate-900'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 3. Search Results Overlay (Khi đang gõ tìm kiếm) */}
      {searchQuery.trim() && (
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Kết quả tìm kiếm ({searchResults.length})
          </div>
          {searchResults.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              Không tìm thấy người dùng phù hợp
            </div>
          ) : (
            searchResults.map((user) => (
              <div
                key={user.id}
                className={`p-2.5 rounded-xl flex items-center justify-between gap-2 border transition-colors ${
                  isDarkMode
                    ? 'border-slate-800 hover:bg-slate-800/60'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div
                  className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
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
                    <p className="text-[10px] text-slate-400 truncate">@{user.username}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => onSelectUserToChat(user)}
                    className="p-1.5 bg-[#0084FF] hover:bg-blue-600 text-white rounded-lg transition-colors cursor-pointer"
                    title="Nhắn tin ngay"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                  </button>

                  {user.friendshipStatus === 'ACCEPTED' ? (
                    <span className="p-1.5 text-emerald-500 rounded-lg" title="Đã là bạn bè">
                      <UserCheck className="w-3.5 h-3.5" />
                    </span>
                  ) : user.friendshipStatus === 'PENDING' ? (
                    <span className="p-1.5 text-amber-500 rounded-lg" title="Đã gửi lời mời kết bạn">
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

      {/* 4. Conversation List (Danh sách các cuộc trò chuyện) */}
      {!searchQuery.trim() && (
        <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
          {isLoadingConversations ? (
            <SidebarSkeleton isDarkMode={isDarkMode} />
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-center px-4">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center mb-2">
                💬
              </div>
              <p className="text-xs font-semibold">Chưa có cuộc trò chuyện nào</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Hãy tìm kiếm bạn bè hoặc tạo nhóm mới để bắt đầu nhắn tin!
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
                  className={`p-2.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-all ${
                    isActive
                      ? isDarkMode
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-blue-50/90 text-slate-900 shadow-xs'
                      : isDarkMode
                      ? 'hover:bg-slate-800/50 text-slate-300'
                      : 'hover:bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    {avatar ? (
                      <img
                        src={avatar}
                        alt=""
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className={`w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-xs ${
                        isGroup ? 'bg-gradient-to-tr from-purple-600 to-indigo-500' : 'bg-gradient-to-tr from-blue-600 to-sky-400'
                      }`}>
                        {title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {!isGroup && (
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                        isDarkMode ? 'border-slate-900' : 'border-white'
                      } ${isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className={`text-xs truncate ${conv.unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>
                        {title}
                      </h3>
                      {conv.lastMessageTime && (
                        <span className={`text-[10px] flex-shrink-0 ${
                          conv.unreadCount > 0 ? 'text-[#0084FF] font-bold' : 'text-slate-400'
                        }`}>
                          {formatSidebarTime(conv.lastMessageTime)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[11px] truncate leading-tight ${
                        conv.unreadCount > 0
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'text-slate-400'
                      }`}>
                        {conv.lastMessage || 'Chưa có tin nhắn'}
                      </p>

                      {conv.unreadCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 bg-[#0084FF] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
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
    </aside>
  );
}