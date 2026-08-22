import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { barcodeValueFromTitle } from './barcodeLogic';
import styles from './Barcode.module.css';

interface BarcodeProps {
  title: string;
  /** Smaller barcode for note cards */
  compact?: boolean;
}

export function Barcode({ title, compact = false }: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const value = barcodeValueFromTitle(title);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        displayValue: true,
        fontSize: compact ? 10 : 12,
        height: compact ? 36 : 48,
        margin: 0,
        background: 'transparent',
        lineColor: '#1f2328',
      });
    } catch {
      // Invalid characters shouldn't happen after normalization.
    }
  }, [value, compact]);

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <svg
        ref={svgRef}
        className={styles.svg}
        role="img"
        aria-label={`Barcode ${value}`}
      />
    </div>
  );
}
