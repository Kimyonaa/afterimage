import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Afterimage — Revocation research lab',description:'Trace the private information that survives an access change. A reproducible security and deep learning research workbench.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
