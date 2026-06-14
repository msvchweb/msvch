import type { MetadataRoute } from 'next';
import { getLiturgicalDay } from '@/lib/liturgical/season';
import { SEASON_TO_TOKENS } from '@/lib/liturgical/colors';

export default function manifest(): MetadataRoute.Manifest {
  const day = getLiturgicalDay();
  
  // 중앙화된 SEASON_TO_TOKENS에서 현재 절기의 base 색상을 가져옴
  const themeColor = SEASON_TO_TOKENS[day.season]?.base || '#c9a84c';

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
