import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo | Minimalist 3D Time-Rewind Arcade Game",
  description: "Survive as many loops as possible while navigating an increasingly crowded world created by your own past decisions. A minimalist 3D arcade experience built with React Three Fiber.",
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
