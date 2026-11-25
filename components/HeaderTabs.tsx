"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { label: "hot", href: "/", sort: "hot" },
  { label: "new", href: "/?sort=new", sort: "new" },
  { label: "top", href: "/?sort=top", sort: "top" },
];

export function HeaderTabs() {
  const pathname = usePathname();
  const params = useSearchParams();
  const sort = params.get("sort") ?? "hot";
  return (
    <ul className="tabmenu">
      {TABS.map((t) => (
        <li key={t.label}>
          <Link href={t.href} className={pathname === "/" && sort === t.sort ? "selected" : ""}>
            {t.label}
          </Link>
        </li>
      ))}
      <li>
        <Link href="/submit" className={pathname === "/submit" ? "selected" : ""}>
          submit
        </Link>
      </li>
    </ul>
  );
}

export function StaticTabs() {
  return (
    <ul className="tabmenu">
      {[...TABS.map((t) => t.label), "submit"].map((label) => (
        <li key={label}>
          <a>{label}</a>
        </li>
      ))}
    </ul>
  );
}
