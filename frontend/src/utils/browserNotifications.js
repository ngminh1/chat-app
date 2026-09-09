export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    alert("Trình duyệt của bạn không hỗ trợ thông báo trên màn hình.");
    return 'unsupported';
  }
  return await Notification.requestPermission();
};

export const showDesktopNotification = (title, body, iconUrl = null, onClickCallback = null) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body: body || 'Bạn có một tin nhắn mới',
      icon: iconUrl || '/favicon.ico',
      silent: true // Âm thanh do soundManager đảm nhận để tránh phát trùng lặp
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      if (onClickCallback && typeof onClickCallback === 'function') {
        onClickCallback();
      }
    };
  } catch (err) {
    console.warn("Lỗi hiển thị thông báo desktop:", err);
  }
};