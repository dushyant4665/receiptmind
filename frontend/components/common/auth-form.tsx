"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const authSchema = z.object({
  mode: z.enum(["login", "signup"]),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().optional(),
  companyName: z.string().optional(),
});

type AuthMode = "login" | "signup";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const form = useForm<z.infer<typeof authSchema>>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      mode,
      name: "Alex Mercer",
      companyName: "ReceiptMind Labs",
      email: "alex@receiptmind.ai",
      password: "Password123!",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (mode === "signup") {
      if (!values.name || !values.companyName) {
        toast.error("Name and company name are required.");
        return;
      }
      toast.success("Workspace draft created. Use the backend signup endpoint to persist users.");
      return;
    }

    const result = await signIn("credentials", {
      ...values,
      redirect: false,
      callbackUrl: "/dashboard",
    });

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Welcome back. Redirecting to your dashboard.");
    router.push("/dashboard");
  });

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="space-y-2">
        <CardTitle className="font-heading text-2xl">
          {mode === "login" ? "Sign in to your workspace" : "Create an enterprise workspace"}
        </CardTitle>
        <p className="text-sm leading-6 text-ink3">
          {mode === "login"
            ? "Manage receipts, track expenses, and generate reports."
            : "Provision your tenant, configure rules, and manage your data."}
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          {mode === "signup" && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-sm">Full name</Label>
                <Input id="name" {...form.register("name")} />
                <p className="text-xs text-red">{form.formState.errors.name?.message}</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="companyName" className="text-sm">Company name</Label>
                <Input id="companyName" {...form.register("companyName")} />
                <p className="text-xs text-red">{form.formState.errors.companyName?.message}</p>
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email" className="text-sm">Work email</Label>
            <Input id="email" type="email" {...form.register("email")} />
            <p className="text-xs text-red">{form.formState.errors.email?.message}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password" className="text-sm">Password</Label>
            <Input id="password" type="password" {...form.register("password")} />
            <p className="text-xs text-red">{form.formState.errors.password?.message}</p>
          </div>
          <Button className="w-full bg-ink text-white hover:opacity-85" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting
              ? "Please wait..."
              : mode === "login"
                ? "Sign in"
                : "Create workspace"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-ink3">
          {mode === "login" ? "New to ReceiptMind?" : "Already have an account?"}{" "}
          <Link
            href={mode === "login" ? "/signup" : "/login"}
            className="font-medium text-ink underline-offset-4 hover:underline"
          >
            {mode === "login" ? "Create your workspace" : "Sign in"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
