export const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
};

export const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};
