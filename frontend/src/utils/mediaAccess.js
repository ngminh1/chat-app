import axios from 'axios';
import { API_BASE } from '../config/api';

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

export async function downloadMedia(url, fileName) {
  const apiUrl = dispatchMediaUrl(url);
  if (!apiUrl) throw new Error('URL tệp không hợp lệ');
  const response = await axios.get(apiUrl, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName || 'dispatch-file';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
