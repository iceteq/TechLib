/**
 * Warm the browser HTTP cache for wall thumbs during idle time
 * so scrolling into view does not wait on cold transform fetches.
 */
export function prefetchImages(urls: Iterable<string>): void {
  if (typeof window === 'undefined') return;
  const unique = [...new Set([...urls].filter(Boolean))];
  if (unique.length === 0) return;

  const run = () => {
    for (const url of unique) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
    }
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2500 });
  } else {
    window.setTimeout(run, 120);
  }
}
