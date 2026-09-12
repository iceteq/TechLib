/** Grow a textarea with its content, capped at maxHeightPx (or CSS max-height). */
export function autosizeTextarea(
  el: HTMLTextAreaElement | null,
  maxHeightPx?: number,
) {
  if (!el) return;
  const styleMax = Number.parseFloat(getComputedStyle(el).maxHeight);
  const cap =
    maxHeightPx ??
    (Number.isFinite(styleMax) && styleMax > 0 ? styleMax : Number.POSITIVE_INFINITY);

  el.style.height = 'auto';
  const next = Math.min(el.scrollHeight, cap);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden';
}
