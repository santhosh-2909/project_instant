/**
 * Recent claims, stored per-browser.
 *
 * Deliberately local: an unauthenticated visitor's checks are not written to
 * the server, which keeps data minimisation (PRD §7, DPDP) intact. Signed-in
 * verification history lives in the database instead.
 */

export interface RecentClaim {
  id: string;
  title: string;
  body: string;
  checkedAt: string;
}

const KEY = 'vg-recent-claims';
const MAX_ITEMS = 5;

function safeParse(raw: string | null): RecentClaim[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RecentClaim =>
        typeof item?.id === 'string' && typeof item?.title === 'string' && typeof item?.checkedAt === 'string'
    );
  } catch {
    return [];
  }
}

export function readRecentClaims(): RecentClaim[] {
  if (typeof localStorage === 'undefined') return [];
  return safeParse(localStorage.getItem(KEY));
}

export function addRecentClaim(claim: { title: string; body: string }): RecentClaim[] {
  if (typeof localStorage === 'undefined') return [];
  if (!claim.title.trim()) return readRecentClaims();

  const entry: RecentClaim = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: claim.title.slice(0, 160),
    body: claim.body.slice(0, 4000),
    checkedAt: new Date().toISOString(),
  };

  const existing = readRecentClaims().filter(
    (item) => item.title.trim().toLowerCase() !== entry.title.trim().toLowerCase()
  );
  const next = [entry, ...existing].slice(0, MAX_ITEMS);

  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode — recents are a convenience, not a requirement */
  }
  return next;
}

export function clearRecentClaims() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
