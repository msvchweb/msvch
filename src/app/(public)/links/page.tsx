import QRCode from 'qrcode';
import { Home, BookOpen, CirclePlay } from 'lucide-react';
import { InstagramIcon } from '@/components/icons/InstagramIcon';
import { InstallButton } from '@/components/links/InstallButton';

const PAGE_URL = 'https://www.msvch.org/links';

type LinkItem = {
  label: string;
  href: string;
  icon: string;
  description: string;
};

const links: LinkItem[] = [
  {
    label: '홈페이지',
    href: 'https://www.msvch.org/',
    icon: 'home',
    description: '명성비전교회 홈페이지',
  },
  {
    label: '블로그',
    href: 'https://blog.naver.com/msvch01/',
    icon: 'blog',
    description: '네이버 블로그',
  },
  {
    label: '유튜브',
    href: 'https://www.youtube.com/@msvchphoto',
    icon: 'youtube',
    description: '@msvchphoto',
  },
  {
    label: '인스타그램 (메인)',
    href: 'https://www.instagram.com/msvch_main',
    icon: 'instagram',
    description: '@msvch_main',
  },
  {
    label: '인스타그램 (청년부)',
    href: 'https://www.instagram.com/msvch_insta/',
    icon: 'instagram',
    description: '@msvch_insta',
  },
  {
    label: '인스타그램 (청소년부)',
    href: 'https://www.instagram.com/msvch_middle/',
    icon: 'instagram',
    description: '@msvch_middle',
  },
  {
    label: '인스타그램 (아동부)',
    href: 'https://www.instagram.com/msvch_children/',
    icon: 'instagram',
    description: '@msvch_children',
  },
];

function LinkIcon({ type }: { type: string }) {
  if (type === 'home') return <Home size={22} className="shrink-0" />;
  if (type === 'blog')
    return (
      <BookOpen size={22} className="shrink-0" />
    );
  if (type === 'youtube') return <CirclePlay size={22} className="shrink-0" />;
  return <InstagramIcon size={22} className="shrink-0" />;
}

export default async function LinksPage() {
  const qrSvg = await QRCode.toString(PAGE_URL, {
    type: 'svg',
    margin: 1,
    color: { dark: '#1a1a1a', light: '#f5f0e8' },
  });

  return (
    <main className="min-h-screen bg-church-dark flex flex-col items-center justify-start px-4 py-12">
      {/* 헤더 */}
      <div className="mb-6 text-center">
        <p className="text-church-gold text-sm tracking-widest uppercase mb-1">명성비전교회</p>
        <h1 className="text-white text-2xl font-bold tracking-tight">링크 모음</h1>
        <p className="text-white/50 text-sm mt-1">원하는 채널을 선택하세요</p>
      </div>

      {/* 앱 설치 버튼 */}
      <InstallButton />

      {/* 링크 카드 */}
      <div className="w-full max-w-sm flex flex-col gap-3">
        {links.map((link) => {
          const content = (
            <>
              <span className="text-church-gold group-hover:scale-110 transition-transform duration-200">
                <LinkIcon type={link.icon} />
              </span>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm leading-tight">{link.label}</span>
                <span className="text-white/40 text-xs mt-0.5 truncate">{link.description}</span>
              </div>
              <svg
                className="ml-auto shrink-0 text-white/20 group-hover:text-church-gold/60 transition-colors"
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </>
          );
          const className =
            "flex items-center gap-4 bg-white/5 hover:bg-church-gold/20 border border-white/10 hover:border-church-gold/50 rounded-xl px-5 py-4 text-white transition-all duration-200 group";

          return (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {content}
            </a>
          );
        })}
      </div>

      {/* QR 코드 */}
      <div className="mt-12 flex flex-col items-center gap-3">
        <p className="text-white/40 text-xs tracking-wider uppercase">이 페이지 QR코드</p>
        <div
          className="rounded-xl overflow-hidden border border-white/10 w-40 h-40"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="text-white/30 text-xs">{PAGE_URL}</p>
      </div>
    </main>
  );
}
