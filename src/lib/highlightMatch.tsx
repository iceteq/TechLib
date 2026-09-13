import type { ReactNode } from 'react';

/** Split a query into lowercase tokens (space-separated). */
export function searchTokens(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Wrap case-insensitive matches of any query token in <mark>.
 * Returns the plain string when there is nothing to highlight.
 */
export function highlightMatches(
  text: string,
  query: string,
): ReactNode {
  const tokens = searchTokens(query);
  if (!text || tokens.length === 0) return text;

  const escaped = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .filter(Boolean);
  if (escaped.length === 0) return text;

  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  if (parts.length === 1) return text;

  return parts.map((part, index) => {
    if (!part) return null;
    const isMatch = tokens.some(
      (token) => part.toLowerCase() === token.toLowerCase(),
    );
    if (isMatch) {
      return (
        <mark key={`${index}-${part}`} className="searchHit">
          {part}
        </mark>
      );
    }
    return <span key={`${index}-${part}`}>{part}</span>;
  });
}
