import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BizTech Partnerships",
  description: "Internal CRM for the BizTech partnerships team.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
