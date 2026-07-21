import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fake News Detection System",
  description: "Verify the authenticity of news articles using AI and semantic cross-referencing.",
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
