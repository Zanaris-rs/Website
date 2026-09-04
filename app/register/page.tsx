import type { Metadata } from "next";

import RegisterForm from "@/components/account/RegisterForm";
import Frame from "@/components/site/Frame";

export const metadata: Metadata = {
  title: "Create account | Zanaris",
  description: "Create an account to play on Zanaris.",
};

export default function Register() {
  return (
    <Frame>
      <RegisterForm />
    </Frame>
  );
}
