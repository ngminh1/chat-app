
const parseServerDate = (value) => {
  if (!value) return new Date(NaN);

  if (value instanceof Date) return value;

  // Timestamp có múi giờ (Z hoặc +07:00):
  // JavaScript tự chuyển đổi chính xác.
  // Timestamp không có múi giờ:
  // hiểu theo giờ local, không tự thêm Z.
  return new Date(value);
};

export const isSameDay = (d1, d2) => {
  if (!d1 || !d2) return false;

  const date1 = parseServerDate(d1);
  const date2 = parseServerDate(d2);

  if (
    Number.isNaN(date1.getTime()) ||
    Number.isNaN(date2.getTime())
  ) {
    return false;
  }

  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const formatDateDivider = (dateStr) => {
  if (!dateStr) return '';

  const date = parseServerDate(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, now)) return 'Hôm nay';
  if (isSameDay(date, yesterday)) return 'Hôm qua';

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatSidebarTime = (dateStr) => {
  if (!dateStr) return '';

  const date = parseServerDate(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());

  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins}p`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit'
  });
};

export const formatMessageTime = (dateStr) => {
  if (!dateStr) return '';

  const date = parseServerDate(dateStr);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};
