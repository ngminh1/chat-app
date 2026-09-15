import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Loader2, AlertCircle } from 'lucide-react';

import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import EmptyState from './components/EmptyState';
import FriendsModal from './components/FriendsModal';
import ProfileModal from './components/ProfileModal';
import CreateGroupModal from './components/CreateGroupModal';
import GroupDetailModal from './components/GroupDetailModal';
import PinnedMessagesModal from './components/PinnedMessagesModal';
import MediaGalleryModal from './components/MediaGalleryModal';
import ForwardModal from './components/ForwardModal';
import ToastNotification from './components/ToastNotification';
import AuthScreen from './components/AuthScreen';

import { API_BASE, WS_URL } from './config/api';
import { soundManager } from './utils/soundEffects';
import { showDesktopNotification } from './utils/browserNotifications';

export default function App() {
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token'));
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('dark_mode') === 'true';
  });

  const [isReconnecting, setIsReconnecting] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingUser, setTypingUser] = useState(null);

  const [presenceMap, setPresenceMap] = useState({});
  const [lastSeenMap, setLastSeenMap] = useState({});

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('chat_settings');
    return saved
      ? JSON.parse(saved)
      : { soundEnabled: true, desktopNotifications: true, inAppToast: true };
  });

  // Lưu settings vào ref để callback WebSocket đọc trực tiếp mà không cần khởi tạo lại socket
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [activeToast, setActiveToast] = useState(null);

  // Hộp thoại xác nhận (Custom Confirm Modal thay window.confirm)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  // Modals
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [isGroupDetailModalOpen, setIsGroupDetailModalOpen] = useState(false);
  const [isPinnedModalOpen, setIsPinnedModalOpen] = useState(false);
  const [isMediaGalleryOpen, setIsMediaGalleryOpen] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState(null);

  const activeConvRef = useRef(null);
  activeConvRef.current = activeConv;

  const conversationsRef = useRef([]);
  conversationsRef.current = conversations;

  const stompClientRef = useRef(null);

  const handleToggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('dark_mode', newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleUpdateSettings = (newSettings) => {
    setSettings(newSettings);
    localStorage.setItem('chat_settings', JSON.stringify(newSettings));
  };

  const handleLoginSuccess = (authData) => {
    localStorage.setItem('auth_token', authData.token);
    localStorage.setItem('auth_user', JSON.stringify(authData));
    setAuthToken(authData.token);
    setCurrentUser(authData);
  };

  const handleLogout = () => {
    if (currentUser) {
      axios.put(`${API_BASE}/chat/presence`, null, {
        params: { userId: currentUser.id, isOnline: false }
      }).catch(() => {});
    }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('active_conv_id');
    setAuthToken(null);
    setCurrentUser(null);
    setActiveConv(null);
    setMessages([]);
  };

  const fetchConversations = async (userId) => {
    setIsLoadingConversations(true);
    try {
      const res = await axios.get(`${API_BASE}/chat/conversations/my-chats/${userId}`);
      const convList = res.data;
      setConversations(convList);

      const savedActiveId = localStorage.getItem('active_conv_id');
      if (savedActiveId && convList.length > 0) {
        const matched = convList.find((c) => c.conversationId === Number(savedActiveId));
        if (matched) setActiveConv(matched);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách chat:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchConversations(currentUser.id);
    }
  }, [currentUser?.id]);

  const handleSelectConversation = async (conv) => {
    setActiveConv(conv);
    localStorage.setItem('active_conv_id', conv.conversationId);
    setTypingUser(null);
    try {
      await axios.put(`${API_BASE}/chat/conversations/${conv.conversationId}/read`, null, {
        params: { userId: currentUser.id }
      });
      setConversations((prev) =>
        prev.map((c) => (c.conversationId === conv.conversationId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error("Lỗi đánh dấu đã đọc:", err);
    }
  };

  const handleBackToSidebar = () => {
    setActiveConv(null);
    localStorage.removeItem('active_conv_id');
  };

  useEffect(() => {
    if (!activeConv) return;

    setIsLoadingMessages(true);
    axios.get(`${API_BASE}/chat/conversations/${activeConv.conversationId}/messages`)
      .then((res) => setMessages(res.data))
      .catch((err) => console.error("Lỗi tải lịch sử chat:", err))
      .finally(() => setIsLoadingMessages(false));
  }, [activeConv?.conversationId]);

  // WebSocket Connection: Tách hoàn toàn settings khỏi deps
  useEffect(() => {
    if (!currentUser?.id) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      debug: () => {},
      reconnectDelay: 5000,
      onConnect: () => {
        setIsReconnecting(false);

        axios.put(`${API_BASE}/chat/presence`, null, {
          params: { userId: currentUser.id, isOnline: true }
        }).catch(() => {});

        client.subscribe('/topic/presence', (msgFrame) => {
          const presence = JSON.parse(msgFrame.body);
          setPresenceMap((prev) => ({ ...prev, [presence.userId]: presence.isOnline }));
          if (presence.lastSeenAt) {
            setLastSeenMap((prev) => ({ ...prev, [presence.userId]: presence.lastSeenAt }));
          }
        });

        client.subscribe(`/topic/users/${currentUser.id}/messages`, async (msgFrame) => {
          const newMsg = JSON.parse(msgFrame.body);
          const currentActive = activeConvRef.current;
          const isCurrentlyActiveRoom = currentActive && currentActive.conversationId === newMsg.conversationId;
          const isSentByMe = newMsg.senderId === currentUser.id;
          const currentSettings = settingsRef.current;

          if (!isSentByMe) {
            if (currentSettings.soundEnabled) soundManager.playIncomingMessageSound();

            if (currentSettings.desktopNotifications && document.hidden) {
              let bodyPreview = newMsg.content;
              if (newMsg.messageType === 'IMAGE') bodyPreview = 'Đã gửi một hình ảnh';
              if (newMsg.messageType === 'FILE') bodyPreview = `Đã gửi tệp: ${newMsg.fileName || ''}`;

              showDesktopNotification(newMsg.senderName || 'Tin nhắn mới', bodyPreview, null, () => {
                const targetConv = conversationsRef.current.find((c) => c.conversationId === newMsg.conversationId);
                if (targetConv) handleSelectConversation(targetConv);
              });
            }

            if (currentSettings.inAppToast && !isCurrentlyActiveRoom) {
              const matchedConv = conversationsRef.current.find((c) => c.conversationId === newMsg.conversationId);
              let previewContent = newMsg.content;
              if (newMsg.messageType === 'IMAGE') previewContent = '📷 [Hình ảnh]';
              if (newMsg.messageType === 'FILE') previewContent = `📎 [Tệp] ${newMsg.fileName || ''}`;

              setActiveToast({
                id: newMsg.id,
                conversationId: newMsg.conversationId,
                title: matchedConv?.title || newMsg.senderName,
                senderName: newMsg.senderName,
                avatarUrl: matchedConv?.avatarUrl || matchedConv?.otherUser?.avatarUrl,
                isGroup: matchedConv?.type === 'GROUP',
                content: previewContent,
                conversation: matchedConv || {
                  conversationId: newMsg.conversationId,
                  type: 'DIRECT',
                  title: newMsg.senderName,
                  otherUser: { displayName: newMsg.senderName, id: newMsg.senderId }
                }
              });
            }
          }

          if (isCurrentlyActiveRoom) {
            setMessages((prev) => {
              // Loại bỏ tin nhắn tạm thời lạc quan nếu trùng
              const filtered = prev.filter((m) => !m.isOptimistic || m.content !== newMsg.content);
              if (filtered.some((m) => m.id === newMsg.id)) return filtered;
              return [...filtered, newMsg];
            });
            if (!isSentByMe) {
              await axios.put(`${API_BASE}/chat/conversations/${newMsg.conversationId}/read`, null, {
                params: { userId: currentUser.id }
              });
            }
          }

          setConversations((prev) => {
            const existingIndex = prev.findIndex((c) => c.conversationId === newMsg.conversationId);
            if (existingIndex === -1) {
              fetchConversations(currentUser.id);
              return prev;
            }

            let preview = newMsg.content;
            if (newMsg.messageType === 'IMAGE') preview = '[Hình ảnh]';
            if (newMsg.messageType === 'FILE') preview = `[Tệp] ${newMsg.fileName || ''}`;

            const targetConv = { ...prev[existingIndex] };
            targetConv.lastMessage = preview;
            targetConv.lastMessageTime = newMsg.createdAt;

            if (!isCurrentlyActiveRoom && !isSentByMe) {
              targetConv.unreadCount = (Number(targetConv.unreadCount) || 0) + 1;
            } else if (isCurrentlyActiveRoom) {
              targetConv.unreadCount = 0;
            }

            const rest = prev.filter((c) => c.conversationId !== newMsg.conversationId);
            return [targetConv, ...rest];
          });
        });
      },
      onWebSocketClose: () => setIsReconnecting(true),
      onWebSocketError: () => setIsReconnecting(true),
      onStompError: () => setIsReconnecting(true)
    });

    client.activate();
    stompClientRef.current = client;

    const handleBeforeUnload = () => {
      navigator.sendBeacon(
        `${API_BASE}/chat/presence?userId=${currentUser.id}&isOnline=false`
      );
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (stompClientRef.current) stompClientRef.current.deactivate();
    };
  }, [currentUser?.id]);

  // Subscribe kênh của active conversation: Thay polling 200ms bằng listener trực tiếp
  useEffect(() => {
    const convId = activeConv?.conversationId;
    if (!convId || !stompClientRef.current) return;

    let updateSub = null;
    let typingSub = null;
    let themeSub = null;

    const client = stompClientRef.current;
    if (client.connected) {
      updateSub = client.subscribe(`/topic/conversations/${convId}/update`, (msgFrame) => {
        const updatedMsg = JSON.parse(msgFrame.body);
        setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
      });

      typingSub = client.subscribe(`/topic/conversations/${convId}/typing`, (msgFrame) => {
        const typingData = JSON.parse(msgFrame.body);
        const isSelf = Number(typingData.userId) === Number(currentUser?.id);
        const isTypingActive = typingData.isTyping ?? typingData.typing ?? false;

        if (!isSelf) {
          setTypingUser(isTypingActive ? (typingData.userName || "Người dùng") : null);
        }
      });

      themeSub = client.subscribe(`/topic/conversations/${convId}/theme`, (msgFrame) => {
        const newTheme = msgFrame.body;
        setActiveConv((prev) => ({ ...prev, theme: newTheme }));
        setConversations((prev) =>
          prev.map((c) => (c.conversationId === convId ? { ...c, theme: newTheme } : c))
        );
      });
    }

    return () => {
      if (updateSub) updateSub.unsubscribe();
      if (typingSub) typingSub.unsubscribe();
      if (themeSub) themeSub.unsubscribe();
    };
  }, [activeConv?.conversationId, currentUser?.id]);

  // Gửi tin nhắn: Áp dụng Optimistic UI + Cập nhật hội thoại Local trực tiếp (Không fetch lại server)
  const handleSendMessage = async (
    content,
    replyToId,
    messageType = 'TEXT',
    mediaUrl = null,
    fileName = null,
    fileSize = null
  ) => {
    if (!activeConv) return;

    const tempId = `optimistic-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const optimisticMsg = {
      id: tempId,
      conversationId: activeConv.conversationId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      content: content || '',
      messageType,
      mediaUrl,
      fileName,
      fileSize,
      isEdited: false,
      isDeleted: false,
      isPinned: false,
      isOptimistic: true,
      createdAt: nowIso
    };

    // Đẩy ngay vào danh sách tin nhắn để giao diện phản hồi tức thì
    setMessages((prev) => [...prev, optimisticMsg]);

    // Cập nhật ngay danh sách hội thoại bên sidebar
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.conversationId === activeConv.conversationId);
      let preview = content || '';
      if (messageType === 'IMAGE') preview = '[Hình ảnh]';
      if (messageType === 'FILE') preview = `[Tệp] ${fileName || ''}`;

      if (idx !== -1) {
        const target = { ...prev[idx], lastMessage: preview, lastMessageTime: nowIso, unreadCount: 0 };
        const rest = prev.filter((c) => c.conversationId !== activeConv.conversationId);
        return [target, ...rest];
      }
      return prev;
    });

    try {
      const res = await axios.post(`${API_BASE}/chat/messages`, {
        conversationId: activeConv.conversationId,
        senderId: currentUser.id,
        content: content || '',
        replyToId: replyToId || null,
        messageType,
        mediaUrl,
        fileName,
        fileSize
      });

      if (settingsRef.current.soundEnabled) soundManager.playOutgoingMessageSound();

      const serverMsg = res.data;
      // Thay thế tin nhắn tạm bằng tin nhắn xác nhận chính thức từ server
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? serverMsg : m))
      );
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
      // Xóa tin tạm nếu gửi thất bại
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  };

  const handleConfirmForward = async (messageId, targetConvIds) => {
    try {
      await axios.post(`${API_BASE}/chat/messages/forward`, {
        messageId,
        senderId: currentUser.id,
        targetConversationIds: targetConvIds
      });
      if (settingsRef.current.soundEnabled) soundManager.playOutgoingMessageSound();
      fetchConversations(currentUser.id);
      setActiveToast({
        title: 'Chuyển tiếp thành công',
        content: `Đã gửi tin nhắn đến ${targetConvIds.length} cuộc trò chuyện.`,
        conversation: null
      });
    } catch (err) {
      console.error("Lỗi chuyển tiếp:", err);
      setActiveToast({
        title: 'Lỗi',
        content: 'Có lỗi xảy ra khi chuyển tiếp tin nhắn.',
        conversation: null
      });
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    try {
      const res = await axios.put(`${API_BASE}/chat/messages/edit`, {
        messageId,
        senderId: currentUser.id,
        content: newContent
      });
      const updated = res.data;
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      console.error("Lỗi sửa tin nhắn:", err);
    }
  };

  const handleDeleteMessage = (messageId) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Thu hồi tin nhắn',
      message: 'Bạn có chắc chắn muốn thu hồi tin nhắn này đối với mọi người trong phòng chat?',
      onConfirm: async () => {
        try {
          const res = await axios.delete(`${API_BASE}/chat/messages/${messageId}`, {
            params: { senderId: currentUser.id }
          });
          const updated = res.data;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        } catch (err) {
          console.error("Lỗi thu hồi tin nhắn:", err);
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleToggleReaction = async (messageId, reaction) => {
    try {
      if (settingsRef.current.soundEnabled) soundManager.playReactionSound();
      const res = await axios.post(`${API_BASE}/chat/messages/reaction`, {
        messageId,
        userId: currentUser.id,
        reaction
      });
      const updated = res.data;
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      console.error("Lỗi thả reaction:", err);
    }
  };

  const handleTogglePinMessage = async (messageId) => {
    try {
      const res = await axios.put(`${API_BASE}/chat/messages/${messageId}/pin`, null, {
        params: { userId: currentUser.id }
      });
      const updated = res.data;
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      console.error("Lỗi ghim tin nhắn:", err);
    }
  };

  const handleSendTyping = async (isTyping) => {
    if (!activeConv || !currentUser) return;
    try {
      await axios.post(`${API_BASE}/chat/typing`, {
        conversationId: activeConv.conversationId,
        userId: currentUser.id,
        userName: currentUser?.displayName || "Người dùng",
        isTyping: Boolean(isTyping)
      });
    } catch (err) {
      console.error("Lỗi gửi typing:", err);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim() || !currentUser?.id) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API_BASE}/users/search`, {
          params: { query: searchQuery.trim(), currentUserId: currentUser.id }
        });
        setSearchResults(res.data);
      } catch (err) {
        console.error("Lỗi tìm kiếm user:", err);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser?.id]);

  const handleStartChatWithUser = async (targetUser) => {
    try {
      const res = await axios.post(`${API_BASE}/chat/conversations/direct`, {
        user1Id: currentUser.id,
        user2Id: targetUser.id
      });
      const convData = res.data;

      const selectedConv = {
        conversationId: convData.id,
        type: 'DIRECT',
        otherUser: targetUser,
        title: targetUser.displayName,
        avatarUrl: targetUser.avatarUrl,
        theme: convData.theme || 'blue',
        lastMessage: '',
        lastMessageTime: convData.createdAt,
        unreadCount: 0
      };

      handleSelectConversation(selectedConv);
      setSearchQuery('');
      setSearchResults([]);
      fetchConversations(currentUser.id);
    } catch (err) {
      console.error("Lỗi tạo phòng chat:", err);
    }
  };

  const handleSendFriendRequest = async (addresseeId) => {
    try {
      await axios.post(`${API_BASE}/friends/request`, null, {
        params: { requesterId: currentUser.id, addresseeId }
      });
      setActiveToast({
        title: 'Thành công',
        content: 'Đã gửi lời mời kết bạn!',
        conversation: null
      });
    } catch (err) {
      setActiveToast({
        title: 'Thông báo',
        content: err.response?.data?.message || 'Lời mời kết bạn đã tồn tại hoặc đã là bạn bè.',
        conversation: null
      });
    }
  };

  const handleGroupCreated = (newGroup) => {
    fetchConversations(currentUser.id);
    handleSelectConversation({
      conversationId: newGroup.id,
      type: 'GROUP',
      title: newGroup.title,
      avatarUrl: newGroup.avatarUrl,
      theme: newGroup.theme || 'blue',
      lastMessage: '',
      lastMessageTime: newGroup.createdAt,
      unreadCount: 0
    });
  };

  const handleLeftGroup = () => {
    setActiveConv(null);
    setMessages([]);
    fetchConversations(currentUser.id);
  };

  const handleJumpToMessage = (msgId) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (!authToken || !currentUser) {
    return (
      <AuthScreen
        onLoginSuccess={handleLoginSuccess}
        isDarkMode={isDarkMode}
        onToggleDarkMode={handleToggleDarkMode}
      />
    );
  }

  const pinnedMessages = messages.filter((m) => m.isPinned && !m.isDeleted);

  return (
    <div className={`flex flex-col h-[100dvh] w-full font-sans antialiased overflow-hidden select-none ${
      isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
    }`}>
      {/* Banner WebSocket Reconnecting */}
      {isReconnecting && (
        <div className="bg-amber-500 text-slate-950 text-xs font-bold py-1 px-4 text-center flex items-center justify-center gap-2 flex-shrink-0 z-50 shadow-xs animate-in fade-in">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Đang kết nối lại máy chủ...</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden w-full h-full">
        <Sidebar
          currentUser={currentUser}
          conversations={conversations}
          activeConvId={activeConv?.conversationId}
          onSelectConversation={handleSelectConversation}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchResults={searchResults}
          onSelectUserToChat={handleStartChatWithUser}
          onSendFriendRequest={handleSendFriendRequest}
          onOpenFriendsModal={() => setIsFriendsModalOpen(true)}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onOpenCreateGroupModal={() => setIsCreateGroupModalOpen(true)}
          isDarkMode={isDarkMode}
          onToggleDarkMode={handleToggleDarkMode}
          onLogout={handleLogout}
          presenceMap={presenceMap}
          isLoadingConversations={isLoadingConversations}
          onGoHome={handleBackToSidebar}
        />

        {activeConv ? (
          <ChatArea
            activeConversation={activeConv}
            messages={messages}
            currentUserId={currentUser.id}
            currentUserName={currentUser.displayName}
            onSendMessage={handleSendMessage}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onToggleReaction={handleToggleReaction}
            onTogglePinMessage={handleTogglePinMessage}
            onSendTyping={handleSendTyping}
            typingUser={typingUser}
            isLoadingMessages={isLoadingMessages}
            onOpenGroupDetailModal={() => setIsGroupDetailModalOpen(true)}
            onOpenPinnedModal={() => setIsPinnedModalOpen(true)}
            onOpenMediaGallery={() => setIsMediaGalleryOpen(true)}
            onStartForwardMessage={(msg) => setForwardingMessage(msg)}
            onBack={handleBackToSidebar}
            isDarkMode={isDarkMode}
            presenceMap={presenceMap}
            lastSeenMap={lastSeenMap}
          />
        ) : (
          <EmptyState
            isDarkMode={isDarkMode}
            onNewConversation={() => setIsFriendsModalOpen(true)}
          />
        )}
      </div>

      <ToastNotification
        toast={activeToast}
        onClose={() => setActiveToast(null)}
        onSelectConversation={handleSelectConversation}
      />

      {/* Hộp thoại xác nhận tùy chỉnh chuẩn phong cách Dispatch */}
      {confirmDialog.isOpen && (
        <div
          onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
          className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-xs select-none"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-sm rounded-2xl p-5 border shadow-2xl animate-in zoom-in-95 duration-150 ${
              isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold">{confirmDialog.title}</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-3.5 py-1.5 text-xs font-semibold text-white rounded-xl bg-rose-600 hover:bg-rose-700 transition-colors shadow-xs cursor-pointer"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {activeConv && (
        <MediaGalleryModal
          isOpen={isMediaGalleryOpen}
          onClose={() => setIsMediaGalleryOpen(false)}
          conversationId={activeConv.conversationId}
          conversationTitle={activeConv.title || activeConv.otherUser?.displayName}
          onJumpToMessage={handleJumpToMessage}
          isDarkMode={isDarkMode}
        />
      )}

      <ForwardModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        messageToForward={forwardingMessage}
        conversations={conversations}
        onConfirmForward={handleConfirmForward}
        isDarkMode={isDarkMode}
      />

      <FriendsModal
        isOpen={isFriendsModalOpen}
        onClose={() => setIsFriendsModalOpen(false)}
        currentUserId={currentUser.id}
        onStartChatWithUser={handleStartChatWithUser}
        isDarkMode={isDarkMode}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={(updated) => {
          const newUser = { ...currentUser, ...updated };
          setCurrentUser(newUser);
          localStorage.setItem('auth_user', JSON.stringify(newUser));
        }}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
      />

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        onClose={() => setIsCreateGroupModalOpen(false)}
        currentUserId={currentUser.id}
        onGroupCreated={handleGroupCreated}
      />

      <GroupDetailModal
        isOpen={isGroupDetailModalOpen}
        onClose={() => setIsGroupDetailModalOpen(false)}
        conversation={activeConv}
        currentUserId={currentUser.id}
        onGroupUpdated={(updatedConv) => {
          fetchConversations(currentUser.id);
          setActiveConv((prev) => ({
            ...prev,
            title: updatedConv.title,
            theme: updatedConv.theme || prev.theme
          }));
        }}
        onLeftGroup={handleLeftGroup}
        onOpenMediaGallery={() => setIsMediaGalleryOpen(true)}
        isDarkMode={isDarkMode}
      />

      <PinnedMessagesModal
        isOpen={isPinnedModalOpen}
        onClose={() => setIsPinnedModalOpen(false)}
        pinnedMessages={pinnedMessages}
        onUnpin={handleTogglePinMessage}
        onJumpToMessage={handleJumpToMessage}
      />
    </div>
  );
}