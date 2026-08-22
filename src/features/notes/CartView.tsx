import { Minus, Plus, Printer, ShoppingCart, Trash2, X } from 'lucide-react';
import type { CartItem, Label, NoteWithUrls } from '../../lib/types';
import { categoryIcon } from '../../lib/categoryIcons';
import { categoryLabel, dispositionLabel } from '../../lib/searchNotes';
import { Barcode } from '../barcodes/Barcode';
import styles from './CartView.module.css';

export type CartRow = {
  item: CartItem;
  note: NoteWithUrls | null;
};

interface CartViewProps {
  rows: CartRow[];
  labels: Label[];
  unitCount: number;
  onOpenNote: (noteId: string) => void;
  onChangeQuantity: (noteId: string, quantity: number) => void;
  onRemove: (noteId: string) => void;
  onClear: () => void;
}

export function CartView({
  rows,
  labels,
  unitCount,
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
              {unitCount} item{unitCount === 1 ? '' : 's'} ·{' '}
              {new Date().toLocaleDateString()}
            </p>
          </header>

          <ul className={styles.list}>
            {rows.map(({ item, note }) => {
              const Icon = categoryIcon(note?.category);
              const status = note
                ? dispositionLabel(note.disposition ?? null)
                : null;
              const type = note ? categoryLabel(note.category ?? null) : null;
              const noteLabels = labels.filter((l) =>
                (note?.labelIds ?? []).includes(l.id),
              );
              const special = (note?.specialCase ?? '').trim();
              const title = note?.title.trim() || 'Missing note';

              return (
                <li key={item.noteId} className={styles.row}>
                  <div className={styles.iconWrap} aria-hidden>
                    <Icon size={22} strokeWidth={1.75} />
                  </div>

                  <div className={styles.main}>
                    <div className={styles.titleRow}>
                      <button
                        type="button"
                        className={styles.titleBtn}
                        onClick={() => {
                          if (note) onOpenNote(note.id);
                        }}
                        disabled={!note}
                      >
                        {title}
                      </button>
                      <span className={styles.qtyBadge} title="Quantity">
                        ×{item.quantity}
                      </span>
                    </div>

                    {note?.title.trim() && (
                      <div className={styles.barcode}>
                        <Barcode title={note.title} compact />
                      </div>
                    )}

                    <div className={styles.meta}>
                      {type && <span>{type}</span>}
                      {status && <span>{status}</span>}
                      {noteLabels.map((label) => (
                        <span key={label.id}>#{label.name}</span>
                      ))}
                    </div>

                    {special && (
                      <p className={styles.specialCase}>
                        <span className={styles.specialMark} aria-hidden>
                          !
                        </span>
                        {special}
                      </p>
                    )}

                    {!note && (
                      <p className={styles.missing}>
                        Note no longer exists — remove from cart.
                      </p>
                    )}
                  </div>

                  <div className={`${styles.rowActions} ${styles.noPrint}`}>
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
                      <X size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
