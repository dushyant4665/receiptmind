import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";
import { getApiUrl, getNextAuthSecret } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const API_URL = getApiUrl();

type BackendAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };
  data?: {
    accessToken?: string;
    refreshToken?: string;
    user?: {
      id: string;
      email: string;
      name?: string;
      role?: string;
    };
  };
};

function normalizeAuthResponse(payload: BackendAuthResponse) {
  const user = payload.user ?? payload.data?.user;
  const accessToken = payload.access_token ?? payload.data?.accessToken;
  const refreshToken = payload.refresh_token ?? payload.data?.refreshToken;

  if (!user || !accessToken || !refreshToken) {
    throw new Error("Malformed auth response.");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    accessToken,
    refreshToken,
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
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
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
