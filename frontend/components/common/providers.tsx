"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { setApiAuthToken } from "@/lib/api-client";

function ApiAuthBinder({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    setApiAuthToken(session?.accessToken ?? null);
    return () => setApiAuthToken(null);
  }, [session?.accessToken]);

  return children;
}

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session: Session | null;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider session={session}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delay={150}>
            <ApiAuthBinder>{children}</ApiAuthBinder>
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
