import React from 'react';
import { MessageSquarePlus } from 'lucide-react';
import DispatchLogo from './DispatchLogo';

export default function EmptyState({ isDarkMode, onNewConversation }) {
  return (
    <div className={`hidden md:flex flex-1 flex-col items-center justify-center p-8 select-none text-center transition-colors ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Biểu tượng Dispatch */}
      <div className="mb-4">
        <DispatchLogo size={50} />
      </div>

      <h2 className="text-lg font-bold tracking-tight mb-1.5 text-slate-900 dark:text-white">
        Bắt đầu cuộc trò chuyện
      </h2>
      
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-5 leading-relaxed">
        Tìm kiếm liên hệ hoặc chọn một cuộc trò chuyện từ danh sách bên trái.
      </p>

      {/* Nút Tạo cuộc trò chuyện mới */}
      <button
        onClick={onNewConversation}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#0062FF] hover:bg-[#0052D9] text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span>Cuộc trò chuyện mới</span>
      </button>
    </div>
  );
}