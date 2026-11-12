import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = { title: 'SwiftletCare', description: 'Giám sát và điều khiển nhà yến' };

// Tat hieu ung kinh khi may giat: mo trang voi ?kinh=0 (nho trong trinh duyet nay), ?kinh=1 de bat lai.
const GLASS_SWITCH = `try{var q=new URLSearchParams(location.search).get('kinh');if(q==='0')localStorage.setItem('sc-no-glass','1');if(q==='1')localStorage.removeItem('sc-no-glass');if(localStorage.getItem('sc-no-glass')==='1')document.documentElement.classList.add('no-glass')}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: GLASS_SWITCH }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
