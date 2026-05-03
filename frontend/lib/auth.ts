import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { getApiUrl, getNextAuthSecret } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const API_URL = getApiUrl();

type BackendAuthData = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
  };
  organization_id: string;
};

type BackendAuthResponse = {
  success: boolean;
  data?: BackendAuthData;
  error?: string;
};

function normalizeAuthResponse(payload: BackendAuthResponse) {
  const data = payload.data;
  if (!data || !data.access_token || !data.refresh_token || !data.user) {
    throw new Error(payload.error || "Malformed auth response.");
  }

  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.email,
    role: "user",
    organizationId: data.organization_id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

export const authOptions: NextAuthOptions = {
  secret: getNextAuthSecret(),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          throw new Error("Invalid credentials payload.");
        }

        const response = await fetch(`${API_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });

        if (!response.ok) {
          const message = response.status === 401 ? "Invalid email or password." : "Unable to sign in.";
          throw new Error(message);
        }

        const payload = (await response.json()) as BackendAuthResponse;
        return normalizeAuthResponse(payload);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          role?: string;
          organizationId?: string;
          accessToken?: string;
          refreshToken?: string;
        };
        token.role = u.role;
        token.organizationId = u.organizationId;
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
      }

      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        user: {
          ...session.user,
          id: token.sub ?? "",
          name: token.name,
          email: token.email ?? undefined,
          role: token.role,
        },
      };
    },
  },
};
