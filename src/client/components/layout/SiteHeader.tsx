'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/client/components/ui';
import { useTheme } from './ThemeProvider';
import { Logo } from './Logo';
import s from './layout.module.css';

const NAV = [
  { href: '/verify', label: 'Verify' },
  { href: '/history', label: 'History' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/about', label: 'About' },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close the mobile sheet whenever the route changes.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className={s.header}>
      <div className="container">
        <div className={s.headerInner}>
          <Link href="/" className={s.brand}>
            <Logo className={s.mark} />
            <span className={s.brandName}>VeritasGuard</span>
          </Link>

          <nav className={s.nav} aria-label="Main">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${s.navLink} ${isActive(item.href) ? s.navLinkActive : ''}`}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={s.headerActions}>
            {/*
              Both icons are always rendered and CSS reveals the correct one for
              the active theme. The server cannot know the visitor's theme — it
              is applied by the pre-paint script from localStorage — so branching
              on it here would produce a hydration mismatch. The label is
              intentionally static for the same reason.
            */}
            <button type="button" className={s.iconBtn} onClick={toggleTheme} aria-label="Toggle light and dark theme">
              <span className={s.iconSun} aria-hidden="true">
                ☀
              </span>
              <span className={s.iconMoon} aria-hidden="true">
                ☾
              </span>
            </button>

            <Link href="/login" className={s.desktopOnly}>
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>

            <Link href="/verify" className={s.desktopOnly}>
              <Button size="sm">Verify a claim</Button>
            </Link>

            <button
              type="button"
              className={`${s.iconBtn} ${s.mobileToggle}`}
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label="Toggle navigation menu"
            >
              <span aria-hidden="true">{mobileOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>

        {mobileOpen && (
          <nav className={s.mobileNav} id="mobile-nav" aria-label="Mobile">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${s.navLink} ${isActive(item.href) ? s.navLinkActive : ''}`}
              >
                {item.label}
              </Link>
            ))}
            <Link href="/login" className={s.navLink}>
              Sign in
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
