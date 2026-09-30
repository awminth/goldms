import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { ModalOverlay } from '../components/ModalOverlay';

export type DialogConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive action styling (red confirm) */
  danger?: boolean;
};

export type DialogAlertOptions = {
  title?: string;
  message: string;
  okLabel?: string;
  /** Visual tone — success uses check / green (Swal-like) */
  variant?: 'info' | 'success' | 'error';
};

type DialogApi = {
  confirm: (opts: DialogConfirmOptions) => Promise<boolean>;
  alert: (opts: DialogAlertOptions | string) => Promise<void>;
};

type PendingConfirm = DialogConfirmOptions & {
  kind: 'confirm';
  resolve: (v: boolean) => void;
};

type PendingAlert = DialogAlertOptions & {
  kind: 'alert';
  resolve: () => void;
};

type Pending = PendingConfirm | PendingAlert;

const DialogContext = createContext<DialogApi | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const queueRef = useRef<Pending[]>([]);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() || null;
    setPending(next);
  }, []);

  const enqueue = useCallback(
    (item: Pending) => {
      if (pending) {
        queueRef.current.push(item);
      } else {
        setPending(item);
      }
    },
    [pending]
  );

  const confirm = useCallback(
    (opts: DialogConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        enqueue({ kind: 'confirm', ...opts, resolve });
      }),
    [enqueue]
  );

  const alert = useCallback(
    (opts: DialogAlertOptions | string) =>
      new Promise<void>((resolve) => {
        const normalized: DialogAlertOptions =
          typeof opts === 'string' ? { message: opts } : opts;
        enqueue({ kind: 'alert', ...normalized, resolve });
      }),
    [enqueue]
  );

  const api = useMemo(() => ({ confirm, alert }), [confirm, alert]);

  const closeConfirm = (value: boolean) => {
    if (!pending || pending.kind !== 'confirm') return;
    pending.resolve(value);
    setPending(null);
    // flush next on next tick so state settles
    queueMicrotask(showNext);
  };

  const closeAlert = () => {
    if (!pending || pending.kind !== 'alert') return;
    pending.resolve();
    setPending(null);
    queueMicrotask(showNext);
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {pending?.kind === 'confirm' && (
        <ModalOverlay onBackdropClick={() => closeConfirm(false)}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-3">
              <div
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  pending.danger
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  {pending.title || 'Confirm'}
                </h3>
                <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {pending.message}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                {pending.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${
                  pending.danger
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#D4AF37] hover:bg-[#C5A059]'
                }`}
              >
                {pending.confirmLabel || 'OK'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      {pending?.kind === 'alert' && (
        <ModalOverlay onBackdropClick={closeAlert}>
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="flex items-start gap-3">
              {(() => {
                const variant = pending.variant || 'info';
                const iconWrap =
                  variant === 'success'
                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                    : variant === 'error'
                      ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                      : 'bg-[#D4AF37]/15 text-[#996515] dark:text-[#E8C96A]';
                const Icon =
                  variant === 'success' ? CheckCircle2 : variant === 'error' ? XCircle : Info;
                return (
                  <div
                    className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${iconWrap}`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                );
              })()}
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                  {pending.title ||
                    (pending.variant === 'success'
                      ? 'Success'
                      : pending.variant === 'error'
                        ? 'Error'
                        : 'Notice')}
                </h3>
                <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {pending.message}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={closeAlert}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold ${
                  pending.variant === 'error'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : pending.variant === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-[#D4AF37] hover:bg-[#C5A059]'
                }`}
              >
                {pending.okLabel || 'OK'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}
