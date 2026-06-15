import type { Metadata } from "next";
import Link from "next/link";
import {
  Newspaper,
  ImageIcon,
  MessageSquare,
  ArrowLeft,
  ExternalLink,
  Lightbulb,
  FileText,
  Sparkles,
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
              공지사항·갤러리·주보·포스터 도구·문의 관리 방법을 정리한 가이드입니다.
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

      <Section icon={FileText} title="주보 생성" href="/admin/weeklies">
        <Step n={1} title="새 주보 작성">
          <Kbd>+ 새 주보 작성</Kbd> 버튼을 누르면 <strong>지난 주보의 내용이 자동으로 채워진 상태</strong>로 시작합니다. 날짜와 제목은 다가오는 일요일 기준으로 자동 계산되고, 발행 채널만 초기화됩니다.
        </Step>
        <Step n={2} title="6개 탭으로 나뉜 폼">
          <ul className="mt-2 space-y-1 pl-4 text-gray-600">
            <li>• <strong>기본</strong>: 제목·권/호·발행 채널</li>
            <li>• <strong>페이지1(주일예배)</strong>: 예배 순서 16행 + 암송말씀. 1부/2부 찬양은 접두 자동, 말씀 제목은 큰따옴표 자동.</li>
            <li>• <strong>페이지2(예배안내)</strong>: 주일오후·수요예배·다음주기도·헌금위원·안내위원·새벽예배·교회공동체 기도제목.</li>
            <li>• <strong>페이지3(헌금)</strong>: 향기로운 예물 10 카테고리 + 누계. 부활감사는 특별헌금 토글로 켜고 끌 수 있습니다.</li>
            <li>• <strong>페이지4(교회소식)</strong>: 교회소식·모임·새가족·식당봉사·봉사센터 — 각 섹션 표시 토글 가능.</li>
            <li>• <strong>주보 마스터</strong>: 매주 안 바뀌는 공용값(섬기는분들·후원하는분들·목장·표어·교회공동체 기도제목). 인라인으로 바로 수정.</li>
          </ul>
        </Step>
        <Step n={3} title="실시간 미리보기 + 발행">
          우측에 4페이지 전체가 실시간 렌더링됩니다. <Kbd>발행</Kbd>을 누르면 인쇄용·웹용 주보가 즉시 반영됩니다.
        </Step>
        <Tip>
          페이지2 주일오후 자리는 토글 한 번으로 <strong>목장모임 이미지</strong>로 대체할 수 있습니다. 부활감사 슬롯은 추수감사·성탄감사 등 이름을 자유롭게 바꿔 사용할 수 있습니다.
        </Tip>
      </Section>

      <Section icon={Sparkles} title="포스터 도구" href="/admin/posters">
        <Step n={1} title="① 프롬프트 만들기">
          행사 종류·제목·일정·장소·색감·스타일·분위기 칩을 고르면 <strong>영문 이미지 프롬프트</strong>가 자동으로 생성됩니다.
          <ul className="mt-2 space-y-1 pl-4 text-gray-600">
            <li>• 결과 영문 프롬프트 우측의 <Kbd>복사</Kbd> 버튼으로 복사</li>
            <li>• ChatGPT·Gemini·Midjourney·DALL·E 등 본인이 쓰는 이미지 생성 AI에 붙여넣기</li>
            <li>• 참고 이미지 첨부 시 색감/구도/둘 다 중 어느 측면을 차용할지 선택 가능</li>
          </ul>
        </Step>
        <Step n={2} title="② 이미지 마무리">
          AI가 만든 이미지를 업로드하면 한글 텍스트와 교회 푸터(로고·전화·주소·QR)를 합성해 다운로드 가능한 PNG로 만듭니다.
          <ul className="mt-2 space-y-1 pl-4 text-gray-600">
            <li>• 비율 선택: 인스타 1:1 / 스토리 9:16 / 인쇄용 A4</li>
            <li>• 한글 제목·본문 위치(상·중·하)와 크기·색·그림자 조절</li>
            <li>• 교회 푸터 자동 합성. 푸터 영역은 AI 프롬프트가 미리 비워두도록 지시되어 있어 겹치지 않습니다.</li>
          </ul>
        </Step>
        <Tip>
          AI에 따라 한국어 텍스트를 잘 못 그리는 경우가 많아, 보통 <strong>&quot;AI가 텍스트 안 그림 → 마무리 단계에서 한글 합성&quot;</strong> 흐름이 가장 깔끔합니다.
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
