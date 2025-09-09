import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reviewly",
  description: "Reviewly",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* Theme init script to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
  (function() {
    try {
      var stored = localStorage.getItem('theme');
      var isDark = stored ? stored === 'dark' : true;
      var root = document.documentElement;
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } catch (_) {}
  })();
            `,
          }}
        />
        {children}
      </body>
    </html>
  );
}
