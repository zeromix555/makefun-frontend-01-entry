// make.fun's public API: read-only GET, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// One request a view, cached: the API's ETags are bound to the minute, so a
// revalidation inside the same minute answers 304 and costs almost nothing.
// In-flight requests for the same path share one promise, so a re-render
// never doubles a fetch.

const API = 'https://make.fun/api';

/** In-memory entries: path -> { etag, data, at }. */
const cache = new Map();

/** In-flight fetches: path -> Promise. */
const inflight = new Map();

/** Request counters, for the curious: window.__mfStats() prints them. */
let requests = 0;
let cacheHits = 0;

async function fetchJson(path, etag) {
  const headers = { Accept: 'application/json' };
  if (etag) headers['If-None-Match'] = etag;
  const res = await fetch(API + path, { headers });
  if (res.status === 304) return { notModified: true };
  if (!res.ok) {
    const error = new Error(`make.fun API ${res.status} for ${path}`);
    error.status = res.status;
    throw error;
  }
  return { data: await res.json(), etag: res.headers.get('etag') };
}

/**
 * GET a public API path, cached. Fresh entries (under 45 s old) are returned
 * without a request; older ones revalidate with If-None-Match, and a 304
 * keeps the cached body. Returns the parsed JSON.
 */
export async function apiGet(path) {
  const now = Date.now();
  const entry = cache.get(path);
  if (entry && now - entry.at < 45000) {
    cacheHits += 1;
    return entry.data;
  }
  if (inflight.has(path)) return inflight.get(path);
  requests += 1;
  const promise = (async () => {
    try {
      const out = await fetchJson(path, entry?.etag ?? null);
      if (out.notModified && entry) {
        entry.at = now;
        cacheHits += 1;
        return entry.data;
      }
      cache.set(path, { etag: out.etag, data: out.data, at: now });
      return out.data;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, promise);
  return promise;
}

/** Drop every cached entry (used after a manual refresh). */
export function clearCache() {
  cache.clear();
}

export function apiStats() {
  return { requests, cacheHits, cachedPaths: cache.size };
}

/** The open bounties, one request (limit 100 covers the whole board). */
export const getBounties = () => apiGet('/competitions?status=open&activity=times&limit=100');

/** One bounty, by its slug. */
export const getBounty = (slug) => apiGet(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard; view is 'overall' or 'performance'. */
export const getLeaderboard = (slug, view = 'performance') =>
  apiGet(`/competitions/${encodeURIComponent(slug)}/leaderboard?view=${view}`);

/** An account's public profile, by handle. */
export const getProfile = (handle) => apiGet(`/profiles/${encodeURIComponent(handle)}`);
