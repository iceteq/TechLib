import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { barcodeValueFromTitle } from './barcodeLogic';
import styles from './Barcode.module.css';

interface BarcodeProps {
  title: string;
}

export function Barcode({ title }: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const value = barcodeValueFromTitle(title);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        displayValue: true,
        fontSize: 12,
        height: 48,
        margin: 0,
        background: 'transparent',
        lineColor: '#1f2328',
      });
    } catch {
      // Invalid characters shouldn't happen after normalization.
    }
  }, [value]);

  return (
    <div className={styles.wrap}>
      <svg ref={svgRef} className={styles.svg} role="img" aria-label={`Barcode ${value}`} />
      <p className={styles.value}>{value}</p>
    </div>
  );
}
