import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tennis-Agent · 看懂网球战术",
  description:
    "上传比赛视频，挖掘可复用的战术模式：发球+1 球路、方向组合、回合胜负关系，并变成你自己的练法。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
