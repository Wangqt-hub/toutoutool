import type { Metadata } from "next";
import "./globals.css";
import { ReactNode } from "react";
import { Nunito } from "next/font/google";

const roundedFont = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-rounded"
});

export const metadata: Metadata = {
  title: "头头工具 · toutoutool",
  description: "可爱治愈系小工具集合站，陪你把灵感一点点变成现实。"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body
        className={`min-h-screen bg-cream-50 text-slate-800 ${roundedFont.variable}`}
      >
        {children}
      </body>
    </html>
  );
}

