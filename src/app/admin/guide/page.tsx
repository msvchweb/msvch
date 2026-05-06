import type { Metadata } from "next";
import Link from "next/link";
import {
  Newspaper,
  ImageIcon,
  MessageSquare,
  ArrowLeft,
  ExternalLink,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { AdminTourStartButton } from "@/components/admin/AdminTourStartButton";

export const metadata: Metadata = { title: "관리자 가이드" };

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={14} />
          대시보드
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
              관리자 가이드
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              공지사항·갤러리·문의 관리 방법을 정리한 가이드입니다. 주보 가이드는 준비 중입니다.
            </p>
          </div>
          <AdminTourStartButton label="화면 따라가기" />
        </div>
      </div>

      <Section icon={Newspaper} title="공지사항" href="/admin/notices">
        <Step n={1} title="새 공지 작성">
          페이지 상단의 <Kbd>+ 새 공지</Kbd> 버튼을 눌러 제목·카테고리·내용을 입력합니다.
          <ul className="mt-2 space-y-1 pl-4 text-gray-600">
            <li>• 카테고리: <strong>일반 / 긴급 / 행사</strong> 중 선택</li>
            <li>• 슬러그(URL)는 비워두면 자동 생성됩니다. 직접 영문으로 적으면 SEO에 유리합니다.</li>
            <li>• 날짜를 비워두면 작성일이 사용됩니다.</li>
          </ul>
        </Step>
        <Step n={2} title="히어로 이미지 업로드">
          목록의 썸네일 박스를 클릭해 이미지를 선택합니다.
          <ul className="mt-2 space-y-1 pl-4 text-gray-600">
            <li>• 지원 형식: JPEG · PNG · WebP · GIF (HEIC 불가)</li>
            <li>• 5MB 초과 사진은 자동 압축됩니다 — 원본 그대로 올리셔도 됩니다.</li>
            <li>• 썸네일 옆 <Kbd>×</Kbd> 버튼으로 히어로 이미지만 제거할 수 있습니다.</li>
          </ul>
        </Step>
        <Step n={3} title="공개 처리">
          상태 뱃지(<Kbd>비공개</Kbd>)를 클릭해 <Kbd>공개</Kbd>로 바꾸면 사이트 메인의 히어로 슬라이더와 공지 목록에 즉시 노출됩니다.
        </Step>
        <Tip>
          공개·비공개 전환 시 메인 페이지 캐시는 자동으로 갱신됩니다. 따로 누를 버튼이 없습니다.
        </Tip>
      </Section>

      <Section icon={ImageIcon} title="갤러리" href="/admin/gallery">
        <Step n={1} title="앨범 만들기">
          상단의 <Kbd>+ 새 앨범</Kbd> 버튼을 눌러 제목·카테고리·날짜를 입력합니다.
          <ul className="mt-2 space-y-1 pl-4 text-gray-600">
            <li>• 카테고리: 예배 / 교회학교 / 교회행사 / 봉사센터 / 새가족</li>
            <li>• 교회학교(영유치·아동·청소년·청년)와 봉사센터(반찬·이미용·비전문화·탁구)는 하위 부서를 추가로 선택합니다.</li>
          </ul>
        </Step>
        <Step n={2} title="사진 업로드">
          앨범 우측의 <Kbd>사진 추가</Kbd> 버튼으로 여러 장을 한 번에 업로드합니다.
          <ul className="mt-2 space-y-1 pl-4 text-gray-600">
            <li>• 한 번에 일정 매수까지만 업로드됩니다 (버튼에 표시된 매수 기준).</li>
            <li>• 10MB 초과 사진은 자동 압축됩니다.</li>
            <li>• <strong>HEIC는 지원하지 않습니다</strong>. iPhone은 <em>설정 → 카메라 → 포맷 → 높은 호환성</em>으로 바꾸면 JPEG로 저장됩니다.</li>
            <li>• 업로드 실패 사진이 있으면 앨범 아래 빨간 박스에 사유가 표시됩니다.</li>
          </ul>
        </Step>
        <Step n={3} title="공개 처리 · 정리">
          앨범 카드의 <Kbd>비공개</Kbd> 뱃지를 눌러 <Kbd>공개</Kbd>로 전환합니다. 첫 업로드된 사진이 자동으로 앨범 썸네일이 됩니다.
        </Step>
        <Tip>
          앨범 삭제 시 그 안의 모든 사진과 스토리지 파일도 함께 삭제됩니다. 되돌릴 수 없습니다.
        </Tip>
      </Section>

      <Section icon={MessageSquare} title="문의" href="/admin/inquiries">
        <Step n={1} title="문의 확인">
          사이트 챗봇으로 들어온 문의가 자동 수집됩니다. 이름 · 전화번호 · 메시지 · 접수 시각이 표시됩니다.
        </Step>
        <Step n={2} title="응대">
          전화번호를 클릭하면 모바일에서 바로 발신할 수 있습니다.
        </Step>
        <Step n={3} title="삭제">
          처리 완료된 문의는 우측 휴지통 아이콘으로 삭제해 목록을 깔끔히 유지합니다.
        </Step>
        <Tip>
          새 문의는 대시보드 <Kbd>오늘 문의</Kbd> 카드에 자동으로 카운트됩니다.
        </Tip>
      </Section>

      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm">
        <p className="font-medium text-gray-700">주보 가이드 (준비 중)</p>
        <p className="mt-1 text-gray-500">
          주보 관리 기능이 완성되는 대로 가이드를 추가합니다.
        </p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  href,
  children,
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Icon size={18} />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-primary-600"
        >
          바로가기
          <ExternalLink size={12} />
        </Link>
      </header>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
        {n}
      </div>
      <div className="min-w-0 flex-1 text-sm leading-relaxed text-gray-700">
        <p className="mb-1 font-semibold text-gray-900">{title}</p>
        {children}
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-700">
      {children}
    </span>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <Lightbulb size={14} className="mt-0.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}
