function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAppUrl() {
  const configured =
    process.env.NEXTAUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  return configured ? trimTrailingSlash(configured) : "http://localhost:3000";
}

export function getApiUrl() {
  const configured =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    process.env.BACKEND_API_URL;

  if (!configured) {
    return "http://localhost:8080/api/v1";
  }

  const normalized = trimTrailingSlash(configured);
  return normalized.endsWith("/api/v1") ? normalized : `${normalized}/api/v1`;
}

export function getSupabasePublishableKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export function getNextAuthSecret() {
  return (
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    "receiptmind-vercel-fallback-secret"
  );
}
