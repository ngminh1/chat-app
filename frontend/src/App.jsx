import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

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

  const [activeToast, setActiveToast] = useState(null);

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
    if (currentUser) {
      fetchConversations(currentUser.id);
    }
  }, [currentUser]);

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

  useEffect(() => {
    if (!currentUser) return;

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      debug: () => {},
      reconnectDelay: 5000,
      onConnect: () => {
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

          if (!isSentByMe) {
            if (settings.soundEnabled) soundManager.playIncomingMessageSound();

            if (settings.desktopNotifications && document.hidden) {
              let bodyPreview = newMsg.content;
              if (newMsg.messageType === 'IMAGE') bodyPreview = 'Đã gửi một hình ảnh';
              if (newMsg.messageType === 'FILE') bodyPreview = `Đã gửi tệp: ${newMsg.fileName || ''}`;

              showDesktopNotification(newMsg.senderName || 'Tin nhắn mới', bodyPreview, null, () => {
                const targetConv = conversationsRef.current.find((c) => c.conversationId === newMsg.conversationId);
                if (targetConv) handleSelectConversation(targetConv);
              });
            }

            if (settings.inAppToast && !isCurrentlyActiveRoom) {
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
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
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
            if (newMsg.messageType === 'FILE') preview = `[Tệp đính kèm] ${newMsg.fileName || ''}`;

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
  }, [currentUser, settings]);

  useEffect(() => {
    if (!activeConv || !stompClientRef.current) return;

    let updateSub = null;
    let typingSub = null;
    let themeSub = null;

    const interval = setInterval(() => {
      if (stompClientRef.current && stompClientRef.current.connected) {
        clearInterval(interval);

        updateSub = stompClientRef.current.subscribe(
          `/topic/conversations/${activeConv.conversationId}/update`,
          (msgFrame) => {
            const updatedMsg = JSON.parse(msgFrame.body);
            setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
          }
        );

        typingSub = stompClientRef.current.subscribe(
          `/topic/conversations/${activeConv.conversationId}/typing`,
          (msgFrame) => {
            const typingData = JSON.parse(msgFrame.body);
            const isSelf = Number(typingData.userId) === Number(currentUser.id);
            const isTypingActive = typingData.isTyping ?? typingData.typing ?? false;

            if (!isSelf) {
              setTypingUser(isTypingActive ? (typingData.userName || "Đối phương") : null);
            }
          }
        );

        themeSub = stompClientRef.current.subscribe(
          `/topic/conversations/${activeConv.conversationId}/theme`,
          (msgFrame) => {
            const newTheme = msgFrame.body;
            setActiveConv((prev) => ({ ...prev, theme: newTheme }));
            setConversations((prev) =>
              prev.map((c) => (c.conversationId === activeConv.conversationId ? { ...c, theme: newTheme } : c))
            );
          }
        );
      }
    }, 200);

    return () => {
      clearInterval(interval);
      if (updateSub) updateSub.unsubscribe();
      if (typingSub) typingSub.unsubscribe();
      if (themeSub) themeSub.unsubscribe();
    };
  }, [activeConv?.conversationId, currentUser]);

  const handleSendMessage = async (
    content,
    replyToId,
    messageType = 'TEXT',
    mediaUrl = null,
    fileName = null,
    fileSize = null
  ) => {
    if (!activeConv) return;

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

      if (settings.soundEnabled) soundManager.playOutgoingMessageSound();

      const sentMsg = res.data;
      setMessages((prev) => {
        if (prev.some((m) => m.id === sentMsg.id)) return prev;
        return [...prev, sentMsg];
      });
      fetchConversations(currentUser.id);
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
      alert("Không thể gửi tin nhắn. Vui lòng kiểm tra lại kết nối!");
    }
  };

  const handleConfirmForward = async (messageId, targetConvIds) => {
    try {
      await axios.post(`${API_BASE}/chat/messages/forward`, {
        messageId,
        senderId: currentUser.id,
        targetConversationIds: targetConvIds
      });
      if (settings.soundEnabled) soundManager.playOutgoingMessageSound();
      fetchConversations(currentUser.id);
      alert("Chuyển tiếp tin nhắn thành công!");
    } catch (err) {
      console.error("Lỗi chuyển tiếp:", err);
      alert("Có lỗi xảy ra khi chuyển tiếp tin nhắn");
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

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) return;
    try {
      const res = await axios.delete(`${API_BASE}/chat/messages/${messageId}`, {
        params: { senderId: currentUser.id }
      });
      const updated = res.data;
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      console.error("Lỗi thu hồi tin nhắn:", err);
    }
  };

  const handleToggleReaction = async (messageId, reaction) => {
    try {
      if (settings.soundEnabled) soundManager.playReactionSound();
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
        userName: currentUser?.displayName || "User",
        isTyping: Boolean(isTyping)
      });
    } catch (err) {
      console.error("Lỗi gửi typing:", err);
    }
  };

  useEffect(() => {
    if (!searchQuery.trim() || !currentUser) {
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
  }, [searchQuery, currentUser]);

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
      alert("Đã gửi lời mời kết bạn thành công!");
    } catch (err) {
      alert(err.response?.data?.message || "Lời mời kết bạn đã tồn tại hoặc đã là bạn bè");
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
    <div className={`flex h-[100dvh] w-full font-sans antialiased overflow-hidden select-none ${
      isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
    }`}>
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
        <EmptyState isDarkMode={isDarkMode} />
      )}

      <ToastNotification
        toast={activeToast}
        onClose={() => setActiveToast(null)}
        onSelectConversation={handleSelectConversation}
      />

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