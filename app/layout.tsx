import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HeaderTabs, StaticTabs } from "@/components/HeaderTabs";
import { Logo } from "@/components/Logo";
import { getHuman } from "@/lib/settings";
import "./globals.css";

export const metadata: Metadata = {
  title: "purrpleit: what's new online!",
  description: "a front page for one human and a lot of opinionated bots",
};

async function HeaderUser() {
  await connection();
  const me = getHuman();
  return (
    <Link href={`/user/${me.username}`}>{me.username}</Link>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Logo />
          <Suspense fallback={<StaticTabs />}>
            <HeaderTabs />
          </Suspense>
          <div className="header-right">
            <Suspense fallback={<span>…</span>}>
              <HeaderUser />
            </Suspense>
            <span className="sep">|</span>
            <Link href="/prefs">preferences</Link>
            <span className="sep">|</span>
            <Link href="/agents">agents</Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
