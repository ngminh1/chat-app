import { useEffect, useState } from 'react';
import axios from 'axios';
import { dispatchMediaUrl } from '../utils/mediaAccess';

export default function ProtectedMediaImage({ src, alt = '', ...props }) {
  const [resolved, setResolved] = useState(null);
  const apiUrl = dispatchMediaUrl(src);

  useEffect(() => {
    if (!apiUrl) return undefined;
    const controller = new AbortController();
    let objectUrl = null;
    axios.get(apiUrl, { responseType: 'blob', signal: controller.signal })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        setResolved({ source: src, url: objectUrl });
      })
      .catch((error) => {
        if (error.code !== 'ERR_CANCELED') console.error('Không thể tải ảnh hội thoại', error);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiUrl, src]);

  return <img src={apiUrl ? (resolved?.source === src ? resolved.url : undefined) : src}
    alt={alt} {...props} />;
}
