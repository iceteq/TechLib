import styles from './PartNumberSiblingBanner.module.css';

interface PartNumberSiblingBannerProps {
  familyCount: number;
  needsType: boolean;
}

export function PartNumberSiblingBanner({
  familyCount,
  needsType,
}: PartNumberSiblingBannerProps) {
  const others = Math.max(0, familyCount - 1);
  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>
        Keeping as a new sibling
        {others > 0
          ? ` · same part number as ${others} other note${others === 1 ? '' : 's'}`
          : ''}
      </p>
      {needsType ? (
        <p className={styles.nudge}>
          Pick a type so this model is distinct from the others.
        </p>
      ) : null}
    </div>
  );
}
