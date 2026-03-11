import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NYCHA Street Safety",
  description:
    "Identifying wide, non-truck-route streets adjacent to NYCHA developments with pedestrian crash data",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.mapbox.com/mapbox-gl-js/v3.8.0/mapbox-gl.css"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#0f1117]">{children}</body>
    </html>
  );
}
