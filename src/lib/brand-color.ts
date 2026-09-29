/**
 * Brand-colour helpers shared by the settings UI (client) and the save action
 * (server). Pure functions — no imports — so both sides can use them.
 */

/** "#1f7a6d" / "1F7A6D" / " #1F7A6D " → "#1F7A6D"; anything else → null. */
export function normalizeBrandColor(input: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

/** WCAG relative luminance of a 6-digit hex colour, 0 (black) – 1 (white). */
export function relativeLuminance(hex: string): number {
  const norm = normalizeBrandColor(hex);
  if (!norm) return 0;
  const int = parseInt(norm.slice(1), 16);
  const [r, g, b] = [(int >> 16) & 255, (int >> 8) & 255, int & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio of white text on this colour. Buttons on the giving page put
 * white text on the brand colour, so a pale colour makes "Donate" unreadable.
 * 4.5 is the WCAG AA threshold for normal text; 3 for large/bold text.
 */
export function whiteTextContrast(hex: string): number {
  return 1.05 / (relativeLuminance(hex) + 0.05);
}
