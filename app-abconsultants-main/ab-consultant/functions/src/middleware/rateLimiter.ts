/**
 * Rate Limiter en mémoire pour les Cloud Functions.
 *
 * Limites par UID : empêche l'abus de l'API Gemini.
 * Note : En production avec plusieurs instances, utiliser Redis ou Firestore pour le state.
 * Pour un volume modéré (< 100 users actifs), le in-memory suffit.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes

// Nettoyage périodique pour éviter la fuite mémoire
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter(t => now - t < 3600000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export function checkRateLimit(
  uid: string,
  maxRequests: number = 30,
  windowMs: number = 60 * 60 * 1000 // 1 heure
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();

  let entry = store.get(uid);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(uid, entry);
  }

  // Purger les entrées hors fenêtre
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}
