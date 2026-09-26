import type { Metadata, Viewport } from 'next';
import './globals.css';
import { UpdateNotifier } from '@/components/UpdateNotifier';
import { APP_ICONS, APP_THEME_COLOR } from '@/lib/app-branding';

export const metadata: Metadata = {
  title: 'NVR.io',
  description: 'NVR.io — personal records and payment tracking',
  applicationName: 'NVR.io',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: APP_ICONS.favicon, sizes: '32x32', type: 'image/png' },
      { url: APP_ICONS.icon192, sizes: '192x192', type: 'image/png' },
      { url: APP_ICONS.icon512, sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: APP_ICONS.apple, sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'NVR.io',
  },
};

export const viewport: Viewport = {
  themeColor: APP_THEME_COLOR,
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600;8..60,700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href={APP_ICONS.favicon} sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href={APP_ICONS.apple} />
      </head>
      <body className="min-h-screen bg-ink-950 font-sans text-slate-100 antialiased">
        <UpdateNotifier />
        {children}
      </body>
    </html>
  );
}
