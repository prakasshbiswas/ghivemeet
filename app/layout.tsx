import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  metadataBase: new URL('https://meet.ghiveph.com'),
  title: {
    default: 'G-Hive Meet | Enterprise Video Conferencing by GHivePH & GMakesIT',
    template: '%s | G-Hive Meet',
  },
  description:
    'High-performance WebRTC video conferencing with end-to-end encryption, Krisp noise cancellation, and sub-50ms latency powered by GMakesIT.',
  twitter: {
    creator: '@ghiveph',
    site: '@ghiveph',
    card: 'summary_large_image',
  },
  openGraph: {
    url: 'https://meet.ghiveph.com',
    images: [
      {
        url: '/images/gdelivers-logo.png',
        width: 1200,
        height: 1200,
        type: 'image/png',
      },
    ],
    siteName: 'G-Hive Meet',
  },
  icons: {
    icon: {
      rel: 'icon',
      url: '/images/gdelivers-logo.png',
    },
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/images/gdelivers-logo.png',
        sizes: '180x180',
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#070707',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
