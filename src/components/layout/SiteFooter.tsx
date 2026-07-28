import Link from 'next/link';
import { Logo } from './Logo';
import s from './layout.module.css';

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '/verify', label: 'Verify a claim' },
      { href: '/history', label: 'Verification history' },
      { href: '/dashboard', label: 'Analytics' },
    ],
  },
  {
    heading: 'Organisation',
    links: [
      { href: '/about', label: 'How it works' },
      { href: '/about#methodology', label: 'Methodology' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className={s.footer}>
      <div className="container">
        <div className={s.footerInner}>
          <div>
            <Link href="/" className={s.brand}>
              <Logo className={s.mark} />
              <span className={s.brandName}>VeritasGuard</span>
            </Link>
            <p className={s.footerBlurb}>
              Evidence-based verification for news and forwarded claims. Every verdict is traceable to the
              sources behind it — never to an opinion.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h2 className={s.footerHeading}>{column.heading}</h2>
              <ul className={s.footerList}>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={s.footerBottom}>
          <span>© {new Date().getFullYear()} VeritasGuard. Research project.</span>
          <span>
            Verdicts are automated assessments of available evidence, not a substitute for professional
            fact-checking.
          </span>
        </div>
      </div>
    </footer>
  );
}
