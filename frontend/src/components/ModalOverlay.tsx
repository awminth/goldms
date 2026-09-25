import React from 'react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

type ModalOverlayProps = {
  children: React.ReactNode;
  /** Extra classes on the backdrop (default centers content) */
  className?: string;
  /** Called when backdrop itself is clicked (not inner panel) */
  onBackdropClick?: () => void;
};

/**
 * App-wide modal backdrop — always locks page scroll while mounted.
 */
export function ModalOverlay({ children, className = '', onBackdropClick }: ModalOverlayProps) {
  useBodyScrollLock(true);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-hidden overscroll-none print:static print:inset-auto print:block print:p-0 print:m-0 print:h-auto print:max-h-none print:overflow-visible print:bg-transparent print:backdrop-blur-none ${className}`}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBackdropClick?.();
      }}
    >
      {children}
    </div>
  );
}
