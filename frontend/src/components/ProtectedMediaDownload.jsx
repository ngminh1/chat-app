import { useEffect, useRef, useState } from 'react';
import { downloadMedia, mediaDownloadFailure } from '../utils/mediaAccess';

function MediaDownload({ src, fileName, className, children }) {
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState(null);
  const requestRef = useRef(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  const handleDownload = async () => {
    if (requestRef.current || (failure && !failure.retryable)) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setFailure(null);
    try {
      await downloadMedia(src, fileName, { signal: controller.signal });
    } catch (error) {
      if (!controller.signal.aborted) setFailure(mediaDownloadFailure(error));
    } finally {
      if (!controller.signal.aborted) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-end gap-1 max-w-48">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading || !!(failure && !failure.retryable)}
        className={`${className} disabled:opacity-50 disabled:cursor-default`}
        title={loading ? 'Đang tải tệp…' : failure?.retryable ? 'Thử lại' : 'Tải về'}
        aria-label={loading ? 'Đang tải tệp…' : failure?.retryable ? 'Thử lại' : 'Tải về'}
      >
        {children}
      </button>
      {failure && <span role="alert" className="text-xs text-rose-600 dark:text-rose-400 text-right">{failure.message}</span>}
    </div>
  );
}

export default function ProtectedMediaDownload(props) {
  return <MediaDownload key={props.src} {...props} />;
}
