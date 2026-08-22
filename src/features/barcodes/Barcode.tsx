import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { barcodeValueFromTitle } from './barcodeLogic';
import styles from './Barcode.module.css';

interface BarcodeProps {
  title: string;
  /** Smaller barcode for note cards */
  compact?: boolean;
  /** Dense, print-safe barcode sized for handheld scanners */
  scannable?: boolean;
}

export function Barcode({
  title,
  compact = false,
  scannable = false,
}: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const value = barcodeValueFromTitle(title);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        displayValue: true,
        fontSize: scannable ? 11 : compact ? 10 : 12,
        height: scannable ? 40 : compact ? 36 : 48,
        margin: scannable ? 6 : 0,
        background: scannable ? '#ffffff' : 'transparent',
        lineColor: scannable ? '#000000' : '#1f2328',
        width: scannable ? 1.6 : 2,
      });
    } catch {
      // Invalid characters shouldn't happen after normalization.
    }
  }, [value, compact, scannable]);

  const className = [
    styles.wrap,
    compact ? styles.compact : '',
    scannable ? styles.scannable : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        className={styles.svg}
        role="img"
        aria-label={`Barcode ${value}`}
      />
    </div>
  );
}
