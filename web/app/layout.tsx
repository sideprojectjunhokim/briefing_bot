import type { Metadata } from "next";
import { Anton, JetBrains_Mono, Newsreader, Noto_Serif_KR } from "next/font/google";
import "./globals.css";

// mosbyfiles 3서체 역할 — 전부 next/font 셀프호스트(웹폰트 CDN 링크 없음)
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});
const serifKr = Noto_Serif_KR({
  weight: ["400", "600", "700"],
  variable: "--font-serifkr",
  display: "swap",
  preload: false,
});
const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
const jbMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "오늘의 브리핑",
  description: "매일 아침 내가 볼 것들",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      className={`${newsreader.variable} ${serifKr.variable} ${anton.variable} ${jbMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
