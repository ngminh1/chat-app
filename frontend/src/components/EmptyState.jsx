import React from 'react';
import { MessageSquare, Users, Shield, Zap } from 'lucide-react';

export default function EmptyState({ isDarkMode }) {
  return (
    <div className={`hidden md:flex flex-1 flex-col items-center justify-center p-8 select-none text-center transition-colors ${
      isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#0084FF] to-sky-400 flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-6 animate-bounce [animation-duration:3s]">
        <MessageSquare className="w-10 h-10 stroke-[2.5]" />
      </div>

      <h2 className="text-2xl font-bold tracking-tight mb-2">Chào mừng bạn đến với ChatApp!</h2>
      <p className="text-sm text-slate-400 max-w-sm mb-8">
        Chọn một cuộc trò chuyện từ danh sách bên trái hoặc tìm kiếm bạn bè mới để bắt đầu nhắn tin.
      </p>

      <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
        <div className={`p-4 rounded-2xl border text-center ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-[#0084FF] flex items-center justify-center mx-auto mb-2">
            <Zap className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold">Thời gian thực</h4>
          <p className="text-[10px] text-slate-400 mt-1">Gửi nhận tin nhắn tức thì qua WebSocket</p>
        </div>

        <div className={`p-4 rounded-2xl border text-center ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center mx-auto mb-2">
            <Users className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold">Nhóm trò chuyện</h4>
          <p className="text-[10px] text-slate-400 mt-1">Tạo nhóm & quản lý thành viên linh hoạt</p>
        </div>

        <div className={`p-4 rounded-2xl border text-center ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
        }`}>
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto mb-2">
            <Shield className="w-4 h-4" />
          </div>
          <h4 className="text-xs font-bold">Bảo mật JWT</h4>
          <p className="text-[10px] text-slate-400 mt-1">Xác thực an toàn với BCrypt & Token</p>
        </div>
      </div>
    </div>
  );
}