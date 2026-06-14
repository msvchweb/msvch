import type { MetadataRoute } from 'next';
import { getLiturgicalDay } from '@/lib/liturgical/season';

export default function manifest(): MetadataRoute.Manifest {
  const day = getLiturgicalDay();
  
  // 절기별 테마 색상 매핑
  const themeColors = {
    advent: '#5C2E91',
    lent: '#5C2E91',
    holy_week: '#5C2E91',
    christmas: '#C9A84C',
    epiphany: '#C9A84C',
    easter: '#C9A84C',
    trinity: '#C9A84C',
    pentecost: '#B91C1C',
    reformation: '#B91C1C',
    good_friday: '#1A1A1A',
    ordinary_after_epiphany: '#2E7D32',
    ordinary_after_pentecost: '#2E7D32',
  };

  const themeColor = themeColors[day.season] || '#c9a84c';

  return {
    name: '명성비전교회',
    short_name: '명성비전교회',
    description: '꿈이 있는 건강한 교회 명성비전교회입니다',
    start_url: '/links',
    display: 'standalone',
    background_color: '#111827',
    theme_color: themeColor,
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
