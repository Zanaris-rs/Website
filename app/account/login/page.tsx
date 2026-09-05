import type { Metadata } from "next";
import { redirect } from "next/navigation";

import LoginForm from "@/components/account/LoginForm";
import Frame from "@/components/site/Frame";
import { readSession } from "@/lib/account/session-server";

export const metadata: Metadata = {
  title: "Login",
  description: "Log in to your Zanaris account centre.",
};

/**
 * `readSession()` reads a cookie, which makes this page dynamic — it can never
 * be prerendered, and must never be cached: a cached copy would be one
 * reader's answer served to the next.
 */
export const dynamic = "force-dynamic";

export default async function Login() {
  // Already signed in: there is nothing to do here. The redirect is outside
  // any try/catch, because `redirect()` works by throwing.
  if (await readSession()) redirect("/account");

  return (
    <Frame>
      <LoginForm />
    </Frame>
  );
}
