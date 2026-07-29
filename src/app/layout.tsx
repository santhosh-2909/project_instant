import type { Metadata, Viewport } from 'next';
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import { SiteHeader } from '@/client/components/layout/SiteHeader';
import { SiteFooter } from '@/client/components/layout/SiteFooter';
import { ThemeProvider } from '@/client/components/layout/ThemeProvider';
import { siteUrl } from '@/shared/siteUrl';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  // Makes every relative OG/canonical URL absolute, and keeps preview
  // deployments from advertising themselves as the production site.
  metadataBase: new URL(siteUrl()),
  title: {
    default: 'VeritasGuard — Evidence-based news verification',
    template: '%s · VeritasGuard',
  },
  description:
    'VeritasGuard verifies news claims against professional fact-checks and independent reporting, and shows you every source behind the verdict.',
  applicationName: 'VeritasGuard',
  keywords: ['fact checking', 'misinformation', 'news verification', 'evidence'],
  openGraph: {
    title: 'VeritasGuard — Evidence-based news verification',
    description:
      'Verify a claim against professional fact-checks and independent reporting. Every verdict cites its sources.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f4ec' },
    { media: '(prefers-color-scheme: dark)', color: '#12140f' },
  ],
};

/**
 * Applies the stored theme before first paint so there is no flash of the
 * wrong palette. Kept deliberately tiny and dependency-free.
 */
const themeScript = `
(function(){try{
  var t = localStorage.getItem('vg-theme');
  if(!t){t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';}
  document.documentElement.setAttribute('data-theme', t);
}catch(e){document.documentElement.setAttribute('data-theme','light');}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sans.variable} ${serif.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <a href="#main" className="skip-link">
            Skip to main content
          </a>
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
