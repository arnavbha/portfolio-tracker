import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Research — Portfolio Tracker",
  description:
    "Daily framework-driven scan of the S&P 100. One pick on a viable day, nothing on a non-viable day. Full track record.",
};

const NAV: Array<{ href: string; label: string }> = [
  { href: "/research", label: "Today" },
  { href: "/research/journal", label: "Journal" },
  { href: "/research/graveyard", label: "Graveyard" },
  { href: "/research/framework", label: "Framework" },
  { href: "/research/feed.xml", label: "RSS" },
];

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto max-w-5xl px-6 py-5 flex items-baseline justify-between">
          <Link
            href="/research"
            className="text-base font-semibold tracking-tight hover:text-white transition-colors"
          >
            Research
          </Link>
          <nav aria-label="Research sections" className="flex gap-5 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      <footer className="border-t border-zinc-800/80 mt-16">
        <div className="mx-auto max-w-5xl px-6 py-6 text-xs text-zinc-500 flex justify-between">
          <span>Daily framework scan. Not investment advice.</span>
          <Link href="/research/feed.xml" className="hover:text-zinc-300 transition-colors">
            Atom feed
          </Link>
        </div>
      </footer>
    </div>
  );
}
