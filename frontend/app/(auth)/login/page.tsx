"use client";

import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, ArrowRight } from "lucide-react";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.2-.9 2.3-1.9 3.1l3.1 2.4c1.8-1.7 2.9-4.2 2.9-7.2 0-.7-.1-1.5-.2-2.2H12Z" />
      <path fill="#34A853" d="M12 21c2.6 0 4.8-.9 6.4-2.3l-3.1-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.6-1.7-5.3-4H3.4v2.5C5 18.9 8.2 21 12 21Z" />
      <path fill="#4A90E2" d="M6.7 13.2c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V6.7H3.4C2.8 7.9 2.5 9.2 2.5 11.2s.3 3.3.9 4.5l3.3-2.5Z" />
      <path fill="#FBBC05" d="M12 5.1c1.4 0 2.6.5 3.6 1.4l2.7-2.7C16.8 2.5 14.6 1.5 12 1.5 8.2 1.5 5 3.6 3.4 6.7l3.3 2.5c.7-2.3 2.8-4.1 5.3-4.1Z" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="w-full max-w-[420px] rounded-xl border border-border-default bg-white p-8 shadow-md animate-in">
      {/* Brand */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl bg-ink shadow-md">
          <Receipt className="size-5 text-white" />
        </div>
        <h1 className="text-[20px] font-semibold text-text-primary tracking-tight">Welcome back</h1>
        <p className="mt-1 text-[13px] text-text-muted">Sign in to your ReceiptMind account</p>
      </div>

      {/* Form */}
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setIsSubmitting(true);

          const result = await signIn("credentials", {
            email,
            password,
            redirect: false,
          });

          setIsSubmitting(false);

          if (!result || result.error) {
            toast.error(result?.error ?? "Unable to sign in.");
            return;
          }

          toast.success("Signed in successfully.");
          router.push(searchParams.get("callbackUrl") ?? "/dashboard");
          router.refresh();
        }}
      >
        <div>
          <Label htmlFor="email" className="mb-1.5 text-[12px] font-medium text-text-secondary">
            Work email
          </Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="password" className="text-[12px] font-medium text-text-secondary">
              Password
            </Label>
            <Link href="/forgot-password" className="text-[12px] text-amber hover:text-amber-hover transition-colors">
              Forgot password?
            </Link>
          </div>
          <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </div>
        <Button type="submit" variant="amber" className="w-full h-10 rounded-lg text-[13px] font-medium" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
          {!isSubmitting && <ArrowRight className="ml-1.5 size-3.5" />}
        </Button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-default" />
        <span className="text-[11px] text-text-ghost uppercase tracking-wider">or</span>
        <div className="h-px flex-1 bg-border-default" />
      </div>

      {/* Google */}
      <button
        type="button"
        className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-border-default bg-white text-[13px] font-medium text-text-secondary transition-all hover:border-ink5 hover:shadow-xs"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      {/* Footer */}
      <p className="mt-6 text-center text-[13px] text-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-amber font-medium hover:text-amber-hover transition-colors">
          Start for free <ArrowRight className="inline size-3" />
        </Link>
      </p>
    </div>
  );
}
