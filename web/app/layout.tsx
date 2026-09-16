import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shell/Providers";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Serruchito Finanzas",
  description: "Dashboard unificado de inversiones: Cocos Capital, Balanz, Interactive Brokers e InvertirOnline.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Serruchito Finanzas",
  },
};

export const viewport: Viewport = {
  themeColor: "#b5502e",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-full">
        <Providers>
          <div className="flex min-h-full">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <Header />
              <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:px-6">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
