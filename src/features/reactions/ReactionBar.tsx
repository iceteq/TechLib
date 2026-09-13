import { useState } from 'react';
import type { Reaction, ReactionEmoji } from '../../lib/types';
import { REACTION_EMOJIS } from '../../lib/types';
import styles from './ReactionBar.module.css';

interface ReactionBarProps {
  reactions: Reaction[];
  onToggle: (emoji: ReactionEmoji) => void;
}

export function ReactionBar({ reactions, onToggle }: ReactionBarProps) {
  const byEmoji = new Map(reactions.map((r) => [r.emoji, r.count]));
  const [burstEmoji, setBurstEmoji] = useState<ReactionEmoji | null>(null);

  function handleToggle(emoji: ReactionEmoji) {
    setBurstEmoji(null);
    requestAnimationFrame(() => {
      setBurstEmoji(emoji);
      onToggle(emoji);
      window.setTimeout(() => {
        setBurstEmoji((current) => (current === emoji ? null : current));
      }, 300);
    });
  }

  return (
    <div className={styles.bar} role="group" aria-label="Reactions">
      {REACTION_EMOJIS.map((emoji) => {
        const count = byEmoji.get(emoji) ?? 0;
        const active = count > 0;
        const bursting = burstEmoji === emoji;
        return (
          <button
            key={emoji}
            type="button"
            className={`${styles.chip} ${active ? styles.active : ''} ${
              bursting ? styles.burst : ''
            }`}
            onClick={() => handleToggle(emoji)}
            aria-pressed={active}
            aria-label={`React with ${emoji}`}
          >
            <span aria-hidden>{emoji}</span>
            {count > 0 && <span className={styles.count}>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
