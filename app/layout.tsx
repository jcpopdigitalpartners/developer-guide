import type { Metadata } from 'next';
import './globals.css';
import { sitePath } from '../lib/paths';
export const metadata: Metadata = { title: 'Developer Playbook — Architecture you can hear', description: 'Seven audio lessons on Astro, Next.js, and choosing the right boundaries. Listen, explore, and practice.', icons: { icon: sitePath('icon.svg') } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
