import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '명성비전교회',
    short_name: '명성비전교회',
    description: '꿈이 있는 건강한 교회 명성비전교회입니다',
    start_url: '/',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#c9a84c',
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
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon.png',
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
