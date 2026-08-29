import { Minus, Plus, Printer, ShoppingCart, Trash2, X } from 'lucide-react';
import type { CartItem, Label, NoteType, NoteWithUrls } from '../../lib/types';
import { Barcode } from '../barcodes/Barcode';
import { noteTypeById, noteTypeIcon } from '../../lib/noteTypes';
import { categoryLabel, dispositionLabel } from '../../lib/searchNotes';
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
}: CartViewProps) {
  return (
    <section className={styles.section}>
      <div className={`${styles.toolbar} ${styles.noPrint}`}>
        <div>
          <h2 className={styles.heading}>Cart</h2>
          <p className={styles.subheading}>
            {unitCount === 0
              ? 'Empty'
              : `${unitCount} item${unitCount === 1 ? '' : 's'} · ${rows.length} line${
                  rows.length === 1 ? '' : 's'
                }`}
          </p>
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
                className={styles.primaryBtn}
                onClick={() => window.print()}
              >
                <Printer size={16} />
                Print / PDF
              </button>
            </>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className={`${styles.empty} ${styles.noPrint}`}>
          <ShoppingCart size={28} strokeWidth={1.75} />
          <p className={styles.emptyTitle}>Cart is empty</p>
          <p className={styles.emptyText}>
            Select notes and choose Add to cart, or open a note and add it from
            there. Adding the same note again increases its quantity.
          </p>
        </div>
      ) : (
        <div className={styles.printSheet}>
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
                    {showBarcodes ? 'Barcode' : 'Title'}
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
                  const status = note
                    ? dispositionLabel(note.disposition ?? null)
                    : null;
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
                        <span className={styles.qty}>{item.quantity}</span>
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
