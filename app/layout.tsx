import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Martin Virtual Twin",
  description: "A personal virtual twin website for conversations with Martin's AI representative.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
