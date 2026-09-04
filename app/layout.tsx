import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Zanaris",
  description:
    "A Lost City (2004scape) server. Pick a world and play in your browser.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
