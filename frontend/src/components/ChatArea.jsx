import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Send,
  Info,
  Image as ImageIcon,
  Paperclip,
  ThumbsUp,
  Smile,
  Loader2,
  Reply,
  Edit2,
  Trash2,
  X,
  Check,
  FileText,
  Download,
  Pin,
  PinOff,
  Search,
  ChevronUp,
  ChevronDown,
  Share2,
  FolderOpen,
  ArrowLeft,
  AlertCircle,
  ArrowDown,
  Clock
} from 'lucide-react';
import { formatMessageTime, formatSidebarTime, formatDateDivider, isSameDay } from '../utils/formatTime';
import { CHAT_THEMES } from '../utils/themeConfig';
import { ChatTimelineSkeleton } from './Skeletons';
import { API_BASE } from '../config/api';

const REACTION_LIST = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // Giới hạn 25MB

export default function ChatArea({
  activeConversation,
  messages,
  currentUserId,
  currentUserName,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onTogglePinMessage,
  onSendTyping,
  typingUser,
  isLoadingMessages,
  onOpenGroupDetailModal,
  onOpenPinnedModal,
  onOpenMediaGallery,
  onStartForwardMessage,
  onBack,
  isDarkMode,
  presenceMap,
  lastSeenMap
}) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  const [sendErrorMessage, setSendErrorMessage] = useState('');
  const [previewModalImg, setPreviewModalImg] = useState(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSearchingLoading, setIsSearchingLoading] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentTheme = CHAT_THEMES[activeConversation?.theme] || CHAT_THEMES.blue;

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceFromBottom > 240);
  };

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (!highlightedMsgId && !showScrollBottom) {
      scrollToBottom('smooth');
    }
  }, [messages, typingUser, selectedFile]);

  useEffect(() => {
    scrollToBottom('auto');
    setSendErrorMessage('');
    setReplyingTo(null);
    setEditingMessage(null);
    removeSelectedFile();
  }, [activeConversation?.conversationId]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingLoading(true);
      try {
        const res = await axios.get(
          `${API_BASE}/chat/conversations/${activeConversation.conversationId}/search`,
          { params: { query: searchQuery.trim() } }
        );
        setSearchResults(res.data);
        setCurrentSearchIndex(0);
        if (res.data.length > 0) {
          jumpToMessageId(res.data[0].id);
        }
      } catch (err) {
        console.error("Lỗi tìm kiếm tin nhắn:", err);
      } finally {
        setIsSearchingLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeConversation?.conversationId]);

  const jumpToMessageId = (msgId) => {
    setHighlightedMsgId(msgId);
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      setHighlightedMsgId(null);
    }, 2500);
  };

  const handleNextSearch = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    jumpToMessageId(searchResults[nextIndex].id);
  };

  const handlePrevSearch = () => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    jumpToMessageId(searchResults[prevIndex].id);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setSendErrorMessage("Tệp tin quá lớn! Dung lượng tối đa cho phép là 25MB.");
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    setUploadPercent(0);
    setSendErrorMessage('');
    if (file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
    e.target.value = '';
  };

  const handlePaste = (e) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          if (file.size > MAX_FILE_SIZE) {
            setSendErrorMessage("Tệp tin dán quá lớn! Dung lượng tối đa là 25MB.");
            return;
          }
          e.preventDefault();
          setSelectedFile(file);
          setUploadPercent(0);
          setSendErrorMessage('');
          if (file.type.startsWith('image/')) {
            setFilePreviewUrl(URL.createObjectURL(file));
          } else {
            setFilePreviewUrl(null);
          }
          break;
        }
      }
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setUploadPercent(0);
    if (filePreviewUrl) {
      URL.revokeObjectURL(filePreviewUrl);
      setFilePreviewUrl(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || isSending || isUploading) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onSendTyping(false);

    setSendErrorMessage('');

    if (editingMessage) {
      setIsSending(true);
      try {
        await onEditMessage(editingMessage.id, inputText.trim());
        setEditingMessage(null);
        setInputText('');
      } catch (err) {
        setSendErrorMessage("Không thể chỉnh sửa tin nhắn.");
      } finally {
        setIsSending(false);
      }
      return;
    }

    if (selectedFile) {
      setIsUploading(true);
      setUploadPercent(0);
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await axios.post(`${API_BASE}/media/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadPercent(percent);
            }
          }
        });

        const { fileUrl, fileName, fileSize, messageType } = uploadRes.data;

        await onSendMessage(
          inputText.trim(),
          replyingTo?.id,
          messageType,
          fileUrl,
          fileName,
          fileSize
        );

        removeSelectedFile();
        setInputText('');
        setReplyingTo(null);
        scrollToBottom('smooth');
      } catch (err) {
        console.error("Lỗi gửi file:", err);
        setSendErrorMessage("Không thể tải lên hoặc gửi tệp tin.");
      } finally {
        setIsUploading(false);
        setUploadPercent(0);
      }
      return;
    }

    // Gửi tin nhắn Text với Optimistic UI
    setIsSending(true);
    try {
      const text = inputText.trim();
      const replyId = replyingTo?.id;
      setInputText('');
      setReplyingTo(null);
      scrollToBottom('smooth');
      await onSendMessage(text, replyId, 'TEXT', null, null, null);
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
      setSendErrorMessage("Không thể gửi tin nhắn.");
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value);
    if (sendErrorMessage) setSendErrorMessage('');

    if (value.trim().length > 0) {
      onSendTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        onSendTyping(false);
      }, 2000);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      onSendTyping(false);
    }
  };

  const handleSendLike = async () => {
    if (isSending) return;
    setIsSending(true);
    setSendErrorMessage('');
    try {
      await onSendMessage('👍', null, 'TEXT', null, null, null);
      scrollToBottom('smooth');
    } catch (err) {
      setSendErrorMessage("Không thể gửi biểu tượng chào.");
    } finally {
      setIsSending(false);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    removeSelectedFile();
    setInputText(msg.content || '');
    setSendErrorMessage('');
  };

  const cancelEditOrReply = () => {
    setEditingMessage(null);
    setReplyingTo(null);
    removeSelectedFile();
    setInputText('');
    setSendErrorMessage('');
  };

  const isGroup = activeConversation.type === 'GROUP';
  const headerTitle = activeConversation.title || (activeConversation.otherUser ? activeConversation.otherUser.displayName : 'Đoạn chat');
  const headerAvatar = activeConversation.avatarUrl || (activeConversation.otherUser ? activeConversation.otherUser.avatarUrl : '');

  const otherUserId = activeConversation.otherUser?.id;
  const isOtherOnline = !isGroup && otherUserId ? (presenceMap[otherUserId] ?? false) : false;
  const otherLastSeen = !isGroup && otherUserId ? lastSeenMap[otherUserId] : null;

  const getPresenceText = () => {
    if (typingUser) return `${typingUser} đang soạn tin nhắn...`;
    if (isGroup) return `${activeConversation.memberCount || 2} thành viên`;
    if (isOtherOnline) return 'Đang hoạt động';
    if (otherLastSeen) return `Hoạt động ${formatSidebarTime(otherLastSeen)}`;
    return 'Không hoạt động';
  };

  const pinnedMessages = messages.filter((m) => m.isPinned && !m.isDeleted);
  const latestPinned = pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null;

  return (
    <main className={`flex-1 flex flex-col h-full overflow-hidden select-none relative transition-colors ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
    }`}>
      {/* File inputs: Chặn file thực thi nguy hiểm */}
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* 1. Header cuộc trò chuyện */}
      <header className={`h-16 border-b px-4 md:px-5 flex items-center justify-between shadow-2xs flex-shrink-0 z-10 transition-colors ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200/80'
      }`}>
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="relative flex-shrink-0">
            {headerAvatar ? (
              <img src={headerAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
            ) : (
              <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-xs ${
                isGroup ? 'bg-gradient-to-tr from-purple-600 to-indigo-500' : 'bg-gradient-to-tr from-[#0062FF] to-sky-400'
              }`}>
                {headerTitle ? headerTitle.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            {!isGroup && (
              <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 ${
                isDarkMode ? 'border-slate-900' : 'border-white'
              } ${isOtherOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="font-bold text-sm leading-tight truncate text-slate-900 dark:text-white">
              {headerTitle}
            </h2>
            <span className={`text-xs block truncate font-medium mt-0.5 ${
              typingUser ? 'text-[#0062FF] animate-pulse font-semibold' : isOtherOnline ? 'text-emerald-500' : 'text-slate-400'
            }`}>
              {getPresenceText()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
          <button
            onClick={onOpenMediaGallery}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Kho lưu trữ Media & Tệp"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setIsSearching(!isSearching); setSearchQuery(''); setSearchResults([]); }}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              isSearching ? 'bg-blue-50 text-[#0062FF] dark:bg-slate-800 dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Tìm kiếm tin nhắn"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenGroupDetailModal}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Thông tin cuộc trò chuyện"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Tìm kiếm */}
      {isSearching && (
        <div className={`px-4 py-2 border-b flex items-center justify-between gap-3 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`flex-1 flex items-center border rounded-xl px-3 py-1.5 ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <Search className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder="Tìm tin nhắn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 text-xs bg-transparent focus:outline-none placeholder:text-slate-400"
              autoFocus
            />
            {isSearchingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0062FF]" />}
          </div>

          {searchResults.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-slate-400 font-semibold">
              <span>{currentSearchIndex + 1}/{searchResults.length}</span>
              <button onClick={handlePrevSearch} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={handleNextSearch} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          <button onClick={() => { setIsSearching(false); setSearchQuery(''); setSearchResults([]); }} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ghim tin nhắn */}
      {latestPinned && (
        <div className={`px-4 py-2 border-b flex items-center justify-between gap-3 flex-shrink-0 ${
          isDarkMode ? 'bg-blue-950/40 border-blue-900/50 text-blue-200' : 'bg-blue-50/80 border-blue-200/80 text-blue-950'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onClick={() => jumpToMessageId(latestPinned.id)}>
            <div className="w-6 h-6 rounded-lg bg-[#0062FF] text-white flex items-center justify-center flex-shrink-0">
              <Pin className="w-3.5 h-3.5" />
            </div>
            <div className="truncate text-xs">
              <span className="font-bold mr-1">
                {pinnedMessages.length > 1 ? `${pinnedMessages.length} tin nhắn đã ghim:` : 'Tin nhắn đã ghim:'}
              </span>
              <span className="opacity-90 truncate">
                {latestPinned.messageType === 'IMAGE' ? '[Hình ảnh]' : latestPinned.messageType === 'FILE' ? `[Tệp] ${latestPinned.fileName || ''}` : latestPinned.content}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {pinnedMessages.length > 1 && (
              <button onClick={onOpenPinnedModal} className="text-xs font-bold text-[#0062FF] hover:underline px-1.5 py-0.5 rounded cursor-pointer">
                Xem tất cả ({pinnedMessages.length})
              </button>
            )}
            <button onClick={() => onTogglePinMessage(latestPinned.id)} className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg cursor-pointer" title="Bỏ ghim">
              <PinOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Danh sách tin nhắn */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className={`flex-1 p-4 md:p-5 overflow-y-auto space-y-3 transition-colors ${
          isDarkMode ? 'bg-slate-950' : 'bg-white'
        }`}
      >
        {isLoadingMessages ? (
          <ChatTimelineSkeleton isDarkMode={isDarkMode} />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
            <div className={`w-16 h-16 rounded-full text-white flex items-center justify-center text-xl font-bold mb-3 shadow-md ${
              isGroup ? 'bg-purple-600' : 'bg-gradient-to-tr from-[#0062FF] to-sky-400'
            }`}>
              {headerTitle.charAt(0).toUpperCase()}
            </div>
            <h4 className="font-bold text-base text-slate-700 dark:text-slate-200">{headerTitle}</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">Chưa có tin nhắn nào trong cuộc trò chuyện này. Hãy gửi lời chào đầu tiên!</p>
            <button
              onClick={handleSendLike}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#0062FF] text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ThumbsUp className="w-4 h-4" /> Vẫy tay chào 👍
            </button>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === currentUserId;
            const isSystem = msg.messageType === 'SYSTEM';
            const isDeleted = msg.isDeleted;
            const isImage = msg.messageType === 'IMAGE' && !isDeleted;
            const isFile = msg.messageType === 'FILE' && !isDeleted;
            const isLike = msg.content === '👍' && !isDeleted && !isImage && !isFile;
            const isHighlighted = highlightedMsgId === msg.id;
            const isSendingOptimistic = msg.isOptimistic;

            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDateDivider = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);

            return (
              <React.Fragment key={msg.id || `msg-temp-${index}`}>
                {showDateDivider && (
                  <div className="flex justify-center my-4 select-none">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide border shadow-2xs ${
                      isDarkMode
                        ? 'bg-slate-900 border-slate-800 text-slate-400'
                        : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}>
                      {formatDateDivider(msg.createdAt)}
                    </span>
                  </div>
                )}

                {isSystem ? (
                  <div id={`msg-${msg.id}`} className="flex justify-center my-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border text-center ${
                      isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200/80 text-slate-600'
                    }`}>
                      {msg.content}
                    </span>
                  </div>
                ) : (
                  <div
                    id={`msg-${msg.id}`}
                    onMouseEnter={() => !isSendingOptimistic && setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    className={`relative flex items-end gap-2.5 group transition-all duration-300 rounded-xl p-1 ${
                      isHighlighted ? 'bg-blue-100/50 dark:bg-blue-950/40 ring-2 ring-[#0062FF]' : ''
                    } ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMe && (
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mb-1">
                        {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}

                    {/* Thanh cảm xúc nổi */}
                    {!isDeleted && !isSendingOptimistic && hoveredMessageId === msg.id && (
                      <div className={`absolute -top-8 ${isMe ? 'right-0' : 'left-9'} border shadow-md rounded-full px-2 py-0.5 flex items-center gap-1 z-20 ${
                        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                      }`}>
                        <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-700">
                          {REACTION_LIST.map((emoji) => (
                            <button key={emoji} onClick={() => onToggleReaction(msg.id, emoji)} className="hover:scale-125 transition-transform text-sm p-1 cursor-pointer">
                              {emoji}
                            </button>
                          ))}
                        </div>

                        <button onClick={() => setReplyingTo(msg)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer" title="Trả lời">
                          <Reply className="w-3.5 h-3.5" />
                        </button>

                        <button onClick={() => onStartForwardMessage(msg)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer" title="Chuyển tiếp">
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        <button onClick={() => onTogglePinMessage(msg.id)} className={`p-1 rounded-full cursor-pointer ${msg.isPinned ? 'text-[#0062FF]' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title={msg.isPinned ? 'Bỏ ghim' : 'Ghim'}>
                          <Pin className="w-3.5 h-3.5" />
                        </button>

                        {isMe && (
                          <>
                            {!isImage && !isFile && (
                              <button onClick={() => handleStartEdit(msg)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer" title="Chỉnh sửa">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button onClick={() => onDeleteMessage(msg.id)} className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 rounded-full cursor-pointer" title="Thu hồi">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%] md:max-w-lg ${isSendingOptimistic ? 'opacity-70' : ''}`}>
                      {isGroup && !isMe && msg.senderName && (
                        <span className="text-xs font-semibold text-slate-400 ml-1 mb-1">{msg.senderName}</span>
                      )}

                      {msg.replyTo && (
                        <div className={`text-xs px-3 py-1.5 mb-1 rounded-xl border-l-2 truncate max-w-full ${
                          isDarkMode ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-600'
                        } ${isMe ? 'border-[#0062FF]' : 'border-slate-400'}`}>
                          <span className="font-bold mr-1">{msg.replyTo.senderName}:</span>
                          <span>{msg.replyTo.content}</span>
                        </div>
                      )}

                      {isDeleted ? (
                        <div className={`px-4 py-2.5 rounded-2xl text-sm border italic ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
                        }`}>
                          Tin nhắn đã bị thu hồi
                        </div>
                      ) : isImage ? (
                        <div className="space-y-1.5">
                          <img src={msg.mediaUrl} alt="" onClick={() => setPreviewModalImg(msg.mediaUrl)} className="rounded-2xl max-h-72 max-w-full object-cover cursor-pointer hover:opacity-95 shadow-xs border border-slate-200 dark:border-slate-800" />
                          {msg.content && (
                            <div className={`px-4 py-2 rounded-xl text-sm leading-relaxed ${isMe ? currentTheme.bgBubble : isDarkMode ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
                              {msg.content}
                            </div>
                          )}
                        </div>
                      ) : isFile ? (
                        <div className={`p-3 rounded-2xl flex items-center gap-3 shadow-xs border ${
                          isMe
                            ? isDarkMode ? 'bg-blue-950/40 border-blue-900/60 rounded-br-xs' : 'bg-blue-50 border-blue-200 rounded-br-xs'
                            : isDarkMode ? 'bg-slate-800 border-slate-700 rounded-bl-xs' : 'bg-slate-100 border-slate-200 rounded-bl-xs'
                        }`}>
                          <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center text-[#0062FF] shadow-xs flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold truncate">{msg.fileName || 'Tài liệu'}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(msg.fileSize)}</p>
                          </div>
                          {msg.mediaUrl && (
                            <a href={`${API_BASE}${msg.mediaUrl}`} download={msg.fileName} target="_blank" rel="noreferrer" className="p-2 bg-white dark:bg-slate-900 hover:bg-[#0062FF] hover:text-white text-[#0062FF] rounded-xl shadow-xs flex-shrink-0 transition-colors">
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      ) : isLike ? (
                        <div className="text-4xl select-none my-1 hover:scale-110 transition-transform">👍</div>
                      ) : (
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap select-text ${
                          isMe ? `${currentTheme.bgBubble} rounded-br-xs shadow-xs` : isDarkMode ? 'bg-slate-800 text-slate-100 rounded-bl-xs' : 'bg-slate-100 text-slate-900 rounded-bl-xs'
                        }`}>
                          {msg.content}
                        </div>
                      )}

                      {msg.reactions && msg.reactions.length > 0 && !isDeleted && (
                        <div className={`-mt-2.5 border rounded-full px-2 py-0.5 text-xs shadow-xs flex items-center gap-1 z-10 cursor-pointer ${
                          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                        } ${isMe ? 'mr-1 self-end' : 'ml-1 self-start'}`}>
                          {Array.from(new Set(msg.reactions.map((r) => r.reaction))).map((emoji) => (
                            <span key={emoji}>{emoji}</span>
                          ))}
                          {msg.reactions.length > 1 && (
                            <span className="text-xs text-slate-400 font-bold">{msg.reactions.length}</span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 px-1">
                        {isSendingOptimistic ? (
                          <span className="flex items-center gap-1 text-slate-400 italic">
                            <Clock className="w-3 h-3 animate-spin" /> Đang gửi...
                          </span>
                        ) : (
                          <>
                            {msg.isPinned && !isDeleted && (
                              <span className="flex items-center text-[#0062FF] gap-0.5 font-bold">
                                <Pin className="w-3 h-3 fill-[#0062FF]" /> Đã ghim
                              </span>
                            )}
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            {msg.isEdited && !isDeleted && <span>· Đã sửa</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}

        {typingUser && (
          <div className="flex items-center gap-2 text-slate-400 text-xs pl-1">
            <div className={`px-3.5 py-2 rounded-2xl rounded-bl-xs flex items-center gap-1.5 border ${
              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
            }`}>
              <span className="w-1.5 h-1.5 bg-[#0062FF] rounded-full animate-bounce [animation-delay:0ms]"></span>
              <span className="w-1.5 h-1.5 bg-[#0062FF] rounded-full animate-bounce [animation-delay:150ms]"></span>
              <span className="w-1.5 h-1.5 bg-[#0062FF] rounded-full animate-bounce [animation-delay:300ms]"></span>
            </div>
            <span className="text-xs text-slate-400 font-medium">{typingUser} đang soạn tin...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Nút cuộn xuống đáy */}
      {showScrollBottom && (
        <button
          onClick={() => scrollToBottom('smooth')}
          className="absolute bottom-20 right-6 p-2.5 rounded-full bg-[#0062FF] hover:bg-[#0052D9] text-white shadow-lg z-30 transition-all transform hover:scale-105 cursor-pointer animate-in fade-in"
          title="Cuộn xuống tin nhắn mới nhất"
        >
          <ArrowDown className="w-4 h-4 stroke-[2.5]" />
        </button>
      )}

      {/* 3. Thanh nhập tin nhắn */}
      <footer className={`border-t flex-shrink-0 flex flex-col transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
      }`}>
        {sendErrorMessage && (
          <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>{sendErrorMessage}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSubmit()}
                className="underline hover:opacity-80 cursor-pointer"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={() => setSendErrorMessage('')}
                className="p-1 hover:bg-rose-500/20 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {replyingTo && (
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-center gap-2 truncate">
              <Reply className="w-4 h-4 text-[#0062FF]" />
              <span>Đang trả lời <b>{replyingTo.senderName}</b>: {replyingTo.content}</span>
            </div>
            <button onClick={cancelEditOrReply} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {editingMessage && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-500">
            <div className="flex items-center gap-2 truncate">
              <Edit2 className="w-4 h-4" />
              <span>Đang chỉnh sửa tin nhắn</span>
            </div>
            <button onClick={cancelEditOrReply} className="p-1 hover:bg-amber-500/20 rounded-lg cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {selectedFile && (
          <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
            isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-3 truncate">
              {filePreviewUrl ? (
                <img src={filePreviewUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-slate-800 text-[#0062FF] flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
              )}
              <div className="text-xs truncate">
                <p className="font-bold truncate">{selectedFile.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-slate-400">{formatFileSize(selectedFile.size)}</span>
                  {isUploading && (
                    <span className="text-[#0062FF] font-bold">({uploadPercent}%)</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={removeSelectedFile} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 rounded-lg cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-3 md:p-3.5 flex items-center gap-2 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <button type="button" onClick={() => imageInputRef.current?.click()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer" title="Gửi ảnh">
              <ImageIcon className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer" title="Gửi tệp đính kèm">
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          <div className={`flex-1 flex items-center rounded-xl px-4 py-2 border transition-all ${
            isDarkMode ? 'bg-slate-800/80 border-slate-700 focus-within:border-[#0062FF] focus-within:bg-slate-800' : 'bg-slate-100/90 border-slate-200 focus-within:border-[#0062FF] focus-within:bg-white'
          }`}>
            <input
              type="text"
              placeholder="Nhập tin nhắn... (Ctrl+V để dán ảnh/tệp)"
              value={inputText}
              onChange={handleInputChange}
              onPaste={handlePaste}
              className={`w-full bg-transparent border-none text-sm focus:outline-none ${
                isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />
            <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {inputText.trim() || selectedFile ? (
            <button
              type="submit"
              disabled={isSending || isUploading}
              className="h-10 px-4 bg-[#0062FF] hover:bg-[#0052D9] text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer gap-1.5"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">{uploadPercent}%</span>
                </>
              ) : isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingMessage ? (
                <Check className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendLike}
              className="h-10 w-10 text-[#0062FF] hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center justify-center cursor-pointer"
            >
              <ThumbsUp className="w-5 h-5" />
            </button>
          )}
        </form>
      </footer>

      {previewModalImg && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs" onClick={() => setPreviewModalImg(null)}>
          <button onClick={() => setPreviewModalImg(null)} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 rounded-xl cursor-pointer">
            <X className="w-6 h-6" />
          </button>
          <img src={previewModalImg} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </main>
  );
}