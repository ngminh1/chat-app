import axios from 'axios';
import { API_BASE } from '../config/api.js';

const backendOrigin = API_BASE.replace(/\/api$/, '');

export function dispatchMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('/api/media/files/')) return `${backendOrigin}${url}`;
  if (url.startsWith('/uploads/')) return `${backendOrigin}${url}`;
  if (url.startsWith('http://localhost:8080/uploads/')) {
    return `${backendOrigin}${url.substring('http://localhost:8080'.length)}`;
  }
  if (url.startsWith(`${API_BASE}/media/files/`)) return url;
  if (url.startsWith(`${backendOrigin}/uploads/`)) return url;
  return null;
}

export function publicMediaUrl(url) {
  return dispatchMediaUrl(url) || url;
}

export function mediaImageFailure(error) {
  const status = error.response?.status;
  if (status === 404) return { status: 'missing', message: 'Ảnh không còn tồn tại', retryable: false };
  if (status === 401) return {
    status: 'unauthenticated', message: 'Vui lòng đăng nhập lại để xem ảnh.', retryable: false,
  };
  if (status === 403) return {
    status: 'forbidden', message: 'Bạn không có quyền xem ảnh này.', retryable: false,
  };
  if (status >= 500) return {
    status: 'service-error', message: 'Dịch vụ ảnh đang gặp sự cố. Vui lòng thử lại.', retryable: true,
  };
  return {
    status: 'error', message: 'Không thể tải ảnh. Vui lòng thử lại.',
    retryable: !status || status === 408 || status === 429,
  };
}

export function mediaDownloadFailure(error) {
  const failure = mediaImageFailure(error);
  const messages = {
    missing: 'Tệp không còn tồn tại',
    unauthenticated: 'Vui lòng đăng nhập lại để tải tệp.',
    forbidden: 'Bạn không có quyền tải tệp này.',
    'service-error': 'Dịch vụ tải tệp đang gặp sự cố. Vui lòng thử lại.',
    error: 'Không thể tải tệp. Vui lòng thử lại.',
  };
  return { ...failure, message: messages[failure.status] };
}

async function fetchMediaBlob(url, signal) {
  const apiUrl = dispatchMediaUrl(url);
  if (!apiUrl) throw new Error('URL tệp không hợp lệ');
  // Legacy /uploads routes require the same authentication as /api/media/files.
  // Only attach credentials after resolving a known Dispatch media route.
  const token = globalThis.localStorage?.getItem('auth_token');
  return axios.get(apiUrl, {
    responseType: 'blob', signal,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function loadMediaImage(url, onResult) {
  const controller = new AbortController();
  let disposed = false;
  let objectUrl = null;
  fetchMediaBlob(url, controller.signal)
    .then((response) => {
      // An adapter may resolve after abort; never create a leaked URL or update a removed image.
      if (disposed) return;
      objectUrl = URL.createObjectURL(response.data);
      onResult({ status: 'ready', url: objectUrl });
    })
    .catch((error) => {
      if (disposed || axios.isCancel(error) || error.name === 'AbortError') return;
      // Expected HTTP failures are visible in the image itself. Never log Axios errors,
      // whose request config can contain Authorization headers.
      onResult(mediaImageFailure(error));
    });
  return () => {
    disposed = true;
    controller.abort();
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };
}

export async function downloadMedia(url, fileName, { signal } = {}) {
  const response = await fetchMediaBlob(url, signal);
  if (signal?.aborted) throw new axios.CanceledError();
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'dispatch-file';
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
