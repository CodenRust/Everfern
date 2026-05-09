import type { Metadata } from 'next'
import { Figtree } from 'next/font/google'
import './globals.css'

const figtree = Figtree({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-figtree',
})

export const metadata: Metadata = {
  title: 'Global Warming Info – Understand, Act, Change',
  description: 'Learn about global warming causes, impacts, and solutions. Take action today to reduce your carbon footprint and help protect our planet.',
  keywords: [
    'global warming',
    'climate change',
    'carbon footprint',
    'sustainability',
    'environment',
    'eco-friendly',
    'green living',
  ],
  authors: [{ name: 'EverFern' }],
  creator: 'EverFern',
  publisher: 'EverFern',
  openGraph: {
    title: 'Global Warming Info',
    description: 'Understand the science, impacts, and solutions to global warming.',
    url: 'https://global-warming-info.vercel.app',
    siteName: 'Global Warming Info',
    images: [
      {
        url: 'https://global-warming-info.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Global Warming Info – Understand, Act, Change',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Global Warming Info – Understand, Act, Change',
    description: 'Learn about global warming causes, impacts, and solutions.',
    images: ['https://global-warming-info.vercel.app/og-image.png'],
    creator: '@everfern',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${figtree.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}