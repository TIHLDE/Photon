import "../styles/globals.css";
import { Inter } from "next/font/google";
import type { Metadata } from "next";
import {Toaster} from "sonner";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bedrifter | TIHLDE",
  description: "Linjeforeningen for datastudenter ved NTNU",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
      >
        {children}
      <Toaster />
      </body>
    </html>
  );
}
