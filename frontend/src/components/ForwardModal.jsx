import { useState } from 'react';
import ProtectedMediaImage from './ProtectedMediaImage';
import { publicMediaUrl } from '../utils/mediaAccess';
import {
  X,
  Share2,
  Search,
  Check,
  Loader2,
  FileText,
  Send
} from 'lucide-react';

export default function ForwardModal({
  isOpen,
  onClose,
  messageToForward,
  conversations,
  onConfirmForward,
  isDarkMode
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConvIds, setSelectedConvIds] = useState([]);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen || !messageToForward) return null;

  const toggleSelectConv = (convId) => {
    setSelectedConvIds((prev) =>
      prev.includes(convId) ? prev.filter((id) => id !== convId) : [...prev, convId]
    );
  };

  const filteredConversations = conversations.filter((c) => {
    const title = c.title || c.otherUser?.displayName || '';
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleSend = async () => {
    if (selectedConvIds.length === 0 || isSending) return;
    setIsSending(true);
    try {
      await onConfirmForward(messageToForward.id, selectedConvIds);
      setSelectedConvIds([]);
      onClose();
    } catch (err) {
      console.error("Lỗi chuyển tiếp:", err);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 border ${
          isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0062FF]/10 text-[#0062FF] flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Chuyển tiếp tin nhắn</h2>
              <p className="text-[11px] text-slate-400">Gửi tin nhắn này đến các cuộc trò chuyện khác</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Preview Box */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60">
          <div className={`p-3 rounded-xl border text-xs ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
          }`}>
            <span className="font-bold text-[#0062FF] block mb-1">
              Tin nhắn từ {messageToForward.senderName}:
            </span>
            {messageToForward.messageType === 'IMAGE' ? (
              <div className="flex items-center gap-2">
                <ProtectedMediaImage src={messageToForward.mediaUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-slate-300 dark:border-slate-700" />
                <span className="truncate">{messageToForward.content || '[Hình ảnh]'}</span>
              </div>
            ) : messageToForward.messageType === 'FILE' ? (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0062FF]" />
                <span className="truncate font-medium">{messageToForward.fileName}</span>
              </div>
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{messageToForward.content}</p>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm cuộc trò chuyện..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border focus:outline-none focus:border-[#0062FF] transition-all ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
              }`}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 dark:divide-slate-800/60">
          {filteredConversations.length === 0 ? (
            <p className="text-center py-8 text-xs text-slate-400">Không tìm thấy cuộc trò chuyện</p>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = selectedConvIds.includes(c.conversationId);
              const title = c.title || c.otherUser?.displayName || 'Cuộc trò chuyện';
              const avatar = c.avatarUrl || c.otherUser?.avatarUrl;
              const isGroup = c.type === 'GROUP';

              return (
                <div
                  key={c.conversationId}
                  onClick={() => toggleSelectConv(c.conversationId)}
                  className={`p-2 flex items-center justify-between rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50/80 dark:bg-blue-950/40' : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {avatar ? (
                      <img src={publicMediaUrl(avatar)} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                    ) : (
                      <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-xs ${
                        isGroup ? 'bg-purple-600' : 'bg-gradient-to-tr from-[#0062FF] to-sky-400'
                      }`}>
                        {title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs font-semibold truncate">{title}</span>
                  </div>

                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                    isSelected ? 'bg-[#0062FF] border-[#0062FF] text-white shadow-xs' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className={`p-4 border-t flex items-center justify-between gap-3 ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/60 border-slate-200'
        }`}>
          <span className="text-xs font-medium text-slate-400">
            Đã chọn: <b className="text-[#0062FF]">{selectedConvIds.length}</b>
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleSend}
              disabled={selectedConvIds.length === 0 || isSending}
              className="px-3 py-1.5 text-xs font-semibold text-white rounded-xl bg-[#0062FF] hover:bg-[#0052D9] shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Gửi chuyển tiếp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
