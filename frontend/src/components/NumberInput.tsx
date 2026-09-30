import React, { useEffect, useRef, useState } from 'react';

type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> & {
  value: number;
  onChange: (value: number) => void;
  /** Called with raw text while editing (optional) */
  allowEmptyWhileTyping?: boolean;
};

/**
 * Number field that lets the user clear "0" and type a new value.
 * Empty input is treated as 0 on blur / for numeric consumers.
 */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  allowEmptyWhileTyping = true,
  onBlur,
  onFocus,
  className,
  ...rest
}) => {
  const [text, setText] = useState(() =>
    Number.isFinite(value) ? String(value) : ''
  );
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) {
      setText(Number.isFinite(value) ? String(value) : '');
    }
  }, [value]);

  const commit = (raw: string) => {
    if (raw.trim() === '' || raw === '-' || raw === '.') {
      onChange(0);
      setText(allowEmptyWhileTyping && focused.current ? '' : '0');
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n)) {
      onChange(n);
      setText(String(n));
    }
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '' || /^-?\d*\.?\d*$/.test(raw)) {
          setText(raw);
          if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
            // Keep parent in sync as 0 while clearing so Save never reads a stale fee
            onChange(0);
          } else {
            const n = Number(raw);
            if (Number.isFinite(n)) onChange(n);
          }
        }
      }}
      onBlur={(e) => {
        focused.current = false;
        commit(text);
        onBlur?.(e);
      }}
    />
  );
};
