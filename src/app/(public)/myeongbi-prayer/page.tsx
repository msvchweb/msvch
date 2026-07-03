import type { Metadata } from "next";
import Image from "next/image";
import QRCode from "qrcode";
import {
  CalendarDays,
  CheckCircle2,
  Church,
  Clock3,
  Flame,
  HandHeart,
  HeartHandshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MyeongbiPrayerForm } from "./MyeongbiPrayerForm";

const PAGE_URL = "https://www.msvch.org/myeongbi-prayer";

export const metadata: Metadata = {
  title: "2026 명비 기도인 모집",
  description:
    "명성비전교회 2026 명비 기도인 모집 안내입니다. 교회와 성도를 위해 함께 기도할 성도님들을 초청합니다.",
  alternates: {
    canonical: "/myeongbi-prayer",
  },
};

const prayerCards: Array<{
  title: string;
  body: string;
  icon: LucideIcon;
}> = [
  {
    title: "공동 기도제목",
    body: "교회의 예배, 영적 부흥, 목회 방향, 주요 사역, 다음세대, 청년, 전도와 선교를 위해 기도합니다.",
    icon: Church,
  },
  {
    title: "요일별 기도제목",
    body: "공동 기도제목과 더불어 요일별 주제에 따라 집중적으로 기도합니다.",
    icon: CalendarDays,
  },
  {
    title: "긴급 기도제목",
    body: "성도의 수술, 사고, 장례 등 갑작스럽고 긴급한 기도제목이 전달될 경우 함께 기도합니다. 긴급 기도제목은 담당 교역자의 확인을 거쳐 기도팀에 전달됩니다.",
    icon: ShieldCheck,
  },
  {
    title: "정기 공동기도",
    body: "명비 기도인은 정기적으로 함께 모여 교회와 성도들을 위해 합심하여 기도합니다.",
    icon: Users,
  },
];

const participationItems = [
  "세례 또는 입교를 받은 성도",
  "기도와 예배를 사모하며 중보기도 사역에 함께하기 원하는 성도",
  "활동 기간 동안 성실하게 기도와 정기 모임에 참여할 수 있는 성도",
];

export default async function MyeongbiPrayerPage() {
  const qrDataUrl = await QRCode.toDataURL(PAGE_URL, {
    width: 220,
    margin: 1,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return (
    <main className="bg-slate-50 text-slate-900">
      <section className="bg-slate-950 px-4 py-10 text-white sm:py-14">
        <div className="mx-auto max-w-4xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-white/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
            <Sparkles size={15} aria-hidden />
            &ldquo;쉬지 말고 기도하라&rdquo; (살전 5:17)
          </div>

          <div className="space-y-5">
            <p className="text-sm font-bold uppercase text-emerald-300">
              우리 교회는 기도합니다
            </p>
            <h1 className="text-4xl font-black leading-tight sm:text-6xl">
              2026 명비 기도인
            </h1>
            <p className="max-w-2xl whitespace-pre-line text-lg font-medium leading-8 text-slate-200 sm:text-xl">
              {"기도제목을 품고,\n영적 싸움을 싸우며,\n교회를 세우는 기도의 사람들"}
            </p>
          </div>

          <div className="mt-8 rounded-lg border border-amber-300/40 bg-amber-300 px-5 py-5 text-slate-950 shadow-xl">
            <p className="text-sm font-black uppercase">184일간의 대장정</p>
            <p className="mt-1 text-3xl font-black tracking-normal sm:text-4xl">
              기도 대행진
            </p>
          </div>

          <div className="mt-8 space-y-2 text-lg font-semibold leading-8 text-white">
            <p>지금, 기도의 자리에 함께 서십시오.</p>
            <p>한 사람의 기도가 교회를 세웁니다.</p>
            <p className="text-emerald-200">
              명성비전교회의 기도는 멈추지 않습니다.
            </p>
          </div>

          <a
            href="#apply"
            className="mt-8 inline-flex w-full items-center justify-center rounded-lg bg-emerald-500 px-5 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-emerald-400 sm:w-auto"
          >
            신청하기
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:py-12">
        <NoticeSection icon={HandHeart} title="명비 기도인이란?">
          <p>
            명비 기도인은 교회의 공식 중보기도 사역팀으로서, 교회의 공동기도
            제목과 성도들의 긴급한 기도제목을 품고 정해진 기간 동안 함께
            기도로 섬기는 사람들입니다.
          </p>
          <p>
            기도의 장소가 반드시 교회로 제한되는 것은 아닙니다. 가정에서,
            일터에서, 삶의 자리에서 교회와 성도들을 위해 함께 기도합니다.
          </p>
        </NoticeSection>

        <NoticeSection icon={Flame} title="왜 명비 기도인이 필요한가?">
          <p>
            교회는 기도로 세워집니다. 예배와 영적 부흥, 목회 방향과 주요
            사역, 다음세대와 청년, 전도와 선교, 그리고 성도들의 삶의 문제들을
            위해 함께 기도할 사람들이 필요합니다.
          </p>
          <p className="font-semibold text-slate-950">
            기도는 보이지 않는 자리에서 드려지지만, 교회를 세우는 가장 중요한
            영적 섬김입니다.
          </p>
        </NoticeSection>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <SectionTitle
            icon={HeartHandshake}
            title="명비 기도인이 함께 기도하는 내용"
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {prayerCards.map((card, index) => (
              <PrayerCard key={card.title} index={index + 1} {...card} />
            ))}
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          <InfoPanel icon={Clock3} title="정기 공동기도 안내">
            <ul className="space-y-3 text-sm leading-6 text-slate-700">
              <li>매주 수요예배, 금요예배 중 1회 이상 참석</li>
              <li>전체 기도 모임 월 1회</li>
              <li>첫째 주 수요예배 후 모임</li>
              <li>모임 시간: 약 30분~60분</li>
            </ul>
          </InfoPanel>

          <InfoPanel icon={CalendarDays} title="활동 기간">
            <p className="text-sm leading-6 text-slate-700">
              <strong className="block text-base text-slate-950">
                명비 기도인 1기 활동 기간
              </strong>
              2026년 7월 1일 수요일 ~ 2026년 12월 31일 목요일
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-700">
              6개월 동안 함께 기도한 후에는 기도사역을 돌아보고 계속 참여
              여부를 재헌신하게 됩니다.
            </p>
          </InfoPanel>
        </section>

        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-7">
          <SectionTitle icon={Users} title="명비 기도인 40명 모집" />
          <p className="mt-4 text-base leading-7 text-slate-800">
            2026년 하반기, 교회를 위해 함께 기도할 명비 기도인 40명을
            모집합니다. 기도의 자리에 함께 서기 원하는 성도님들의 참여를
            기다립니다.
          </p>
          <div className="mt-5 rounded-lg bg-white p-4">
            <h3 className="text-sm font-bold text-slate-950">참여 안내</h3>
            <ul className="mt-3 space-y-2">
              {participationItems.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-6 text-slate-700"
                >
                  <CheckCircle2
                    size={17}
                    className="mt-1 shrink-0 text-emerald-600"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          id="apply"
          className="scroll-mt-24 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <SectionTitle icon={MessageCircle} title="신청 방법" />
          <p className="mt-4 text-base leading-7 text-slate-700">
            아래 신청서를 작성해 주세요. 신청 후 담당자가 확인하여
            안내드립니다.
          </p>
          <div className="mt-6">
            <MyeongbiPrayerForm />
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <h2 className="text-xl font-black text-slate-950">문의</h2>
            <p className="mt-3 text-base leading-7 text-slate-700">
              명성비전교회 교역자실 또는 담당 교역자에게 문의해 주세요.
            </p>
            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-lg font-black leading-8 text-slate-950">
                기도의 자리에 서는 한 사람을 기다립니다.
              </p>
              <p className="mt-2 text-base font-semibold leading-7 text-emerald-700">
                함께 기도할 때, 교회가 세워집니다.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm">
            <h2 className="text-base font-black text-slate-950">
              상세페이지 QR코드
            </h2>
            <Image
              src={qrDataUrl}
              alt="2026 명비 기도인 모집 상세페이지 QR코드"
              width={220}
              height={220}
              unoptimized
              className="mx-auto mt-4 h-44 w-44 rounded-lg border border-slate-200 bg-white p-2 sm:h-52 sm:w-52"
            />
            <p className="mt-3 break-all text-xs leading-5 text-slate-500">
              {PAGE_URL}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-amber-300">
        <Icon size={21} aria-hidden />
      </span>
      <h2 className="text-xl font-black text-slate-950 sm:text-2xl">{title}</h2>
    </div>
  );
}

function NoticeSection({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <SectionTitle icon={icon} title={title} />
      <div className="mt-4 space-y-4 text-base leading-7 text-slate-700">
        {children}
      </div>
    </section>
  );
}

function PrayerCard({
  index,
  title,
  body,
  icon: Icon,
}: {
  index: number;
  title: string;
  body: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <Icon size={19} aria-hidden />
        </span>
        <div>
          <p className="text-xs font-black text-amber-700">0{index}</p>
          <h3 className="font-bold text-slate-950">{title}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">{body}</p>
    </article>
  );
}

function InfoPanel({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <SectionTitle icon={icon} title={title} />
      <div className="mt-4">{children}</div>
    </section>
  );
}
