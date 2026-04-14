import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DeckFarm - Gestão Agrícola Inteligente',
  description: 'Sistema inteligente de gerenciamento de lavouras agrícolas para agrônomos',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DeckFarm' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

// Inline script to apply theme before first paint (prevents flash)
const themeScript = `
(function() {
  try {
    var s = localStorage.getItem('deckfarm-theme');
    var p = s ? JSON.parse(s) : null;
    var t = p && p.state && p.state.theme ? p.state.theme : 'light';
    if (t === 'system') {
      t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
