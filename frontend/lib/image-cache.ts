// In-memory cache for newly uploaded receipts to guarantee images show up instantly
// This is used as a fallback while the backend/database is syncing
export const globalImageCache: Record<string, string> = {};
