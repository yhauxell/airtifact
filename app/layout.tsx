import { Analytics } from '@vercel/analytics/next'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Static Website Uploader',
  description: 'Upload a ZIP, get a shareable link instantly.',
}

// Inline script runs before first paint to apply .dark on <html> without flash.
// Reads localStorage 'theme' key, falls back to prefers-color-scheme.
const darkModeScript = [
  '(function(){',
  "  try {",
  "    var t = localStorage.getItem('theme');",
  "    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;",
  "    if (t === 'dark' || (t === null && prefersDark)) {",
  "      document.documentElement.classList.add('dark');",
  "    }",
  "  } catch (e) {}",
  '})();',
].join('\n');

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
