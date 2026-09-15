import { useEffect } from 'react';

/**
 * Reference-counted body scroll lock so multiple open modals stay correct.
 */
let lockCount = 0;
let prevBodyOverflow = '';
let prevHtmlOverflow = '';
let prevBodyPadding = '';

function applyLock() {
  const body = document.body;
  const html = document.documentElement;
  if (lockCount === 0) {
    prevBodyOverflow = body.style.overflow;
    prevHtmlOverflow = html.style.overflow;
    prevBodyPadding = body.style.paddingRight;
    const scrollbar = window.innerWidth - html.clientWidth;
    if (scrollbar > 0) {
      body.style.paddingRight = `${scrollbar}px`;
    }
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    body.classList.add('modal-scroll-locked');
  }
  lockCount += 1;
}

function releaseLock() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    const body = document.body;
    const html = document.documentElement;
    body.style.overflow = prevBodyOverflow;
    html.style.overflow = prevHtmlOverflow;
    body.style.paddingRight = prevBodyPadding;
    body.classList.remove('modal-scroll-locked');
  }
}

/** Lock document scroll while `locked` is true (supports nested/multi modals). */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    applyLock();
    return () => releaseLock();
  }, [locked]);
}
