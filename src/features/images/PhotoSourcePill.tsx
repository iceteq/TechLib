import type { MouseEvent, ReactNode } from 'react';
import { Rows3, Star, Undo2 } from 'lucide-react';
import {
  photoSourceColorVars,
  photoSourceMeta,
} from '../../lib/photoSources';
import type { PhotoSource } from '../../lib/types';
import styles from './PhotoSourcePill.module.css';

function SourceIcon({
  source,
  size = 12,
}: {
  source: PhotoSource;
  size?: number;
}) {
  if (source === 'po') return <Star size={size} strokeWidth={2.4} aria-hidden />;
  if (source === 'pick') {
    return <Rows3 size={size} strokeWidth={2.4} aria-hidden />;
  }
  return <Undo2 size={size} strokeWidth={2.4} aria-hidden />;
}

interface PhotoSourcePillProps {
  source: PhotoSource | null | undefined;
  /** Soft pill over a photo (wall / gallery). */
  onImage?: boolean;
  /** Show a muted “Source” affordance when unset (edit mode). */
  showUnset?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  onClick?: () => void;
}

export function PhotoSourcePill({
  source,
  onImage = false,
  showUnset = false,
  disabled = false,
  expanded = false,
  onClick,
}: PhotoSourcePillProps) {
  const meta = photoSourceMeta(source);
  if (!meta && !(showUnset && onClick)) return null;

  const colors = meta ? photoSourceColorVars(meta.id) : null;
  const label = meta?.label ?? 'Source';
  const title = meta
    ? `${meta.short} — ${meta.hint}`
    : 'Set photo source for the main image';
  const ariaLabel = meta
    ? `Photo source: ${meta.short}`
    : 'Set photo source';

  const className = [
    styles.pill,
    onImage ? styles.onImage : '',
    !meta ? styles.unset : '',
    onClick && !disabled ? styles.interactive : '',
  ]
    .filter(Boolean)
    .join(' ');

  const style = colors
    ? {
        background: onImage
          ? 'rgba(255, 255, 255, 0.92)'
          : colors.bg,
        color: colors.fg,
        borderColor: colors.border,
      }
    : undefined;

  const content: ReactNode = (
    <>
      {meta ? <SourceIcon source={meta.id} /> : null}
      <span className={styles.label}>{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        disabled={disabled}
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          if (!disabled) onClick();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={className} style={style} title={title} aria-label={ariaLabel}>
      {content}
    </span>
  );
}
