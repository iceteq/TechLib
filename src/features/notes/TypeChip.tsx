import type { NoteType } from '../../lib/types';
import { noteTypeIcon, typeColorVars } from '../../lib/noteTypes';
import styles from './TypeChip.module.css';

interface TypeChipProps {
  type: NoteType;
  className?: string;
  showLabel?: boolean;
  suggested?: boolean;
  onClick?: () => void;
}

export function TypeChip({
  type,
  className = '',
  showLabel = true,
  suggested = false,
  onClick,
}: TypeChipProps) {
  const Icon = noteTypeIcon(type.icon);
  const colors = typeColorVars(type.color);
  const classNames = `${styles.chip} ${suggested ? styles.suggested : ''} ${className}`;
  const style = {
    background: colors.bg,
    color: colors.fg,
    borderColor: colors.border,
  };
  const content = (
    <>
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      {showLabel ? <span>{type.name}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={classNames}
        style={style}
        title={suggested ? `Set type to ${type.name}` : type.name}
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
    <span className={classNames} style={style} title={type.name}>
      {content}
    </span>
  );
}
