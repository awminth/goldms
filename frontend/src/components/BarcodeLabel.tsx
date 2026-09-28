import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

type BarcodeLabelProps = {
  value: string;
  /** SVG display width hint */
  className?: string;
  height?: number;
  /** Bar module width (JsBarcode `width`) */
  barWidth?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
};

/** Standard CODE128 barcode for jewelry tags / print. */
export const BarcodeLabel: React.FC<BarcodeLabelProps> = ({
  value,
  className = 'w-full max-w-[240px] mx-auto',
  height = 48,
  barWidth = 1.6,
  displayValue = true,
  fontSize = 12,
  margin = 4,
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
        width: barWidth,
        height,
        displayValue,
        fontSize,
        margin,
        background: '#ffffff',
      });
    } catch {
      el.replaceChildren();
    }
  }, [value, height, barWidth, displayValue, fontSize, margin]);

  if (!String(value || '').trim()) return null;

  return <svg ref={svgRef} className={className} role="img" aria-label={value} />;
};
