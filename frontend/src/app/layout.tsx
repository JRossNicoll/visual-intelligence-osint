import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VIOSINT - Visual Intelligence OSINT Platform',
  description: 'Real-time video intelligence with object detection, tracking, and relationship graph analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-intel-bg text-white antialiased min-h-screen overflow-hidden">
        {children}
      </body>
    </html>
  )
}
