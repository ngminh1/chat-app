import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  Image as ImageIcon,
  FileText,
  Download,
  Loader2,
  Calendar,
  Eye,
  FolderOpen
} from 'lucide-react';
import { formatSidebarTime } from '../utils/formatTime';

const API_BASE = 'http://localhost:8080/api';

export default function MediaGalleryModal({
  isOpen,
  onClose,
  conversationId,
  conversationTitle,
  onJumpToMessage,
  isDarkMode
}) {
  const [activeTab, setActiveTab] = useState('images'); // 'images' | 'files'
  const [mediaList, setMediaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [previewImg, setPreviewImg] = useState(null);

  useEffect(() => {
    if (isOpen && conversationId) {
      setLoading(true);
      axios.get(`${API_BASE}/chat/conversations/${conversationId}/media`)
        .then((res) => setMediaList(res.data))
        .catch((err) => console.error("Lỗi lấy media:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, conversationId]);

  if (!isOpen) return null;

  const images = mediaList.filter((m) => m.messageType === 'IMAGE');
  const files = mediaList.filter((m) => m.messageType === 'FILE');

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none">
      <div className={`w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 border ${
        isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isDarkMode ? 'bg-slate-800/60 border-slate-800' : 'bg-slate-50/70 border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0084FF]/10 text-[#0084FF] flex items-center justify-center">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">Kho lưu trữ Media & Tệp</h2>
              <p className="text-xs text-slate-400 truncate max-w-xs">{conversationTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className={`flex border-b px-6 pt-2 gap-4 ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'}`}>
          <button
            onClick={() => setActiveTab('images')}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'images'
                ? 'border-[#0084FF] text-[#0084FF]'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Hình ảnh ({images.length})
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`pb-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'files'
                ? 'border-[#0084FF] text-[#0084FF]'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Tài liệu & Tệp ({files.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <Loader2 className="w-7 h-7 animate-spin text-[#0084FF]" />
              <span className="text-xs">Đang tải kho lưu trữ...</span>
            </div>
          ) : activeTab === 'images' ? (
            images.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30 stroke-1" />
                Chưa có hình ảnh nào được chia sẻ trong đoạn chat này
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {images.map((item) => (
                  <div
                    key={item.id}
                    className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 cursor-pointer shadow-xs"
                    onClick={() => setPreviewImg(item.mediaUrl)}
                  >
                    <img src={item.mediaUrl} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                      <div className="flex justify-end">
                        <span className="p-1.5 bg-black/40 rounded-full text-white backdrop-blur-xs">
                          <Eye className="w-3.5 h-3.5" />
                        </span>
                      </div>
                      <div>
                        <p className="text-[10px] text-white font-medium truncate">{item.senderName}</p>
                        <p className="text-[9px] text-slate-300">{formatSidebarTime(item.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            files.length === 0 ? (
              <div className="text-center py-20 text-slate-400 text-xs">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-30 stroke-1" />
                Chưa có tệp đính kèm nào được chia sẻ trong đoạn chat này
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                      isDarkMode ? 'bg-slate-800/50 border-slate-800 hover:bg-slate-800' : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-[#0084FF]/10 text-[#0084FF] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="truncate flex-1">
                        <p className="text-xs font-semibold truncate">{item.fileName || 'Tài liệu'}</p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{formatFileSize(item.fileSize)}</span>
                          <span>•</span>
                          <span>{item.senderName}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" /> {formatSidebarTime(item.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <a
                        href={item.mediaUrl}
                        download={item.fileName}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-white dark:bg-slate-700 hover:bg-[#0084FF] hover:text-white text-[#0084FF] dark:text-slate-200 rounded-xl shadow-xs transition-colors"
                        title="Tải về"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Lightbox Preview */}
      {previewImg && (
        <div className="fixed inset-0 bg-black/90 z-60 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setPreviewImg(null)}>
          <button onClick={() => setPreviewImg(null)} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <img src={previewImg} alt="" className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}