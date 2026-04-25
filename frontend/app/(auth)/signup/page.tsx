"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { postApiData } from "@/lib/api-client";

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

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = useMemo(() => {
    if (password.length === 0) return 0;
    if (password.length < 6) return 1;
    if (password.length < 10) return 2;
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 3;
    return 4;
  }, [password]);

  return (
    <div className="w-full max-w-[400px] rounded-[12px] border border-border-default bg-bg-surface p-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-6 flex w-fit items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-[6px] bg-text-primary text-[11px] font-medium tracking-[1px] text-white">
            RM
          </span>
          <span className="text-[15px] font-medium tracking-[-0.3px] text-text-primary">ReceiptMind</span>
        </div>
        <h1 className="text-[18px] font-medium text-text-primary">Create your account</h1>
        <p className="mt-1 text-[13px] text-text-muted">14-day free trial. No credit card.</p>
      </div>

      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();

          if (!accepted) {
            toast.error("Accept the terms to continue.");
            return;
          }

          setIsSubmitting(true);

          try {
            await postApiData("/auth/register", {
              name,
              email,
              password,
            });

            const result = await signIn("credentials", {
              email,
              password,
              redirect: false,
            });

            if (!result || result.error) {
              throw new Error(result?.error ?? "Unable to sign in after registration.");
            }

            toast.success("Account created.");
            router.push("/dashboard");
            router.refresh();
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to create account.";
            toast.error(message);
          } finally {
            setIsSubmitting(false);
          }
        }}
      >
        <div>
          <Label htmlFor="name" className="mb-1.5 text-[12px] font-medium text-text-secondary">
            Full name
          </Label>
          <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="email" className="mb-1.5 text-[12px] font-medium text-text-secondary">
            Work email
          </Label>
          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="password" className="mb-1.5 text-[12px] font-medium text-text-secondary">
            Password
          </Label>
          <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <div className="mt-3 flex gap-[3px]">
            {[1, 2, 3, 4].map((segment) => (
              <span
                key={segment}
                className={[
                  "h-[3px] flex-1 rounded-[2px]",
                  segment <= strength
                    ? strength === 1
                      ? "bg-error"
                      : strength <= 3
                        ? "bg-amber"
                        : "bg-success"
                    : "bg-border-default",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2 text-[12px] leading-[1.6] text-text-muted">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-0.5 size-4 rounded-[4px] border border-border-default"
          />
          <span>
            I agree to{" "}
            <Link href="/terms" className="text-amber transition-[color] hover:text-amber-hover">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-amber transition-[color] hover:text-amber-hover">
              Privacy Policy
            </Link>
          </span>
        </label>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border-default" />
        <span className="text-[13px] text-text-muted">or</span>
        <div className="h-px flex-1 bg-border-default" />
      </div>

      <button
        type="button"
        className="flex h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-border-default bg-bg-surface text-[13px] text-text-secondary transition-[border-color,color] hover:border-border-strong hover:text-text-primary"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="mt-5 text-center text-[13px] text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-amber transition-[color] hover:text-amber-hover">
          Sign in
        </Link>
      </p>
    </div>
  );
}
