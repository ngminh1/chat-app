import React, { useEffect } from 'react';
import { X, MessageSquare } from 'lucide-react';

export default function ToastNotification({ toast, onClose, onSelectConversation }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-top-4 fade-in duration-200">
      <div
        onClick={() => {
          onSelectConversation(toast.conversation);
          onClose();
        }}
        className="bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-2xl p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-all border-l-4 border-l-[#0084FF]"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {toast.avatarUrl ? (
            <img
              src={toast.avatarUrl}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {(toast.title || toast.senderName || 'U').charAt(0).toUpperCase()}
            </div>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#0084FF] text-white rounded-full flex items-center justify-center text-[9px] shadow-xs">
            <MessageSquare className="w-2.5 h-2.5" />
          </span>
        </div>

        {/* Nội dung */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs font-bold text-slate-900 truncate">
              {toast.title || toast.senderName}
            </h4>
            <span className="text-[10px] text-slate-400">Vừa xong</span>
          </div>
          <p className="text-xs text-slate-600 truncate mt-0.5">
            {toast.isGroup && toast.senderName ? `${toast.senderName}: ` : ''}
            {toast.content}
          </p>
        </div>

        {/* Nút đóng */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}