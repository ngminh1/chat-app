

export function SidebarSkeleton({ isDarkMode }) {
  return (
    <div className="p-3 space-y-3 animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7].map((item) => (
        <div key={item} className="flex items-center gap-3 p-2 rounded-xl">
          {/* Avatar Skeleton */}
          <div className={`w-12 h-12 rounded-full flex-shrink-0 ${
            isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
          }`} />

          {/* Info Skeleton */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex justify-between items-center">
              <div className={`h-3.5 w-28 rounded-md ${
                isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
              }`} />
              <div className={`h-2.5 w-10 rounded-md ${
                isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
              }`} />
            </div>
            <div className={`h-2.5 w-40 rounded-md ${
              isDarkMode ? 'bg-slate-800/60' : 'bg-slate-100'
            }`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatTimelineSkeleton({ isDarkMode }) {
  return (
    <div className="p-4 space-y-4 animate-pulse flex-1 flex flex-col justify-end">
      {/* Tin nhắn nhận */}
      <div className="flex items-end gap-2 max-w-[70%]">
        <div className={`w-7 h-7 rounded-full flex-shrink-0 ${
          isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
        }`} />
        <div className={`h-10 w-48 rounded-2xl rounded-bl-xs ${
          isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
        }`} />
      </div>

      {/* Tin nhắn gửi */}
      <div className="flex items-end justify-end gap-2 self-end max-w-[70%]">
        <div className={`h-14 w-60 rounded-2xl rounded-br-xs ${
          isDarkMode ? 'bg-blue-900/40' : 'bg-blue-100'
        }`} />
      </div>

      {/* Tin nhắn nhận (Ảnh) */}
      <div className="flex items-end gap-2 max-w-[70%]">
        <div className={`w-7 h-7 rounded-full flex-shrink-0 ${
          isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
        }`} />
        <div className={`h-36 w-52 rounded-2xl rounded-bl-xs ${
          isDarkMode ? 'bg-slate-800' : 'bg-slate-200'
        }`} />
      </div>

      {/* Tin nhắn gửi ngắn */}
      <div className="flex items-end justify-end gap-2 self-end max-w-[70%]">
        <div className={`h-9 w-32 rounded-2xl rounded-br-xs ${
          isDarkMode ? 'bg-blue-900/40' : 'bg-blue-100'
        }`} />
      </div>
    </div>
  );
}