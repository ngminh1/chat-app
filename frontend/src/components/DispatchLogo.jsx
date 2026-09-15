import React from 'react';

export default function DispatchLogo({ size = 32, showText = false, layout = 'horizontal', className = '' }) {
  if (showText) {
    if (layout === 'vertical') {
      return (
        <div className={`inline-flex flex-col items-center gap-2 select-none ${className}`}>
          <img
            src="/logo-icon.png"
            alt="Dispatch"
            style={{ width: size, height: size }}
            className="object-contain drop-shadow-sm flex-shrink-0"
          />
          <span
            className="font-black tracking-tight text-slate-900 dark:text-white"
            style={{ fontSize: Math.max(22, Math.round(size * 0.44)) }}
          >
            Dispatch
          </span>
        </div>
      );
    }

    return (
      <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
        <img
          src="/logo-icon.png"
          alt="Dispatch"
          style={{ width: size, height: size }}
          className="object-contain drop-shadow-sm flex-shrink-0"
        />
        <span
          className="font-extrabold tracking-tight text-slate-900 dark:text-white"
          style={{ fontSize: size * 0.72 }}
        >
          Dispatch
        </span>
      </div>
    );
  }

  return (
    <img
      src="/logo-icon.png"
      alt="Dispatch"
      style={{ width: size, height: size }}
      className={`object-contain select-none drop-shadow-sm ${className}`}
    />
  );
}