import { useEffect, useState } from 'react';
import { dispatchMediaUrl, loadMediaImage, mediaImageFailure } from '../utils/mediaAccess';

function MediaImage({ src, alt = '', className = '', style, onError, ...props }) {
  const apiUrl = dispatchMediaUrl(src);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const current = result?.attempt === attempt ? result : null;
  const failure = current && current.status !== 'ready' ? current : null;
  const loading = !!apiUrl && !current;

  useEffect(() => {
    if (!apiUrl) return undefined;
    return loadMediaImage(src, (value) => setResult({ ...value, attempt }));
  }, [apiUrl, src, attempt]);

  if (loading || failure || !src) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={`${className} flex flex-col items-center justify-center gap-2 p-3 text-center text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800`}
        style={{ ...style, minHeight: '5rem', height: 'auto', cursor: 'default' }}
        onClick={(event) => event.stopPropagation()}
      >
        <span>{loading ? 'Đang tải ảnh…' : failure?.message || 'Ảnh không còn tồn tại'}</span>
        {failure?.retryable && (
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 underline cursor-pointer"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </button>
        )}
      </div>
    );
  }

  return (
    <img
      {...props}
      key={attempt}
      src={apiUrl ? current.url : src}
      alt={alt}
      className={className}
      style={style}
      onError={(event) => {
        // A successful HTTP response can still contain an unsupported/corrupt image.
        // Public/external images do not expose HTTP status to the browser's img event.
        setResult({ ...mediaImageFailure({}), attempt });
        onError?.(event);
      }}
    />
  );
}

export default function ProtectedMediaImage(props) {
  // A source change owns a new request and Blob URL, never a revoked URL from the old source.
  return <MediaImage key={props.src} {...props} />;
}
