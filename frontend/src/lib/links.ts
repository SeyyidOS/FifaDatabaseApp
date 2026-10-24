/**
 * Where a pasted link leads: an invite (".../#/join/<code>", or just the code) or a board's own link
 * (".../#/b/<slug>/…"). Null for anything else.
 */
export function linkTarget(input: string): string | null {
  const text = input.trim();
  const invite = text.match(/\/join\/([A-Za-z0-9_-]+)/);
  if (invite) return `/join/${invite[1]}`;
  const board = text.match(/\/b\/([^/?#\s]+)/);
  if (board) return `/b/${board[1].toLowerCase()}`;
  return /^[A-Za-z0-9_-]{8,}$/.test(text) ? `/join/${text}` : null;
}

/**
 * The site's address, for links people share (invites, a board's own link): the page's own, or in the
 * iPhone app, which isn't served from it, VITE_SITE_URL (.env.app).
 */
export function siteUrl(): string {
  return import.meta.env.VITE_SITE_URL ?? `${window.location.origin}${window.location.pathname}`;
}
