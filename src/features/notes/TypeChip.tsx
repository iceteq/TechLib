import type { NoteType } from '../../lib/types';
import { noteTypeIcon, typeColorVars } from '../../lib/noteTypes';
import styles from './TypeChip.module.css';

interface TypeChipProps {
  type: NoteType;
  className?: string;
  showLabel?: boolean;
  /** Override visible label (e.g. “Cables · Adapter”). */
  label?: string;
  /** Neutral gray chip — for browse cards so Guideline color wins. */
  muted?: boolean;
  onClick?: () => void;
}

export function TypeChip({
  type,
  className = '',
  showLabel = true,
  label,
  muted = false,
  onClick,
}: TypeChipProps) {
  const Icon = noteTypeIcon(type.icon);
  const colors = typeColorVars(type.color);
  const displayName = label ?? type.name;
  const classNames = `${styles.chip} ${muted ? styles.muted : ''} ${className}`;
  const style = muted
    ? undefined
    : {
        background: colors.bg,
        color: colors.fg,
        borderColor: colors.border,
      };
  const content = (
    <>
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {showLabel ? <span>{displayName}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classNames}
        style={style}
        title={displayName}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={classNames} style={style} title={displayName}>
      {content}
    </span>
  );
}
