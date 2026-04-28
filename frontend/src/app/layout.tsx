import type { Metadata } from "next"
import { Inter } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"
import "@fortawesome/fontawesome-free/css/all.min.css"
import { cn } from "@/lib/utils"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
})

export const metadata: Metadata = {
  title: "MedLock — Compliance Manager",
  description:
    "MedLock provides HIPAA compliance, PHI protection, and security controls for healthcare organizations.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cn(inter.variable)}>
      <body className={cn(inter.className, geistMono.variable, "antialiased")}>
        {children}
      </body>
    </html>
  )
}
