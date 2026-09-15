import React from 'react';
import { X, Pin, PinOff, ExternalLink } from 'lucide-react';
import { formatMessageTime } from '../utils/formatTime';

export default function PinnedMessagesModal({
  isOpen,
  onClose,
  pinnedMessages,
  onUnpin,
  onJumpToMessage
}) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 text-slate-900 dark:text-slate-100 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 text-[#0062FF] flex items-center justify-center">
              <Pin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Tin nhắn đã ghim</h2>
              <p className="text-[11px] text-slate-400">
                {pinnedMessages.length} tin nhắn quan trọng trong cuộc trò chuyện
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100 dark:divide-slate-800">
          {pinnedMessages.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Chưa có tin nhắn nào được ghim trong cuộc trò chuyện này.
            </div>
          ) : (
            pinnedMessages.map((msg) => (
              <div
                key={msg.id}
                className="pt-2 first:pt-0 flex items-start justify-between gap-3 group hover:bg-slate-50 dark:hover:bg-slate-800/60 p-2 rounded-xl transition-colors"
              >
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    onJumpToMessage(msg.id);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {msg.senderName}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatMessageTime(msg.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 break-words line-clamp-2">
                    {msg.messageType === 'IMAGE'
                      ? '[Hình ảnh]'
                      : msg.messageType === 'FILE'
                      ? `[Tệp] ${msg.fileName || ''}`
                      : msg.content}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                  <button
                    onClick={() => {
                      onJumpToMessage(msg.id);
                      onClose();
                    }}
                    className="p-1.5 text-slate-400 hover:text-[#0062FF] hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Đi tới tin nhắn"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onUnpin(msg.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                    title="Bỏ ghim"
                  >
                    <PinOff className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}