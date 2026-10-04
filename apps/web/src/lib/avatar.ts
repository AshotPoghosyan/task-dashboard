/** Up to two initials: "Ann Lee" → "AL", "ann" → "A". */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? [parts[0], parts[1]] : [parts[0]?.slice(0, 1)];
  return letters.map((p) => p?.charAt(0).toUpperCase() ?? '').join('') || '?';
}

export const AVATAR_COLORS = 6;

/** Stable colour slot (0–5) for a name, so the same person always gets the same colour. */
export function avatarColorIndex(name: string): number {
  let hash = 0;
  for (const ch of name.trim().toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % AVATAR_COLORS;
}
