function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getFirstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

export function getAppUrl() {
  const configured = getFirstNonEmpty(
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  );

  return configured ? trimTrailingSlash(configured) : "http://localhost:3000";
}

export function getApiUrl() {
  const configured = getFirstNonEmpty(
    process.env.NEXT_PUBLIC_API_URL,
    process.env.API_URL,
    process.env.BACKEND_API_URL,
  );

  if (!configured) {
    return "http://localhost:3001";
  }

  return trimTrailingSlash(configured);
}

export function getNextAuthSecret() {
  return (
    getFirstNonEmpty(process.env.NEXTAUTH_SECRET, process.env.AUTH_SECRET) ??
    "receiptmind-vercel-fallback-secret"
  );
}

export function getSupabasePublishableKey() {
  return getFirstNonEmpty(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
