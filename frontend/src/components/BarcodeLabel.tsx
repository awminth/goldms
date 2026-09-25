import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

type BarcodeLabelProps = {
  value: string;
  /** SVG display width hint */
  className?: string;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
};

/** Standard CODE128 barcode for jewelry tags / print. */
export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
  value,
  className = 'w-full max-w-[240px] mx-auto',
  height = 48,
  displayValue = true,
  fontSize = 12,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    const code = String(value || '').trim();
    if (!el || !code) return;
    try {
      JsBarcode(el, code, {
        format: 'CODE128',
        lineColor: '#000',
        width: 1.6,
        height,
        displayValue,
        fontSize,
        margin: 4,
        background: '#ffffff',
      });
    } catch {
      el.replaceChildren();
    }
  }, [value, height, displayValue, fontSize]);

  if (!String(value || '').trim()) return null;

  return <svg ref={svgRef} className={className} role="img" aria-label={value} />;
};
