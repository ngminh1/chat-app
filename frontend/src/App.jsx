import { useState, useEffect, useRef } from 'react';
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
import { encryptMessage } from './utils/crypto';
import { getConversationAESKey, clearAESKeyCache } from './utils/aesKeyManager';
import { createMessageDecryptor, getReadableMessageText } from './utils/messageDecryption';
import { createAuthSession } from './utils/authSession.js';
import { SessionProvider } from './context/SessionContext.jsx';

export default function App() {
  const [authState, setAuthState] = useState(() => {
    const token = localStorage.getItem('auth_token');
    const saved = localStorage.getItem('auth_user');
    return { generation: 0, session: token && saved ? createAuthSession(JSON.parse(saved), token) : null };
  });
  const authStateRef = useRef(authState);
  const { session } = authState;
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('dark_mode') === 'true');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const handleToggleDarkMode = () => {
    const next = !isDarkMode;
    localStorage.setItem('dark_mode', next);
    setIsDarkMode(next);
  };

  const handleLoginSuccess = (authData) => {
    // Also reject a retained callback from an older login screen (including A -> A).
    if (authStateRef.current !== authState) return;
    session?.invalidate();
    clearAESKeyCache();
    const next = { generation: authState.generation + 1, session: createAuthSession(authData, authData.token) };
    authStateRef.current = next;
    localStorage.setItem('auth_token', authData.token);
    localStorage.setItem('auth_user', JSON.stringify(authData));
    setAuthState(next);
  };

  const handleLogout = () => {
    if (authStateRef.current !== authState || !session) return;
    // Invalidate before React commits the unmount; abort alone cannot stop every adapter/callback.
    session.invalidate();
    const next = { generation: authState.generation + 1, session: null };
    authStateRef.current = next;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('active_conv_id');
    clearAESKeyCache();
    setAuthState(next);
    // Best-effort offline notification belongs to A even if B logs in immediately.
    axios.put(`${API_BASE}/chat/presence`, null, {
      params: { userId: session.user.id, isOnline: false },
      headers: { Authorization: `Bearer ${session.token}` }
    }).catch(() => {});
  };

  if (!session) {
    return <AuthScreen key={authState.generation} onLoginSuccess={handleLoginSuccess}
      isDarkMode={isDarkMode} onToggleDarkMode={handleToggleDarkMode} />;
  }
  return (
    <SessionProvider session={session}>
      <ChatSession key={session.id} session={session} onLogout={handleLogout}
        isDarkMode={isDarkMode} onToggleDarkMode={handleToggleDarkMode} />
    </SessionProvider>
  );
}

// Every login owns new component state, refs, modal children and callback closures.
function ChatSession({ session, onLogout, isDarkMode, onToggleDarkMode }) {
  const [currentUser, setCurrentUser] = useState(session.user);
  const api = session.api;
  const handleToggleDarkMode = session.guard(onToggleDarkMode);

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [wsConnectionVersion, setWsConnectionVersion] = useState(0);

  const [conversations, setConversations] = useState([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [typingUser, setTypingUser] = useState(null);

  const [presenceMap, setPresenceMap] = useState({});
  const [lastSeenMap, setLastSeenMap] = useState({});

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ query: '', items: [] });

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('chat_settings');
    return saved
      ? JSON.parse(saved)
      : { soundEnabled: true, desktopNotifications: true, inAppToast: true };
  });

  // Lưu settings vào ref để callback WebSocket đọc trực tiếp mà không cần khởi tạo lại socket
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => {
    if (settings.soundEnabled) return soundManager.listenForUserActivation();
  }, [settings.soundEnabled]);

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
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  const conversationsRef = useRef([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const stompClientRef = useRef(null);

  const getSessionKey = async (...args) => {
    session.assertActive();
    const key = await getConversationAESKey(...args);
    session.assertActive();
    return key;
  };
  const [messageDecryptor] = useState(() => createMessageDecryptor({
    getKey: getSessionKey,
    logger: {
      warn: session.guard((...args) => console.warn(...args)),
      error: session.guard((...args) => console.error(...args))
    }
  }));
  const decryptMessagePayload = async (message) => {
    session.assertActive();
    const decrypted = await messageDecryptor.decryptMessagePayload(message, currentUser.id);
    session.assertActive();
    return decrypted;
  };
  const decryptConversationPreview = (conversation, userId) => messageDecryptor.decryptConversationPreview(conversation, userId);

  const handleUpdateSettings = (newSettings) => {
    if (!session.isActive()) return;
    setSettings(newSettings);
    localStorage.setItem('chat_settings', JSON.stringify(newSettings));
  };

  const handleLogout = () => {
    if (!session.isActive()) return;
    session.invalidate();
    messageDecryptor.clearFailures();
    setConversations([]);
    conversationsRef.current = [];
    activeConvRef.current = null;
    setActiveConv(null);
    setMessages([]);
    onLogout();
  };

  const fetchConversations = async (userId) => {
    if (!session.isActive()) return;
    setIsLoadingConversations(true);
    try {
      const res = await api.get(`${API_BASE}/chat/conversations/my-chats/${userId}`);
      if (!session.isActive()) return;

      // Backend không decrypt. Frontend decrypt preview của TEXT AES sau khi nhận response.
      const convList = await Promise.all(
        res.data.map((conv) => decryptConversationPreview(conv, userId))
      );
      if (!session.isActive()) return;
      setConversations(convList);

      const savedActiveId = localStorage.getItem('active_conv_id');
      if (savedActiveId && convList.length > 0) {
        const matched = convList.find((c) => c.conversationId === Number(savedActiveId));
        if (matched) setActiveConv(matched);
      }
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi lấy danh sách chat.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
    } finally {
      if (session.isActive()) setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    const timer = setTimeout(() => fetchConversations(currentUser.id), 0);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);

  const handleSelectConversation = async (conv) => {
    if (!session.isActive()) return;
    setActiveConv(conv);
    localStorage.setItem('active_conv_id', conv.conversationId);
    setTypingUser(null);
    try {
      await api.put(`${API_BASE}/chat/conversations/${conv.conversationId}/read`, null, {
        params: { userId: currentUser.id }
      });
      if (!session.isActive()) return;
      setConversations((prev) =>
        prev.map((c) => (c.conversationId === conv.conversationId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi đánh dấu đã đọc.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
    }
  };

  const handleBackToSidebar = () => {
    if (!session.isActive()) return;
    setActiveConv(null);
    localStorage.removeItem('active_conv_id');
  };

  useEffect(() => {
    if (!activeConv || !currentUser?.id) return;

    let cancelled = false;
    const controller = new AbortController();

    const loadMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const res = await api.get(`${API_BASE}/chat/conversations/${activeConv.conversationId}/messages`, { signal: controller.signal });
        if (cancelled || !session.isActive()) return;
        const decryptedMessages = await Promise.all(
          res.data.map((msg) => decryptMessagePayload(msg))
        );
        if (!cancelled && session.isActive()) setMessages(decryptedMessages);
      } catch (err) {
        if (cancelled || !session.isActive()) return;
        console.error('Lỗi tải lịch sử chat.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
      } finally {
        if (!cancelled && session.isActive()) setIsLoadingMessages(false);
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeConv?.conversationId, currentUser?.id, api, session]);

  // WebSocket Connection: Tách hoàn toàn settings khỏi deps
  useEffect(() => {
    if (!currentUser?.id) return;

    let disposed = false;
    const isCurrent = () => !disposed && session.isActive();
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: {
        Authorization: `Bearer ${session.token}`
      },
      debug: () => {},
      reconnectDelay: 5000,
      onConnect: () => {
        if (!isCurrent()) { client.deactivate(); return; }
        setIsReconnecting(false);
        setWsConnectionVersion((version) => version + 1);

        api.put(`${API_BASE}/chat/presence`, null, {
          params: { userId: currentUser.id, isOnline: true }
        }).catch(() => {});

        client.subscribe('/topic/presence', (msgFrame) => {
          if (!isCurrent()) return;
          const presence = JSON.parse(msgFrame.body);
          setPresenceMap((prev) => ({ ...prev, [presence.userId]: presence.isOnline }));
          if (presence.lastSeenAt) {
            setLastSeenMap((prev) => ({ ...prev, [presence.userId]: presence.lastSeenAt }));
          }
        });

        client.subscribe(`/topic/users/${currentUser.id}/messages`, async (msgFrame) => {
          if (!isCurrent()) return;
          try {
          const encryptedMsg = JSON.parse(msgFrame.body);
          if (encryptedMsg.event === 'GROUP_REMOVED') {
            const id = Number(encryptedMsg.conversationId);
            setConversations((prev) => prev.filter((c) => Number(c.conversationId) !== id));
            if (Number(activeConvRef.current?.conversationId) === id) {
              setActiveConv(null);
              setMessages([]);
              setIsGroupDetailModalOpen(false);
              setTypingUser(null);
              localStorage.removeItem('active_conv_id');
            }
            clearAESKeyCache();
            return;
          }
          if (encryptedMsg.event === 'GROUP_MEMBERS_CHANGED') {
            fetchConversations(currentUser.id);
            return;
          }
          const newMsg = await decryptMessagePayload(encryptedMsg);
          if (!isCurrent()) return;
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
                if (!isCurrent()) return;
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
              await api.put(`${API_BASE}/chat/conversations/${newMsg.conversationId}/read`, null, {
                params: { userId: currentUser.id }
              });
              if (!isCurrent()) return;
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
          } catch (err) {
            if (isCurrent()) console.error('Lỗi nhận tin nhắn.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
          }
        });
      },
      onWebSocketClose: () => { if (isCurrent()) setIsReconnecting(true); },
      onWebSocketError: () => { if (isCurrent()) setIsReconnecting(true); },
      onStompError: () => { if (isCurrent()) setIsReconnecting(true); }
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      disposed = true;
      client.deactivate();
      if (stompClientRef.current === client) stompClientRef.current = null;
    };
  }, [currentUser?.id, api, session]);

  // Subscribe kênh của active conversation: Thay polling 200ms bằng listener trực tiếp
  useEffect(() => {
    const convId = activeConv?.conversationId;
    if (!convId || !stompClientRef.current) return;

    let updateSub = null;
    let typingSub = null;
    let themeSub = null;
    let disposed = false;
    const isCurrent = () => !disposed && session.isActive();

    const client = stompClientRef.current;
    if (client.connected) {
      updateSub = client.subscribe(`/topic/conversations/${convId}/update`, async (msgFrame) => {
        if (!isCurrent()) return;
        try {
        const encryptedUpdatedMsg = JSON.parse(msgFrame.body);
        const updatedMsg = await decryptMessagePayload(encryptedUpdatedMsg);
        if (!isCurrent()) return;
        setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m)));
        } catch (err) {
          if (isCurrent()) console.error('Lỗi cập nhật tin nhắn.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
        }
      });

      typingSub = client.subscribe(`/topic/conversations/${convId}/typing`, (msgFrame) => {
        if (!isCurrent()) return;
        const typingData = JSON.parse(msgFrame.body);
        const isSelf = Number(typingData.userId) === Number(currentUser?.id);
        const isTypingActive = typingData.isTyping ?? typingData.typing ?? false;

        if (!isSelf) {
          setTypingUser(isTypingActive ? (typingData.userName || "Người dùng") : null);
        }
      });

      themeSub = client.subscribe(`/topic/conversations/${convId}/theme`, (msgFrame) => {
        if (!isCurrent()) return;
        const newTheme = msgFrame.body;
        setActiveConv((prev) => ({ ...prev, theme: newTheme }));
        setConversations((prev) =>
          prev.map((c) => (c.conversationId === convId ? { ...c, theme: newTheme } : c))
        );
      });
    }

    return () => {
      disposed = true;
      if (updateSub) updateSub.unsubscribe();
      if (typingSub) typingSub.unsubscribe();
      if (themeSub) themeSub.unsubscribe();
    };
  }, [activeConv?.conversationId, currentUser?.id, wsConnectionVersion, session]);

  // Gửi tin nhắn: TEXT được AES-256-GCM encrypt ở frontend trước khi gọi backend.
  const handleSendMessage = async (
    content,
    replyToId,
    messageType = 'TEXT',
    mediaUrl = null,
    fileName = null,
    fileSize = null
  ) => {
    if (!session.isActive() || !activeConv || !currentUser?.id) return;

    const tempId = `optimistic-${Date.now()}`;
    const nowIso = new Date().toISOString();

    // UI vẫn dùng plaintext ngay lập tức. Plaintext này chỉ nằm ở frontend state.
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

    setMessages((prev) => [...prev, optimisticMsg]);

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
      let requestContent = content || '';
      let ciphertext = null;
      let iv = null;
      let encryptionVersion = null;

      // Phase hiện tại chỉ mã hóa TEXT. IMAGE/FILE giữ nguyên behavior cũ.
      if (messageType === 'TEXT') {
        const key = await getSessionKey(activeConv.conversationId, currentUser.id);
        const encrypted = await encryptMessage(content || '', key);
        session.assertActive();
        requestContent = null; // Không gửi plaintext TEXT lên backend.
        ciphertext = encrypted.ciphertext;
        iv = encrypted.iv;
        encryptionVersion = encrypted.encryptionVersion;
      }

      const res = await api.post(`${API_BASE}/chat/messages`, {
        conversationId: activeConv.conversationId,
        senderId: currentUser.id,
        content: requestContent,
        ciphertext,
        iv,
        encryptionVersion,
        replyToId: replyToId || null,
        messageType,
        mediaUrl,
        fileName,
        fileSize
      });
      if (!session.isActive()) return;

      if (settingsRef.current.soundEnabled) soundManager.playOutgoingMessageSound();

      // REST response vẫn là ciphertext. Decrypt trước khi đưa lại vào UI state.
      const serverMsg = await decryptMessagePayload(res.data);
      setMessages((prev) => {
        // Nếu WebSocket đã đưa serverMsg vào state trước REST response, chỉ bỏ optimistic.
        if (prev.some((m) => m.id === serverMsg.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? serverMsg : m));
      });
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi gửi tin nhắn.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw err;
    }
  };

  const handleConfirmForward = async (messageId, targetConvIds) => {
    if (!session.isActive()) return;
    try {
      const sourceMessage =
        (forwardingMessage?.id === messageId ? forwardingMessage : null) ||
        messages.find((m) => m.id === messageId);

      if (!sourceMessage) {
        throw new Error('Không tìm thấy message nguồn để forward');
      }

      if (sourceMessage.messageType === 'TEXT') {
        // Không copy ciphertext giữa 2 conversation vì mỗi conversation dùng AES key khác nhau.
        // UI state đã chứa plaintext => encrypt lại riêng cho từng conversation đích.
        const plaintext = getReadableMessageText(sourceMessage);
        if (!plaintext) {
          throw new Error('Không có plaintext hợp lệ để forward');
        }

        for (const targetConversationId of targetConvIds) {
          const key = await getSessionKey(targetConversationId, currentUser.id);
          const encrypted = await encryptMessage(plaintext, key);
          session.assertActive();

          await api.post(`${API_BASE}/chat/messages`, {
            conversationId: targetConversationId,
            senderId: currentUser.id,
            content: null,
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            encryptionVersion: encrypted.encryptionVersion,
            replyToId: null,
            messageType: 'TEXT',
            mediaUrl: null,
            fileName: null,
            fileSize: null
          });
        }
      } else {
        // IMAGE/FILE vẫn dùng endpoint forward cũ trong phase AES-TEXT.
        await api.post(`${API_BASE}/chat/messages/forward`, {
          messageId,
          senderId: currentUser.id,
          targetConversationIds: targetConvIds
        });
      }

      if (!session.isActive()) return;
      if (settingsRef.current.soundEnabled) soundManager.playOutgoingMessageSound();
      fetchConversations(currentUser.id);
      setActiveToast({
        title: 'Chuyển tiếp thành công',
        content: `Đã gửi tin nhắn đến ${targetConvIds.length} cuộc trò chuyện.`,
        conversation: null
      });
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi chuyển tiếp tin nhắn.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
      setActiveToast({
        title: 'Lỗi',
        content: 'Có lỗi xảy ra khi chuyển tiếp tin nhắn.',
        conversation: null
      });
      throw err;
    }
  };

  const handleEditMessage = async (messageId, newContent) => {
    if (!session.isActive()) return;
    try {
      if (!activeConv || !currentUser?.id) return;
      getReadableMessageText(messages.find((message) => message.id === messageId));

      const key = await getSessionKey(activeConv.conversationId, currentUser.id);
      const encrypted = await encryptMessage(newContent, key); // encrypt lại => IV mới
      session.assertActive();

      const res = await api.put(`${API_BASE}/chat/messages/edit`, {
        messageId,
        senderId: currentUser.id,
        content: null,
        ciphertext: encrypted.ciphertext,
        iv: encrypted.iv,
        encryptionVersion: encrypted.encryptionVersion
      });

      const updated = await decryptMessagePayload(res.data);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi sửa tin nhắn.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
      throw err;
    }
  };

  const handleDeleteMessage = (messageId) => {
    if (!session.isActive()) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Thu hồi tin nhắn',
      message: 'Bạn có chắc chắn muốn thu hồi tin nhắn này đối với mọi người trong phòng chat?',
      onConfirm: async () => {
        if (!session.isActive()) return;
        try {
          const res = await api.delete(`${API_BASE}/chat/messages/${messageId}`, {
            params: { senderId: currentUser.id }
          });
          const updated = await decryptMessagePayload(res.data);
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        } catch (err) {
          if (!session.isActive()) return;
          console.error('Lỗi thu hồi tin nhắn.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
        } finally {
          if (session.isActive()) setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleToggleReaction = async (messageId, reaction) => {
    if (!session.isActive()) return;
    try {
      if (settingsRef.current.soundEnabled) soundManager.playReactionSound();
      const res = await api.post(`${API_BASE}/chat/messages/reaction`, {
        messageId,
        userId: currentUser.id,
        reaction
      });
      const updated = await decryptMessagePayload(res.data);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi thả reaction.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
    }
  };

  const handleTogglePinMessage = async (messageId) => {
    if (!session.isActive()) return;
    try {
      const res = await api.put(`${API_BASE}/chat/messages/${messageId}/pin`, null, {
        params: { userId: currentUser.id }
      });
      const updated = await decryptMessagePayload(res.data);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi ghim tin nhắn.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
    }
  };

  const handleSendTyping = async (isTyping) => {
    if (!session.isActive() || !activeConv || !currentUser) return;
    try {
      await api.post(`${API_BASE}/chat/typing`, {
        conversationId: activeConv.conversationId,
        userId: currentUser.id,
        userName: currentUser?.displayName || "Người dùng",
        isTyping: Boolean(isTyping)
      });
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi gửi typing.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
    }
  };

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query || !currentUser?.id) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!session.isActive()) return;
      try {
        const res = await api.get(`${API_BASE}/users/search`, {
          params: { query, currentUserId: currentUser.id },
          signal: controller.signal
        });
        if (!controller.signal.aborted && session.isActive()) setSearchResults({ query, items: res.data });
      } catch (err) {
        if (controller.signal.aborted || !session.isActive()) return;
        if (err.code !== 'ERR_CANCELED') console.error('Lỗi tìm kiếm user.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
      }
    }, 300);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [searchQuery, currentUser?.id, api, session]);

  const handleStartChatWithUser = async (targetUser) => {
    if (!session.isActive()) return;
    try {
      const res = await api.post(`${API_BASE}/chat/conversations/direct`, {
        user1Id: currentUser.id,
        user2Id: targetUser.id
      });
      const convData = res.data;
      if (!session.isActive()) return;

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
      fetchConversations(currentUser.id);
    } catch (err) {
      if (!session.isActive()) return;
      console.error('Lỗi tạo phòng chat.', { status: Number.isInteger(err?.response?.status) ? err.response.status : null });
    }
  };

  const handleSendFriendRequest = async (addresseeId) => {
    if (!session.isActive()) return;
    try {
      await api.post(`${API_BASE}/friends/request`, null, {
        params: { requesterId: currentUser.id, addresseeId }
      });
      if (!session.isActive()) return;
      setActiveToast({
        title: 'Thành công',
        content: 'Đã gửi lời mời kết bạn!',
        conversation: null
      });
    } catch (err) {
      if (!session.isActive()) return;
      setActiveToast({
        title: 'Thông báo',
        content: err.response?.data?.message || 'Lời mời kết bạn đã tồn tại hoặc đã là bạn bè.',
        conversation: null
      });
    }
  };

  const handleGroupCreated = (newGroup) => {
    if (!session.isActive()) return;
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
    if (!session.isActive()) return;
    setActiveConv(null);
    setMessages([]);
    fetchConversations(currentUser.id);
  };

  const handleJumpToMessage = (msgId) => {
    if (!session.isActive()) return;
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

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
          searchResults={searchResults.query === searchQuery.trim() ? searchResults.items : []}
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
        onProfileUpdated={session.guard((updated) => {
          const newUser = { ...currentUser, ...updated };
          setCurrentUser(newUser);
          localStorage.setItem('auth_user', JSON.stringify(newUser));
        })}
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
        onGroupUpdated={session.guard((updatedConv) => {
          fetchConversations(currentUser.id);
          setActiveConv((prev) => ({
            ...prev,
            title: updatedConv.title,
            theme: updatedConv.theme || prev.theme
          }));
        })}
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
