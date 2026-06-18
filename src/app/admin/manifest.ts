import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: 'msvch-admin',
    name: '명성비전교회(관리자)',
    short_name: '관리자',
    description: '명성비전교회 직원 전용 관리 도구',
    start_url: '/admin',
    scope: '/admin',
    display: 'standalone',
    background_color: '#0f172a', // slate-900 (admin theme)
    theme_color: '#fbbf24',     // amber-400 (admin theme accent)
    icons: [
      {
        src: '/favicon.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '48x48',
        type: 'image/png',
      },
      {
        src: '/icons/admin-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/admin-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
