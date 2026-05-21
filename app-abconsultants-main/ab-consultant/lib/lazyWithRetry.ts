import { lazy, ComponentType } from 'react';

const RELOAD_KEY = 'lazy-retry-reloaded';

const isChunkLoadError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('Loading chunk')
  );
};

/**
 * `lazy()` wrapper that recovers from stale-deploy errors. When Vercel/CDN
 * replaces the chunk hashes a user's tab was holding references to, the
 * dynamic import 404s. This wrapper auto-reloads once (sessionStorage flag
 * prevents loops) so `index.html` is re-fetched with the new hashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const mod = await factory();
      if (typeof window !== 'undefined') {
        try { sessionStorage.removeItem(RELOAD_KEY); } catch {}
      }
      return mod;
    } catch (err) {
      if (isChunkLoadError(err) && typeof window !== 'undefined') {
        let alreadyReloaded: string | null = null;
        try { alreadyReloaded = sessionStorage.getItem(RELOAD_KEY); } catch {}
        if (!alreadyReloaded) {
          try { sessionStorage.setItem(RELOAD_KEY, '1'); } catch {}
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }
  });
}
