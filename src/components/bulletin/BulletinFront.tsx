import Image from "next/image";
import type { Weekly } from "@/types/notice";
import type { BulletinMasterData } from "@/types/bulletin-master";
import { stripLeadingNumber } from "@/components/weekly/form/shared";
import { getLiturgicalDay } from "@/lib/liturgical/season";
import { formatLiturgyLabel } from "@/lib/liturgical/format";
import type { LiturgicalSeason } from "@/lib/liturgical/types";

// 1페이지 주일예배 표: 숫자만 입력해도 라벨에 따라 단위 자동 부여.
//   "성 시 교 독" → 98 → "98번"
//   "영광의 찬송" / "찬    송" / "결단의 찬송" → 408 → "408장"
// 사용자가 "98번"·"408장" 처럼 단위까지 직접 입력하면 그대로 둔다.
function formatWorshipContent(label: string, content: string): string {
  const trimmed = content.trim();
  if (!/^\d+$/.test(trimmed)) return content;
  if (label.includes("교독")) return `${trimmed}번`;
  if (label.includes("찬송")) return `${trimmed}장`;
  return content;
}

// "고백과 감사의 기도" 의 assignees 3 슬롯에 1부/2부/3부 prefix 자동 부여.
// 이미 "N부 " 로 시작하면 그대로 둔다.
function formatPrayerAssignees(label: string, assignees: string[]): string[] {
  if (label !== "고백과 감사의 기도") return assignees;
  if (assignees.length !== 3) return assignees;
  return assignees.map((a, i) => {
    const trimmed = a.trim();
    if (!trimmed) return a;
    if (/^\d+부\s/.test(trimmed)) return a;
    return `${i + 1}부 ${trimmed}`;
  });
}

/** 이미지 자리 플레이스홀더 (추후 실제 이미지로 교체) */
function ImageBox({
  label,
  className = "",
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center justify-center border-2 border-dashed border-red-400 bg-red-50 text-red-500 ${className}`}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        <line x1="0" y1="0" x2="100" y2="100" stroke="#f87171" strokeWidth="0.5" />
        <line x1="100" y1="0" x2="0" y2="100" stroke="#f87171" strokeWidth="0.5" />
      </svg>
      <span className="relative z-10 text-[10px] font-bold">{label}</span>
    </div>
  );
}

interface NewItem {
  title: string;
  items: string[];
}

interface MeetingRow {
  group: string;
  when: string;
  place: string;
}

interface NewMember {
  no: string;
  regNo: string;
  name: string;
  inviter: string;
  dept: string;
}

interface ServantGroup {
  role: string;
  names: string;
}

interface SupportSection {
  heading: string;
  lines: string[];
}

interface WorshipSubRow {
  content: string;
  assignee: string;
}

interface WorshipItem {
  marker?: "※" | string;
  label: string;
  content?: string;
  assignees?: string | string[];
  subRows?: WorshipSubRow[];
  emphasize?: boolean;
}

export interface FrontData {
  volume: string;
  issue: string;
  dateStr: string;
  /** "사순 4주" / "성탄절" / "평주일" 등 — 주보 발행일(weekly.date) 기반 자동 계산 */
  liturgyLabel: string;
  /** CSS data-season 변수 분기용 절기 키 */
  liturgySeason: LiturgicalSeason;
  vision: { text: string; ref: string; emphasis?: boolean }[];
  topicOfYear: string;
  sundayTimes: string;
  address: string;
  phone: string;
  website: string;
  news: NewItem[];
  meetings: MeetingRow[];
  northKoreaNote: string;
  bibleReading: string;
  newMembers: NewMember[];
  mealDutyNote: string;
  volunteerNote: string;
  servants: ServantGroup[];
  supports: SupportSection[];
  worship: {
    leader: string;
    items: WorshipItem[];
    memorizeVerse: { ref: string; text: string };
  };
  toggles: {
    meetings: boolean;
    bibleReading: boolean;
    newMembers: boolean;
    mealDuty: boolean;
    volunteerNote: boolean;
  };
}

const DEFAULT: FrontData = {
  volume: "47",
  issue: "16",
  dateStr: "2026년 4월 19일",
  liturgyLabel: "평주일",
  liturgySeason: "ordinary_after_pentecost",
  vision: [
    { text: "예배는 Life! 생명이다.", ref: "(요 4:23-24)" },
    { text: "제자는 Training! 훈련이다.", ref: "(골 1:28-29)", emphasis: true },
    { text: "청년은 Hope! 희망이다.", ref: "(시 110:3)" },
    { text: "자녀는 Future! 미래다.", ref: "(사 54:13)" },
    { text: "선교는 Command! 명령이다.", ref: "(마 28:18-20)" },
  ],
  topicOfYear: "복음의 열매",
  sundayTimes: "1부 오전 8시 / 2부 오전 10시 / 3부 낮 12시",
  address: "서울특별시 동작구 사당로 16바길 9",
  phone: "02) 534-0691",
  website: "msvch.vercel.app",
  news: [
    {
      title: "1. 2026 새생명 마을축제",
      items: [
        "* 부활절 새생명 초청은 4월까지 계속 진행하며, 교회 방문하신 VIP께 선물을 드리고 있습니다.",
        "* 첫방문시 핸드워시, 재방문시 커피쿠폰, 등록하시면 등록자 선물이 있습니다.",
        "* 교회 새가족을 위한 환영파티 : 5/9(토) 오후 5시 (교회식당)",
      ],
    },
    {
      title: "2. 2026 봄맞이 사랑나눔 바자회",
      items: [
        "* 일시 : 4/25(토) 오전11시~오후3시 / 바자회를 위한 물품 기증(4/24,금요일까지)",
        "* 품목 : 의류, 유아용품, 생활 가전, 운동용품, 등산용품 등 (전도부실)",
        "* 준비모임 : 오늘(4/19) 3부 예배 직후 본당(남·여 선교회 회장단 전원)",
      ],
    },
    {
      title: "3. 제53회 서울남노회 어린이대회",
      items: ["* 4/25(토) 과천교회   * 종목 : 동화구연, 글짓기, 그리기, 워십"],
    },
    {
      title: "4. 3부 경배와 찬양팀 찬양단원 모집",
      items: [
        "* 지원 자격 : 세례교인 이상으로 찬양 사역에 관심 있으신 분",
        "* 모집 분야 : 싱어, 드럼, 그 외 악기 연주 가능한 분 (청년/장년 모두 환영)",
        "* 문의 및 신청 : 김 철 안집(010-2641-7258)",
      ],
    },
    {
      title: "5. 미디어 선교부 소식",
      items: [
        "* 교회 인터넷 홈페이지 개편, 교회 네이버 블로그 및 인스타그램 신설",
        "* 교회학교별 인스타그램 운영중(영유치부는 네이버 밴드)",
      ],
    },
    {
      title: "6. 2026 봄 심방 신청 안내",
      items: [
        "* 3월~5월 동안 봄 심방을 받기 원하시는 가정이나 목장은 교회사무실로 신청 바랍니다.",
      ],
    },
    {
      title: "7. 서울남노회 제2회 중·고등부 연합회 월례회",
      items: ["* 오늘(4/19) 오후5:00, 본교회 교육관3층 갈릴리실"],
    },
    {
      title: "8. 노방전도 안내",
      items: [
        "* 매주(토) 오전11시/오후2시   * 오늘 오후찬양예배시 플랫폼전도법(큐알코드이용) 소개",
      ],
    },
    {
      title: "9. 모임",
      items: [],
    },
  ],
  meetings: [
    { group: "3여선", when: "4/26(주일) 오후1:40", place: "새가족실" },
    { group: "4여선", when: "4/26(주일) 오후1:40", place: "식당" },
    { group: "5여선", when: "4/26(주일) 오후1:40", place: "식당" },
    { group: "6여선", when: "4/26(주일) 오전11:15", place: "영유치부 안쪽방" },
    { group: "2남선", when: "4/26(주일) 오후2:00", place: "탁구장" },
    { group: "4남선", when: "매월셋째주", place: "3부예배후 모여서 이동" },
  ],
  northKoreaNote: "* 북한선교부 : 오늘(매 월 셋 째 주) 2부예배후 1층 사무실 안쪽",
  bibleReading: "* 6독 - 조성희,  10독 - 장정자",
  newMembers: [
    { no: "20", regNo: "26-16", name: "유연준", inviter: "송홍점", dept: "2여선" },
    { no: "21", regNo: "26-17", name: "윤홍기", inviter: "임한석 박경란", dept: "1남선" },
  ],
  mealDutyNote: "* 이번 주는 16목장에서 담당합니다. 협력해 주신 모든 분들께도 감사드립니다.",
  volunteerNote: "* 지난주 사랑의 이·미용 봉사를 통해 모두 열 분을 섬겼습니다.",
  servants: [
    { role: "담 임 목 사", names: "이양재" },
    { role: "전 임 전 도 사", names: "이준영  최희성" },
    { role: "준 전 임 목 사", names: "우 영" },
    { role: "교      육", names: "임한나 전도사  박가람 교육사" },
    { role: "시 무 장 로", names: "강종수  장 율  상성규  임한석  김재락" },
    { role: "원 로 장 로", names: "이권원" },
    { role: "은 퇴 장 로", names: "심상익  정관모" },
    { role: "지      휘", names: "노일권  최석환" },
    { role: "반      주", names: "유세인  이하나\n김소영  정민지  강현진" },
  ],
  supports: [
    {
      heading: "<해외선교지>",
      lines: [
        "명노봉(C국) / 공베드로·이선아(한국OMF)",
        "김동주·문희영(대만) / 심미령(필리핀)",
        "황명하·이소윤(케냐) / 양성호·김성경(영국)",
        "윤재남·김미경(인도네시아) / 아프리카선교회",
        "박솔잎·김초롱(태국) / 이성훈·유임순(일본)",
      ],
    },
    {
      heading: "<국내선교지>",
      lines: [
        "비봉교회 / 창매교회 / 율곡교회(군부대)",
        "소랑도교회 / 도초제일교회",
      ],
    },
    {
      heading: "<방송·문화·학원>",
      lines: [
        "기독교방송 C채널 / 가정교회마을연구소",
        "유학생다문화 ABC사역",
      ],
    },
  ],
  worship: {
    leader: "1부 - 이준영 전도사    2·3부 : 이양재 목사",
    items: [
      { marker: "※", label: "예배의 부름", content: '"하나님은 영이시니 예배하는 자가 영과 진리로 예배할지니라"(요4:24)', assignees: "인 도 자" },
      { marker: "※", label: "영광의 찬송", content: "주기도문 찬양", assignees: "다 함 께" },
      { marker: "※", label: "기    원", content: "", assignees: "인 도 자" },
      { marker: "※", label: "감사와 참회의 기도", content: "", assignees: "다 함 께" },
      { marker: "※", label: "신 앙 고 백", content: "사도신경", assignees: "다 함 께" },
      { marker: "※", label: "성 시 교 독", content: "8번", assignees: "다 함 께" },
      { label: "찬    송", content: "39장", assignees: "다 함 께" },
      { label: "고백과 감사의 기도", content: "대표기도", assignees: ["1부 문영애 권사", "2부 이기석 집사", "3부 강종수 장로"] },
      { marker: "※", label: "봉헌 및 기도", content: "(* 헌금은 입구 헌금함에 드리시기 바랍니다)", assignees: "다 함 께" },
      { marker: "※", label: "성 경 봉 독", content: "요 16:31 - 33", assignees: "다 함 께" },
      {
        label: "찬    양",
        subRows: [
          { content: "1부 : 주 예수 나의 산 소망", assignee: "호산나 찬양대" },
          { content: "2부 : 어저께나 오늘이나", assignee: "그레이스 찬양대" },
        ],
      },
      { label: "말    씀", content: '"세상에서 그리스도인으로 잘 사는 법"', assignees: "이양재 목사", emphasize: true },
      { label: "결단의 찬송", content: "342장", assignees: "다 함 께" },
      { label: "교 회 소 식", content: "", assignees: "인 도 자" },
      { label: "성도의 교제", content: "", assignees: "다 함 께" },
      { marker: "※", label: "송    영", content: "여기에 모인 우리", assignees: "다 함 께" },
      { marker: "※", label: "축    도", content: "", assignees: "이양재 목사" },
    ],
    memorizeVerse: {
      ref: "요16:33",
      text: "이것을 너희에게 이르는 것은 너희로 내 안에서 평안을 누리게 하려 함이라 세상에서는 너희가 환난을 당하나 담대하라 내가 세상을 이기었노라",
    },
  },
  toggles: {
    meetings: true,
    bibleReading: true,
    newMembers: true,
    mealDuty: true,
    volunteerNote: true,
  },
};

export function weeklyToFrontData(
  w: Weekly,
  master?: BulletinMasterData,
  overrides?: Partial<FrontData>,
): FrontData {
  const data: FrontData = { ...DEFAULT };
  if (w.volume) data.volume = String(w.volume);
  if (w.issue) data.issue = String(w.issue);
  if (w.date) {
    const d = new Date(w.date + "T00:00:00");
    data.dateStr = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    // 주보 발행일 기준 절기 계산 (KST). w.date 는 YYYY-MM-DD.
    const ref = new Date(w.date + "T00:00:00+09:00");
    const day = getLiturgicalDay(ref);
    data.liturgyLabel = formatLiturgyLabel(day);
    data.liturgySeason = day.season;
  }

  // ── 마스터 데이터 (live reference)
  if (master) {
    if (master.topicOfYear) data.topicOfYear = master.topicOfYear;
    if (master.servants.length > 0) data.servants = master.servants;
    if (master.supports.length > 0) data.supports = master.supports;
  }

  // ── 매주 변하는 데이터 (weeklies row)
  if (w.news && w.news.length > 0) data.news = w.news.map((n) => ({ title: n.title, items: n.items }));
  if (w.meetings && w.meetings.length > 0) data.meetings = w.meetings;
  if (w.north_korea_note) data.northKoreaNote = w.north_korea_note;
  if (w.bible_reading) data.bibleReading = w.bible_reading;
  if (w.new_members && w.new_members.length > 0) data.newMembers = w.new_members;
  if (w.meal_duty_note) data.mealDutyNote = w.meal_duty_note;
  if (w.volunteer_note) data.volunteerNote = w.volunteer_note;
  if (w.front_toggles) {
    data.toggles = {
      meetings: w.front_toggles.meetings ?? true,
      bibleReading: w.front_toggles.bibleReading ?? true,
      newMembers: w.front_toggles.newMembers ?? true,
      mealDuty: w.front_toggles.mealDuty ?? true,
      volunteerNote: w.front_toggles.volunteerNote ?? true,
    };
  }
  if (w.worship_leader) data.worship = { ...data.worship, leader: w.worship_leader };
  if (w.worship_items && w.worship_items.length > 0) {
    data.worship = {
      ...data.worship,
      items: w.worship_items.map((it) => ({
        marker: it.marker,
        label: it.label,
        content: it.content,
        assignees: it.assignees,
        subRows: it.subRows,
        emphasize: it.emphasize,
      })),
    };
  }
  if (w.memorize_verse && (w.memorize_verse.ref || w.memorize_verse.text)) {
    data.worship = { ...data.worship, memorizeVerse: w.memorize_verse };
  }

  return { ...data, ...(overrides ?? {}) };
}

// ⚠️ LAYOUT LOCKED — 이 컴포넌트의 레이아웃·스타일·구조를 임의로 변경하지 말 것.
// DB 연동 시 데이터만 교체하고 렌더링 코드는 건드리지 않는다.
// 예외: 페이지 상단 2mm 절기색 띠와 masthead 의 절기 칩 1개는 추가 허용 (절기색 시스템).
// 그 외 레이아웃·구조 변경은 여전히 금지.
// slice 상한선은 레이아웃 고정을 위한 안전망이므로 제거하지 말 것.
/** 페이지 4: 앞면 좌측 — 교회소식 + 섬기는 분들 / 후원하는 분들 */
export function BulletinFrontLeft({ data }: { data: FrontData }) {
  const newsCount = data.news.slice(0, 20).length;
  // 토글된 섹션의 번호를 동적으로 계산.
  let counter = newsCount;
  const meetingsNum = data.toggles.meetings ? ++counter : null;
  const bibleNum = data.toggles.bibleReading ? ++counter : null;
  const newMembersNum = data.toggles.newMembers ? ++counter : null;
  const mealDutyNum = data.toggles.mealDuty ? ++counter : null;
  return (
    <div className="space-y-1">
      <section>
        <div className="flex items-baseline justify-between border-b-2 border-liturgy mb-1">
          <h3 className="text-sm font-bold">교회소식</h3>
          <div className="text-[9px] text-gray-600 leading-tight text-right">
            저희 교회를 찾아 주신 모든 분들을 진심으로 사랑하고 환영합니다.
            <br />
            등록을 원하시면 등록카드를 작성하여 주시기 바랍니다.
          </div>
        </div>

        {/* 교회소식 — 번호 자동 생성. 이후 통독/새가족/식당봉사도 cascade */}
        <div className="space-y-0.5 text-[10px]" style={{ lineHeight: "1.15" }}>
          {data.news.slice(0, 20).map((n, i) => (
            <div key={i}>
              <div className="font-bold">{i + 1}. {stripLeadingNumber(n.title)}</div>
              {n.items.length > 0 && (
                <div className="pl-2">
                  {n.items.map((it, j) => (
                    <div key={j}>{it}</div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* 모임: 번호.모임 타이틀 + 표 (토글 OFF 시 섹션 통째 제거) */}
          {meetingsNum !== null && (
          <div>
            <div className="font-bold">{meetingsNum}. 모임</div>
            <div className="pl-2">
              <table className="w-full border border-gray-400 border-collapse text-[10px]">
                <tbody>
                  {pairRows(data.meetings.slice(0, 6)).map((pair, i) => (
                    <tr key={i} className="border-b border-gray-300 last:border-b-0">
                      <td className="border-r border-gray-300 px-1 py-0 font-bold w-12">
                        {pair[0]?.group ?? ""}
                      </td>
                      <td className="border-r border-gray-300 px-1 py-0">
                        {pair[0] ? `${pair[0].when}  ${pair[0].place}` : ""}
                      </td>
                      <td className="border-r border-gray-300 px-1 py-0 font-bold w-12">
                        {pair[1]?.group ?? ""}
                      </td>
                      <td className="px-1 py-0">
                        {pair[1] ? `${pair[1].when}  ${pair[1].place}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-0.5">{data.northKoreaNote}</div>
            </div>
          </div>
          )}

          {bibleNum !== null && (
            <div>
              <div className="font-bold">{bibleNum}. 2026년 성경 통독 현황</div>
              <div className="pl-2">{data.bibleReading}</div>
            </div>
          )}

          {newMembersNum !== null && (() => {
            const members = data.newMembers.slice(0, 4);
            // 1명이면 5열 한 줄 표만 렌더 (오른쪽 빈 칸 숨김).
            // 2명 이상이면 기존 5+5 페어 레이아웃, 마지막 행 pair[1] 비면 colSpan=5 무테두리로.
            const singleRow = members.length === 1;
            return (
              <div>
                <div className="font-bold">{newMembersNum}. 지난 주일 등록 새가족</div>
                <div className="pl-2">
                  <table className="w-full border border-gray-400 border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-1 py-0 font-semibold">번호</th>
                        <th className="border border-gray-300 px-1 py-0 font-semibold">등 록</th>
                        <th className="border border-gray-300 px-1 py-0 font-semibold">새가족</th>
                        <th className="border border-gray-300 px-1 py-0 font-semibold">인도자</th>
                        <th className="border border-gray-300 px-1 py-0 font-semibold">선교회</th>
                        {!singleRow && (
                          <>
                            <th className="border border-gray-300 px-1 py-0 font-semibold">번호</th>
                            <th className="border border-gray-300 px-1 py-0 font-semibold">등 록</th>
                            <th className="border border-gray-300 px-1 py-0 font-semibold">새가족</th>
                            <th className="border border-gray-300 px-1 py-0 font-semibold">인도자</th>
                            <th className="border border-gray-300 px-1 py-0 font-semibold">선교회</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {newMemberRows(members).map((pair, i) => (
                        <tr key={i} className="text-center">
                          <td className="border border-gray-300 px-1 py-0">{pair[0]?.no ?? ""}</td>
                          <td className="border border-gray-300 px-1 py-0">{pair[0]?.regNo ?? ""}</td>
                          <td className="border border-gray-300 px-1 py-0">{pair[0]?.name ?? ""}</td>
                          <td className="border border-gray-300 px-1 py-0">{pair[0]?.inviter ?? ""}</td>
                          <td className="border border-gray-300 px-1 py-0">{pair[0]?.dept ?? ""}</td>
                          {!singleRow && (
                            pair[1] ? (
                              <>
                                <td className="border border-gray-300 px-1 py-0">{pair[1].no}</td>
                                <td className="border border-gray-300 px-1 py-0">{pair[1].regNo}</td>
                                <td className="border border-gray-300 px-1 py-0">{pair[1].name}</td>
                                <td className="border border-gray-300 px-1 py-0">{pair[1].inviter}</td>
                                <td className="border border-gray-300 px-1 py-0">{pair[1].dept}</td>
                              </>
                            ) : (
                              <td colSpan={5} className="px-1 py-0" />
                            )
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {mealDutyNum !== null && (
            <div>
              <div className="font-bold">{mealDutyNum}. 식당 봉사</div>
              <div className="pl-2">{data.mealDutyNote}</div>
            </div>
          )}

          {data.toggles.volunteerNote && (
            <div>
              <div className="font-bold">※ 봉사센터 소식</div>
              <div className="pl-2">{data.volunteerNote}</div>
            </div>
          )}
        </div>
      </section>

      {/* 섬기는 분들 / 우리가 후원하는 분들 */}
      <section className="grid grid-cols-2 gap-2 border-t-2 border-gray-400 pt-1">
        <div>
          <div className="bg-gray-200 font-bold text-xs py-0.5 text-center">
            섬기는 분들
          </div>
          <table className="w-full text-[10px] border-collapse mt-1" style={{ zoom: 0.9 }}>
            <tbody>
              {data.servants.slice(0, 9).map((s, i) => (
                <tr key={i} className="border-b border-gray-200 last:border-b-0">
                  <td className="py-0.5 px-2 font-semibold w-24 align-top whitespace-nowrap" style={{ textAlign: "justify", textAlignLast: "justify", textJustify: "inter-character" }}>
                    {s.role}
                  </td>
                  <td className="py-0.5 whitespace-pre-line">{s.names}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="bg-gray-200 font-bold text-xs py-0.5 text-center">
            우리가 후원하는 분들
          </div>
          <div className="text-[10px] mt-1 space-y-1" style={{ zoom: 0.9 }}>
            {data.supports.slice(0, 3).map((s, i) => (
              <div key={i}>
                <div className="font-bold">{s.heading}</div>
                <div>
                  {s.lines.map((line, j) => (
                    <div key={j}>{line}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

// ⚠️ LAYOUT LOCKED — 이 컴포넌트의 레이아웃·스타일·구조를 임의로 변경하지 말 것.
// DB 연동 시 데이터만 교체하고 렌더링 코드는 건드리지 않는다.
// 예외: 페이지 상단 2mm 절기색 띠와 masthead 의 절기 칩 1개는 추가 허용 (절기색 시스템).
// 그 외 레이아웃·구조 변경은 여전히 금지.
/** 페이지 1: 앞면 우측 — 5대 비전 + 제호 + 주일예배 + 금주 암송말씀 */
export function BulletinFrontRight({ data }: { data: FrontData }) {
  return (
    <div>
      {/* 상단: 좌측 (5대 비전 + 표어) + 우측 제호 */}
      <div className="grid grid-cols-[1fr_auto] gap-3 mb-1 items-stretch">
        {/* 5대 비전 + 복음의 열매 */}
        <div className="flex flex-col justify-between">
          <div className="px-2 py-1 text-[10px]">
            <div className="font-bold text-blue-900 text-xs mb-0.5">우리 교회 5대 비전</div>
            <div className="space-y-0">
              {data.vision.map((v, i) => (
                <div key={i} className={v.emphasis ? "font-bold text-red-700" : ""}>
                  {v.text} <span className="text-gray-600">{v.ref}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-baseline gap-2 px-2">
            <span className="text-base font-bold italic">
              <span className="text-red-700">복음</span>
              <span className="text-gray-900">의</span>
              <span className="text-purple-700"> 열매</span>
            </span>
            <span className="text-[10px] text-gray-600">(2026년 표어)</span>
          </div>
        </div>

        {/* 제호 영역 */}
        <div className="text-right flex flex-col">
          <div className="text-[11px] font-bold mb-1 flex items-center justify-end gap-2">
            <span>{data.volume}권 {data.issue}호 &nbsp;/&nbsp; {data.dateStr}</span>
            <span
              className="rounded-sm px-1.5 py-0.5 text-[9px] font-semibold"
              style={{
                background: "var(--liturgy-soft)",
                color: "var(--liturgy-strong)",
              }}
            >
              {data.liturgyLabel}
            </span>
          </div>
          <div className="flex justify-end mb-1">
            <Image
              src="/logo.png"
              alt="명성비전교회"
              width={260}
              height={80}
              className="h-14 w-auto"
              priority
              unoptimized
            />
          </div>
          <div className="flex items-start justify-end gap-2">
            <div className="text-[10px] text-gray-700 text-right">
              {data.address}
              <br />
              Tel. {data.phone}
              <br />
              {data.website}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/qr-links.svg"
              alt="명성비전교회 링크 QR"
              className="shrink-0"
              style={{ width: "12mm", height: "12mm" }}
            />
          </div>
        </div>
      </div>

      {/* 주일예배 */}
      <section>
        <div className="flex items-baseline justify-between border-b-2 border-liturgy mb-1">
          <h3 className="text-sm font-bold">주일예배</h3>
          <span className="text-[10px] font-bold">{data.sundayTimes}</span>
        </div>
        <div className="text-[10px] text-gray-700 text-right mb-1">
          인도 : {data.worship.leader}
        </div>

        <div className="flex gap-1 items-stretch">
          <div className="flex-1">
            <table className="w-full text-[10px] border-collapse [&_td]:py-[5.5px]">
              <tbody>
                {data.worship.items.map((it, i) => {
                  if (it.subRows && it.subRows.length > 0) {
                    return it.subRows.map((sr, j) => (
                      <tr key={`${i}-${j}`} className="align-middle">
                        {j === 0 && (
                          <td
                            rowSpan={it.subRows!.length}
                            className="px-1 w-6 text-center font-bold"
                          >
                            {it.marker ?? ""}
                          </td>
                        )}
                        {j === 0 && (
                          <td
                            rowSpan={it.subRows!.length}
                            className="px-1 w-20 font-semibold whitespace-nowrap"
                            style={{ textAlign: "justify", textAlignLast: "justify", textJustify: "inter-character" }}
                          >
                            {it.label}
                          </td>
                        )}
                        <td className="px-1">
                          <DottedLeaderCell content={sr.content} />
                        </td>
                        <td className="px-1 w-16 whitespace-nowrap" style={{ textAlign: "justify", textAlignLast: "justify", textJustify: "inter-character" }}>
                          {sr.assignee}
                        </td>
                      </tr>
                    ));
                  }
                  const rawAssignees = Array.isArray(it.assignees)
                    ? it.assignees
                    : it.assignees
                      ? [it.assignees]
                      : [""];
                  const assignees = formatPrayerAssignees(it.label, rawAssignees);
                  return (
                    <tr key={i} className="align-middle">
                      <td className="px-1 w-6 text-center font-bold">
                        {it.marker ?? ""}
                      </td>
                      <td className="px-1 w-20 font-semibold whitespace-nowrap" style={{ textAlign: "justify", textAlignLast: "justify", textJustify: "inter-character" }}>
                        {it.label}
                      </td>
                      <td className="px-1">
                        <DottedLeaderCell
                          content={formatWorshipContent(it.label, it.content ?? "")}
                          bold={it.emphasize}
                        />
                      </td>
                      <td className="px-1 w-16 whitespace-nowrap">
                        {assignees.map((a, k) => (
                          <div key={k} style={{ textAlign: "justify", textAlignLast: "justify", textJustify: "inter-character" }}>{a}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div
            className="text-[10px] text-gray-700 flex items-center justify-center whitespace-nowrap"
            style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
          >
            * 3부는 경배와 찬양
          </div>
        </div>

        <div className="text-[9px] text-gray-600 text-right" style={{ marginTop: "1px" }}>
          ※ 표는 일어서 주시기 바랍니다
        </div>
      </section>

      {/* 금주 암송말씀 */}
      <section className="mt-2 border-t-2 border-gray-400 pt-1 text-[10px]">
        <div className="flex items-start gap-1">
          <span className="font-bold text-blue-900 shrink-0">◆ 금주 암송말씀 :</span>
          <span>
            {data.worship.memorizeVerse.text}
            <span className="ml-1 text-gray-500">({data.worship.memorizeVerse.ref})</span>
          </span>
        </div>
      </section>
    </div>
  );
}

export default function BulletinFront({ weekly }: { weekly: Weekly }) {
  const data = weeklyToFrontData(weekly);

  return (
    <div className="bulletin-front bg-white text-gray-800 text-[10px] leading-tight p-4">
      <div className="grid grid-cols-2 gap-4">
        <BulletinFrontLeft data={data} />
        <BulletinFrontRight data={data} />
      </div>
    </div>
  );
}

function DottedLeaderCell({
  content,
  bold = false,
}: {
  content: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <span className="flex-1 border-b border-dotted border-gray-500" />
      <span
        className={`px-1 text-center ${bold ? "font-bold text-[11px]" : ""}`}
      >
        {content}
      </span>
      <span className="flex-1 border-b border-dotted border-gray-500" />
    </div>
  );
}

function pairRows<T>(arr: T[]): [T | undefined, T | undefined][] {
  const half = Math.ceil(arr.length / 2);
  const out: [T | undefined, T | undefined][] = [];
  for (let i = 0; i < half; i++) out.push([arr[i], arr[i + half]]);
  return out;
}

function newMemberRows(arr: NewMember[]): [NewMember | undefined, NewMember | undefined][] {
  const half = Math.ceil(arr.length / 2);
  const out: [NewMember | undefined, NewMember | undefined][] = [];
  for (let i = 0; i < half; i++) out.push([arr[i], arr[i + half]]);
  return out;
}
