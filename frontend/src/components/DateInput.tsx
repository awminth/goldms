import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { formatDate, parseDateToISO } from '../utils/dateFormat';

type DateInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  /** ISO yyyy-mm-dd */
  value: string;
  onChange: (isoDate: string) => void;
};

/**
 * Date field that always displays dd/mm/yyyy.
 * Value in/out is ISO yyyy-mm-dd for APIs and storage.
 * Includes a calendar picker (native) that does not affect the visible format.
 */
export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  onBlur,
  onFocus,
  className,
  readOnly,
  disabled,
  placeholder = 'dd/mm/yyyy',
  ...rest
}) => {
  const [text, setText] = useState(() => formatDate(value));
  const focused = useRef(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused.current) {
      setText(formatDate(value));
    }
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      onChange('');
      setText('');
      return;
    }
    const iso = parseDateToISO(trimmed);
    if (iso) {
      onChange(iso);
      setText(formatDate(iso));
    } else {
      setText(formatDate(value));
    }
  };

  const openPicker = () => {
    if (readOnly || disabled) return;
    const el = pickerRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') el.showPicker();
      else el.click();
    } catch {
      el.click();
    }
  };

  return (
    <div className="relative w-full min-w-0">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        className={`${className || ''} ${readOnly || disabled ? '' : 'pr-8'}`.trim()}
        value={text}
        readOnly={readOnly}
        disabled={disabled}
        onFocus={(e) => {
          focused.current = true;
          onFocus?.(e);
        }}
        onChange={(e) => {
          if (readOnly || disabled) return;
          const raw = e.target.value;
          if (raw === '' || /^[\d/.\-]*$/.test(raw)) {
            setText(raw);
            const iso = parseDateToISO(raw);
            if (iso) onChange(iso);
          }
        }}
        onBlur={(e) => {
          focused.current = false;
          commit(text);
          onBlur?.(e);
        }}
      />
      {!readOnly && !disabled && (
        <>
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-[#996515] dark:hover:text-amber-300"
            onClick={openPicker}
            aria-label="Open calendar"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
          <input
            ref={pickerRef}
            type="date"
            className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden"
            tabIndex={-1}
            value={value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
            onChange={(e) => {
              const iso = e.target.value;
              onChange(iso);
              setText(formatDate(iso));
            }}
          />
        </>
      )}
    </div>
  );
};
