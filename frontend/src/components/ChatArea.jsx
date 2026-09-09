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
  Palette,
  Share2,
  FolderOpen,
  ArrowLeft
} from 'lucide-react';
import { formatMessageTime, formatSidebarTime } from '../utils/formatTime';
import { CHAT_THEMES } from '../utils/themeConfig';
import { ChatTimelineSkeleton } from './Skeletons';
import { API_BASE } from '../config/api';

const REACTION_LIST = ['👍', '❤️', '😂', '😮', '😢', '😡'];

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

  const [previewModalImg, setPreviewModalImg] = useState(null);

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [isSearchingLoading, setIsSearchingLoading] = useState(false);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const currentTheme = CHAT_THEMES[activeConversation?.theme] || CHAT_THEMES.blue;

  useEffect(() => {
    if (!highlightedMsgId) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoadingMessages, typingUser, selectedFile]);

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

  const handleFileChange = (e, isImageOnly = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
    e.target.value = '';
  };

  // Tính năng Paste trực tiếp ảnh/tệp từ Clipboard (Ctrl + V)
  const handlePaste = (e) => {
    const clipboardItems = e.clipboardData?.items;
    if (!clipboardItems) return;

    for (let i = 0; i < clipboardItems.length; i++) {
      const item = clipboardItems[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setSelectedFile(file);
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
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || isSending || isUploading) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onSendTyping(false);

    setIsSending(true);

    try {
      if (editingMessage) {
        await onEditMessage(editingMessage.id, inputText.trim());
        setEditingMessage(null);
        setInputText('');
      } else if (selectedFile) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await axios.post(`${API_BASE}/media/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
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
      } else {
        await onSendMessage(inputText.trim(), replyingTo?.id, 'TEXT', null, null, null);
        setInputText('');
        setReplyingTo(null);
      }
    } catch (err) {
      console.error("Lỗi gửi tin nhắn:", err);
      alert("Không thể gửi tin nhắn hoặc file. Vui lòng kiểm tra lại kết nối!");
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputText(value);

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
    try {
      await onSendMessage('👍', null, 'TEXT', null, null, null);
    } finally {
      setIsSending(false);
    }
  };

  const handleStartEdit = (msg) => {
    setEditingMessage(msg);
    setReplyingTo(null);
    removeSelectedFile();
    setInputText(msg.content || '');
  };

  const cancelEditOrReply = () => {
    setEditingMessage(null);
    setReplyingTo(null);
    removeSelectedFile();
    setInputText('');
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
    <main className={`flex-1 flex flex-col h-full overflow-hidden select-none transition-colors ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'
    }`}>
      <input type="file" ref={imageInputRef} accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, true)} />
      <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileChange(e, false)} />

      {/* Header */}
      <header className={`h-16 border-b px-3 md:px-4 flex items-center justify-between shadow-2xs flex-shrink-0 z-10 transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
      }`}>
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          <div className="relative flex-shrink-0">
            {headerAvatar ? (
              <img src={headerAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
            ) : (
              <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center font-bold text-sm shadow-sm ${
                isGroup ? 'bg-gradient-to-tr from-purple-600 to-indigo-500' : 'bg-gradient-to-tr from-blue-600 to-sky-400'
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
            <h2 className="font-bold text-sm leading-tight truncate">{headerTitle}</h2>
            <span className={`text-[11px] block truncate font-medium ${
              typingUser ? 'text-[#0084FF] animate-pulse' : isOtherOnline ? 'text-emerald-500' : 'text-slate-400'
            }`}>
              {getPresenceText()}
            </span>
          </div>
        </div>

        {/* Thanh công cụ Header (Đã loại bỏ icon Phone và Video) */}
        <div className="flex items-center gap-0.5 md:gap-1" style={{ color: currentTheme.colorCode }}>
          <button
            onClick={onOpenMediaGallery}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            title="Kho lưu trữ Media & Tệp"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenGroupDetailModal}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            title="Đổi màu chủ đề (Theme)"
          >
            <Palette className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setIsSearching(!isSearching); setSearchQuery(''); setSearchResults([]); }}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isSearching ? 'bg-blue-100 dark:bg-slate-800' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="Tìm kiếm tin nhắn"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenGroupDetailModal}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            title="Thông tin cuộc trò chuyện"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Tìm kiếm tin nhắn */}
      {isSearching && (
        <div className={`px-4 py-2 border-b flex items-center justify-between gap-3 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`flex-1 flex items-center border rounded-lg px-3 py-1.5 ${
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
            {isSearchingLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0084FF]" />}
          </div>

          {searchResults.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <span className="font-semibold">{currentSearchIndex + 1}/{searchResults.length}</span>
              <button onClick={handlePrevSearch} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md cursor-pointer">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={handleNextSearch} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md cursor-pointer">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          )}

          <button onClick={() => { setIsSearching(false); setSearchQuery(''); setSearchResults([]); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-full cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Ghim tin nhắn */}
      {latestPinned && (
        <div className={`px-4 py-2 border-b flex items-center justify-between gap-3 flex-shrink-0 ${
          isDarkMode ? 'bg-amber-950/40 border-amber-900/50 text-amber-200' : 'bg-amber-50/90 border-amber-200/80 text-amber-950'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onClick={() => jumpToMessageId(latestPinned.id)}>
            <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 flex items-center justify-center flex-shrink-0">
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
              <button onClick={onOpenPinnedModal} className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline px-1.5 py-0.5 rounded cursor-pointer">
                Xem tất cả ({pinnedMessages.length})
              </button>
            )}
            <button onClick={() => onTogglePinMessage(latestPinned.id)} className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-full cursor-pointer" title="Bỏ ghim">
              <PinOff className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Danh sách tin nhắn */}
      <div className={`flex-1 p-3 md:p-4 overflow-y-auto space-y-3 transition-colors ${
        isDarkMode ? 'bg-slate-950' : 'bg-white'
      }`}>
        {isLoadingMessages ? (
          <ChatTimelineSkeleton isDarkMode={isDarkMode} />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
            <div className={`w-16 h-16 rounded-full text-white flex items-center justify-center text-xl font-bold mb-3 shadow-md ${
              isGroup ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}>
              {headerTitle.charAt(0).toUpperCase()}
            </div>
            <h4 className="font-bold text-base text-slate-700 dark:text-slate-200">{headerTitle}</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">Chưa có tin nhắn nào trong cuộc trò chuyện này. Hãy gửi lời chào đầu tiên!</p>
            <button
              onClick={handleSendLike}
              className="mt-4 px-4 py-2 rounded-full bg-blue-50 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#0084FF] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ThumbsUp className="w-4 h-4" /> Vẫy tay chào 👍
            </button>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            const isSystem = msg.messageType === 'SYSTEM';
            const isDeleted = msg.isDeleted;
            const isImage = msg.messageType === 'IMAGE' && !isDeleted;
            const isFile = msg.messageType === 'FILE' && !isDeleted;
            const isLike = msg.content === '👍' && !isDeleted && !isImage && !isFile;
            const isHighlighted = highlightedMsgId === msg.id;

            if (isSystem) {
              return (
                <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center my-2">
                  <span className={`px-3.5 py-1 rounded-full text-[11px] font-medium border shadow-2xs text-center ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-100/90 border-slate-200/80 text-slate-600'
                  }`}>
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                className={`relative flex items-end gap-2 group transition-all duration-300 rounded-xl p-1 ${
                  isHighlighted ? 'bg-amber-100/80 dark:bg-amber-950/40 ring-2 ring-amber-400' : ''
                } ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mb-1">
                    {msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}

                {!isDeleted && hoveredMessageId === msg.id && (
                  <div className={`absolute -top-7 ${isMe ? 'right-0' : 'left-8'} border shadow-md rounded-full px-2 py-0.5 flex items-center gap-1 z-20 ${
                    isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center gap-0.5 pr-1 border-r border-slate-200 dark:border-slate-700">
                      {REACTION_LIST.map((emoji) => (
                        <button key={emoji} onClick={() => onToggleReaction(msg.id, emoji)} className="hover:scale-125 transition-transform text-sm p-0.5 cursor-pointer">
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <button onClick={() => setReplyingTo(msg)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 cursor-pointer" title="Trả lời">
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    <button onClick={() => onStartForwardMessage(msg)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 cursor-pointer" title="Chuyển tiếp">
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    <button onClick={() => onTogglePinMessage(msg.id)} className={`p-1 rounded-full cursor-pointer ${msg.isPinned ? 'text-amber-500' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title={msg.isPinned ? 'Bỏ ghim' : 'Ghim'}>
                      <Pin className="w-3.5 h-3.5" />
                    </button>

                    {isMe && (
                      <>
                        {!isImage && !isFile && (
                          <button onClick={() => handleStartEdit(msg)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 cursor-pointer" title="Chỉnh sửa">
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

                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[75%] md:max-w-md`}>
                  {isGroup && !isMe && msg.senderName && (
                    <span className="text-[10px] font-semibold text-slate-400 ml-1 mb-0.5">{msg.senderName}</span>
                  )}

                  {msg.replyTo && (
                    <div className={`text-[11px] px-3 py-1 mb-1 rounded-lg border-l-2 truncate max-w-full ${
                      isDarkMode ? 'bg-slate-900/90 text-slate-300' : 'bg-slate-100/90 text-slate-600'
                    } ${isMe ? 'border-indigo-500' : 'border-slate-400'}`}>
                      <span className="font-semibold mr-1">{msg.replyTo.senderName}:</span>
                      <span>{msg.replyTo.content}</span>
                    </div>
                  )}

                  {isDeleted ? (
                    <div className={`px-3.5 py-2 rounded-2xl text-[14px] border italic ${
                      isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}>
                      Tin nhắn đã bị thu hồi
                    </div>
                  ) : isImage ? (
                    <div className="space-y-1">
                      <img src={msg.mediaUrl} alt="" onClick={() => setPreviewModalImg(msg.mediaUrl)} className="rounded-2xl max-h-72 max-w-full object-cover cursor-pointer hover:opacity-95 shadow-xs border border-slate-200 dark:border-slate-800" />
                      {msg.content && (
                        <div className={`px-3.5 py-1.5 rounded-xl text-[14px] ${isMe ? currentTheme.bgBubble : isDarkMode ? 'bg-slate-900 text-slate-100 border border-slate-800' : 'bg-[#F0F2F5] text-[#050505]'}`}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  ) : isFile ? (
                    <div className={`p-3 rounded-2xl flex items-center gap-3 shadow-xs border ${
                      isMe
                        ? isDarkMode ? 'bg-blue-950/40 border-blue-900/60 rounded-br-xs' : 'bg-blue-50 border-blue-200 rounded-br-xs'
                        : isDarkMode ? 'bg-slate-900 border-slate-800 rounded-bl-xs' : 'bg-[#F0F2F5] border-slate-200 rounded-bl-xs'
                    }`}>
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center text-[#0084FF] shadow-xs flex-shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{msg.fileName || 'Tài liệu'}</p>
                        <p className="text-[10px] text-slate-400">{formatFileSize(msg.fileSize)}</p>
                      </div>
                      <a href={msg.mediaUrl} download={msg.fileName} target="_blank" rel="noreferrer" className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#0084FF] rounded-full shadow-xs flex-shrink-0">
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  ) : isLike ? (
                    <div className="text-4xl select-none my-1 hover:scale-110 transition-transform">👍</div>
                  ) : (
                    <div className={`px-3.5 py-2 rounded-2xl text-[14px] leading-relaxed break-words whitespace-pre-wrap select-text ${
                      isMe ? `${currentTheme.bgBubble} rounded-br-xs shadow-xs` : isDarkMode ? 'bg-slate-900 text-slate-100 border border-slate-800/80 rounded-bl-xs' : 'bg-[#F0F2F5] text-[#050505] rounded-bl-xs'
                    }`}>
                      {msg.content}
                    </div>
                  )}

                  {msg.reactions && msg.reactions.length > 0 && !isDeleted && (
                    <div className={`-mt-2.5 border rounded-full px-1.5 py-0.5 text-xs shadow-xs flex items-center gap-1 z-10 cursor-pointer ${
                      isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    } ${isMe ? 'mr-1 self-end' : 'ml-1 self-start'}`}>
                      {Array.from(new Set(msg.reactions.map((r) => r.reaction))).map((emoji) => (
                        <span key={emoji}>{emoji}</span>
                      ))}
                      {msg.reactions.length > 1 && (
                        <span className="text-[10px] text-slate-400 font-semibold">{msg.reactions.length}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 px-1">
                    {msg.isPinned && !isDeleted && (
                      <span className="flex items-center text-amber-500 gap-0.5 font-medium">
                        <Pin className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Đã ghim
                      </span>
                    )}
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {msg.isEdited && !isDeleted && <span>· Đã chỉnh sửa</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUser && (
          <div className="flex items-center gap-2 text-slate-400 text-xs pl-1 animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className={`px-3.5 py-2 rounded-2xl rounded-bl-xs flex items-center gap-1 border ${
              isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-[#F0F2F5] border-slate-200/60'
            }`}>
              <span className="w-1.5 h-1.5 bg-[#0084FF] rounded-full animate-bounce [animation-delay:0ms]"></span>
              <span className="w-1.5 h-1.5 bg-[#0084FF] rounded-full animate-bounce [animation-delay:150ms]"></span>
              <span className="w-1.5 h-1.5 bg-[#0084FF] rounded-full animate-bounce [animation-delay:300ms]"></span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">{typingUser} đang soạn...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer / Input Bar */}
      <footer className={`border-t flex-shrink-0 flex flex-col transition-colors ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
      }`}>
        {replyingTo && (
          <div className={`px-4 py-2 border-b flex items-center justify-between text-xs ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            <div className="flex items-center gap-2 truncate">
              <Reply className="w-4 h-4 text-[#0084FF]" />
              <span>Đang trả lời <b>{replyingTo.senderName}</b>: {replyingTo.content}</span>
            </div>
            <button onClick={cancelEditOrReply} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full cursor-pointer">
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
            <button onClick={cancelEditOrReply} className="p-1 hover:bg-amber-500/20 rounded-full cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {selectedFile && (
          <div className={`px-4 py-2 border-b flex items-center justify-between ${
            isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-3 truncate">
              {filePreviewUrl ? (
                <img src={filePreviewUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-slate-800 text-[#0084FF] flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
              )}
              <div className="text-xs truncate">
                <p className="font-semibold truncate">{selectedFile.name}</p>
                <p className="text-slate-400">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button onClick={removeSelectedFile} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 rounded-full cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-2.5 md:p-3 flex items-center gap-1.5 md:gap-2 max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-0.5 md:gap-1" style={{ color: currentTheme.colorCode }}>
            <button type="button" onClick={() => imageInputRef.current?.click()} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer" title="Gửi ảnh">
              <ImageIcon className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer" title="Gửi tệp">
              <Paperclip className="w-5 h-5" />
            </button>
          </div>

          <div className={`flex-1 flex items-center rounded-full px-3.5 md:px-4 py-1.5 transition-all ${
            isDarkMode ? 'bg-slate-800 focus-within:bg-slate-800 focus-within:ring-1 focus-within:ring-[#0084FF]' : 'bg-[#F0F2F5] focus-within:bg-white focus-within:ring-1 focus-within:ring-[#0084FF]'
          }`}>
            <input
              type="text"
              placeholder="Aa (Hỗ trợ Ctrl+V paste ảnh/file)"
              value={inputText}
              onChange={handleInputChange}
              onPaste={handlePaste}
              className={`flex-1 bg-transparent border-none text-[14px] focus:outline-none ${
                isDarkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />
            <button type="button" className="text-slate-400 hover:text-slate-600 p-1">
              <Smile className="w-5 h-5" />
            </button>
          </div>

          {inputText.trim() || selectedFile ? (
            <button
              type="submit"
              disabled={isSending || isUploading}
              style={{ color: currentTheme.colorCode }}
              className="p-2 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingMessage ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSendLike}
              style={{ color: currentTheme.colorCode }}
              className="p-2 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
            >
              <ThumbsUp className="w-5 h-5" />
            </button>
          )}
        </form>
      </footer>

      {previewModalImg && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-xs" onClick={() => setPreviewModalImg(null)}>
          <button onClick={() => setPreviewModalImg(null)} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 rounded-full cursor-pointer">
            <X className="w-6 h-6" />
          </button>
          <img src={previewModalImg} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </main>
  );
}