import { useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus, Printer, ShoppingCart, Trash2, X } from 'lucide-react';
import type { CartItem, Label, NoteType, NoteWithUrls } from '../../lib/types';
import { Barcode } from '../barcodes/Barcode';
import { noteTypeById, noteTypeIcon } from '../../lib/noteTypes';
import { categoryLabel } from '../../lib/searchNotes';
import { resolveGuidelineLines } from '../../lib/guidelineLines';
import { DISPOSITIONS } from '../../lib/types';
import styles from './CartView.module.css';

export type CartRow = {
  item: CartItem;
  note: NoteWithUrls | null;
};

interface CartViewProps {
  rows: CartRow[];
  labels: Label[];
  noteTypes: NoteType[];
  unitCount: number;
  showBarcodes: boolean;
  onOpenNote: (noteId: string) => void;
  onChangeQuantity: (noteId: string, quantity: number) => void;
  onRemove: (noteId: string) => void;
  onClear: () => void;
  /** One-tap path back to the note wall when the cart is empty. */
  onBrowseNotes?: () => void;
}

export function CartView({
  rows,
  labels,
  noteTypes,
  unitCount,
  showBarcodes,
  onOpenNote,
  onChangeQuantity,
  onRemove,
  onClear,
  onBrowseNotes,
}: CartViewProps) {
  const [printPhase, setPrintPhase] = useState<'idle' | 'printing' | 'done'>(
    'idle',
  );
  const doneTimer = useRef<number | null>(null);
  const lineCount = rows.length;
  /** Soft visual target for the fill meter — not a hard limit. */
  const fillTarget = 12;
  const fillPct =
    unitCount === 0 ? 0 : Math.min(100, Math.round((unitCount / fillTarget) * 100));

  useEffect(() => {
    function onAfterPrint() {
      setPrintPhase('done');
      if (doneTimer.current != null) window.clearTimeout(doneTimer.current);
      doneTimer.current = window.setTimeout(() => {
        setPrintPhase('idle');
        doneTimer.current = null;
      }, 2800);
    }
    window.addEventListener('afterprint', onAfterPrint);
    return () => {
      window.removeEventListener('afterprint', onAfterPrint);
      if (doneTimer.current != null) window.clearTimeout(doneTimer.current);
    };
  }, []);

  // Reset celebration when cart empties.
  useEffect(() => {
    if (unitCount === 0) setPrintPhase('idle');
  }, [unitCount]);

  function handlePrint() {
    setPrintPhase('printing');
    window.print();
    // Fallback when afterprint never fires (some mobile browsers).
    window.setTimeout(() => {
      setPrintPhase((phase) => (phase === 'printing' ? 'done' : phase));
    }, 700);
  }

  const summary =
    unitCount === 0
      ? 'Empty — add parts to start a pull'
      : fillPct >= 100
        ? `Ready to pull · ${unitCount} unit${unitCount === 1 ? '' : 's'} · ${lineCount} line${
            lineCount === 1 ? '' : 's'
          }`
        : `Building pull · ${unitCount} unit${unitCount === 1 ? '' : 's'} · ${lineCount} line${
            lineCount === 1 ? '' : 's'
          }`;

  return (
    <section className={styles.section}>
      <div className={`${styles.toolbar} ${styles.noPrint}`}>
        <div className={styles.toolbarLead}>
          <h2 className={styles.heading}>Cart</h2>
          <p className={styles.subheading}>{summary}</p>
          <div
            className={styles.stats}
            aria-label={`${unitCount} units, ${lineCount} lines`}
          >
            <span
              className={`${styles.statChip} ${
                unitCount > 0 ? styles.statChipOn : ''
              }`}
            >
              <strong>{unitCount}</strong>
              unit{unitCount === 1 ? '' : 's'}
            </span>
            <span
              className={`${styles.statChip} ${
                lineCount > 0 ? styles.statChipOn : ''
              }`}
            >
              <strong>{lineCount}</strong>
              line{lineCount === 1 ? '' : 's'}
            </span>
          </div>
          <div
            className={styles.fillTrack}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={fillPct}
            aria-label="Pull fill"
          >
            <div
              className={`${styles.fillBar} ${
                unitCount > 0 ? styles.fillBarActive : ''
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
        <div className={styles.toolbarActions}>
          {rows.length > 0 && (
            <>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={onClear}
              >
                <Trash2 size={16} />
                Clear
              </button>
              <button
                type="button"
                className={`${styles.primaryBtn} ${
                  printPhase === 'done' ? styles.primaryBtnDone : ''
                } ${printPhase === 'printing' ? styles.primaryBtnBusy : ''}`}
                onClick={handlePrint}
              >
                {printPhase === 'done' ? (
                  <Check size={16} strokeWidth={2.4} />
                ) : (
                  <Printer size={16} />
                )}
                {printPhase === 'done' ? 'Printed' : 'Print / PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {printPhase === 'done' && rows.length > 0 && (
        <div className={`${styles.winBanner} ${styles.noPrint}`} role="status">
          <Check size={16} strokeWidth={2.4} aria-hidden />
          <span>Pull list ready — take it to the floor.</span>
        </div>
      )}

      {rows.length === 0 ? (
        <div className={`${styles.empty} ${styles.noPrint}`}>
          <ShoppingCart size={28} strokeWidth={1.75} />
          <p className={styles.emptyTitle}>Cart is empty</p>
          <p className={styles.emptyText}>
            Add notes from the wall to build a pull list.
          </p>
          {onBrowseNotes && (
            <button
              type="button"
              className={styles.emptyCta}
              onClick={onBrowseNotes}
            >
              Browse notes
            </button>
          )}
        </div>
      ) : (
        <div className={`${styles.printSheet} ${styles.sheetEnter}`}>
          <header className={`${styles.printHeader} ${styles.printOnly}`}>
            <h1 className={styles.printTitle}>TechLib cart</h1>
            <p className={styles.printMeta}>
              {unitCount} item{unitCount === 1 ? '' : 's'} · {rows.length} line
              {rows.length === 1 ? '' : 's'} · {new Date().toLocaleDateString()}
            </p>
          </header>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.colQty} scope="col">
                    Qty
                  </th>
                  <th className={styles.colIcon} scope="col">
                    <span className={styles.srOnly}>Type</span>
                  </th>
                  <th className={styles.colBarcode} scope="col">
                    {showBarcodes ? 'Barcode' : 'Part number'}
                  </th>
                  <th className={styles.colStatus} scope="col">
                    Guideline
                  </th>
                  <th className={styles.colType} scope="col">
                    Type
                  </th>
                  <th className={styles.colLabels} scope="col">
                    Labels
                  </th>
                  <th className={styles.colSpecial} scope="col">
                    Special
                  </th>
                  <th className={`${styles.colActions} ${styles.noPrint}`} scope="col">
                    <span className={styles.srOnly}>Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ item, note }) => {
                  const type = note
                    ? noteTypeById(noteTypes, note.categoryId)
                    : null;
                  const Icon = noteTypeIcon(type?.icon);
                  const lines = note
                    ? resolveGuidelineLines(note)
                    : [];
                  const status =
                    lines.length === 0
                      ? null
                      : lines
                          .map((line) => {
                            const action =
                              DISPOSITIONS.find((d) => d.id === line.action)
                                ?.short ?? line.action;
                            return `${line.when} → ${action}`;
                          })
                          .join('; ');
                  const typeName = note
                    ? categoryLabel(note.categoryId, noteTypes)
                    : null;
                  const noteLabels = labels.filter((l) =>
                    (note?.labelIds ?? []).includes(l.id),
                  );
                  const special = (note?.specialCase ?? '').trim();
                  const title = note?.title.trim() ?? '';

                  return (
                    <tr key={item.noteId}>
                      <td className={styles.colQty}>
                        <span key={item.quantity} className={styles.qty}>{item.quantity}</span>
                      </td>
                      <td className={styles.colIcon} aria-hidden>
                        <Icon size={16} strokeWidth={1.75} />
                      </td>
                      <td className={styles.colBarcode}>
                        {title ? (
                          <button
                            type="button"
                            className={styles.barcodeBtn}
                            onClick={() => onOpenNote(note!.id)}
                          >
                            {showBarcodes ? (
                              <Barcode title={title} scannable />
                            ) : (
                              <span className={styles.titleFallback}>{title}</span>
                            )}
                          </button>
                        ) : (
                          <span className={styles.missing}>Missing note</span>
                        )}
                      </td>
                      <td className={styles.colStatus}>{status || '—'}</td>
                      <td className={styles.colType}>{typeName || '—'}</td>
                      <td className={styles.colLabels}>
                        {noteLabels.length > 0
                          ? noteLabels.map((l) => `#${l.name}`).join(' ')
                          : '—'}
                      </td>
                      <td className={styles.colSpecial}>
                        {special || '—'}
                      </td>
                      <td className={`${styles.colActions} ${styles.noPrint}`}>
                        <div className={styles.rowActions}>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            aria-label="Decrease quantity"
                            onClick={() =>
                              onChangeQuantity(item.noteId, item.quantity - 1)
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.qtyBtn}
                            aria-label="Increase quantity"
                            onClick={() =>
                              onChangeQuantity(item.noteId, item.quantity + 1)
                            }
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            type="button"
                            className={styles.removeBtn}
                            aria-label="Remove from cart"
                            onClick={() => onRemove(item.noteId)}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
