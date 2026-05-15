import type { Weekly } from "@/types/notice";
import type { BulletinMasterData } from "@/types/bulletin-master";
import {
  SPECIAL_OFFERING_INDEX,
  SPECIAL_OFFERING_DEFAULT_LABEL,
} from "@/components/weekly/form/constants";

export interface MokjangEntry {
  id: number;
  name: string;
  sub: string;
}

export interface OfferingCategory {
  label: string;
  names: string;
}

export interface BulletinBackData {
  afternoonService: {
    time?: string;
    leader?: string;
    contents: { label: string; value: string; subValue?: string; mergeNextValue?: boolean }[];
  };
  /** 주일오후 찬양예배 영역을 "목장모임"(이미지 + 제목)으로 대체할지 여부 */
  afternoonMokjangMode: boolean;
  wednesdayService: {
    time?: string;
    leader?: string;
    contents: { label: string; value: string; subValue?: string; mergeNextValue?: boolean }[];
  };
  nextWeekPrayer: string[];
  offeringCommittee: { part: string; names: string }[];
  guideCommittee: { part: string; indoor: string; outdoor: string }[];
  dawnReadings: { date: string; passage: string }[];
  prayerItems: string[];
  serviceSchedule: {
    label: string;
    time: string;
    place: string;
    rightLabel?: string;
    rightTime?: string;
    rightPlace?: string;
  }[];
  mokjangList: MokjangEntry[];
  offerings: OfferingCategory[];
  weekTotal?: string;
  cumulativeTotal?: string;
  accountNote?: string;
}

const DEFAULT_DATA: BulletinBackData = {
  afternoonService: {
    time: "오후 2시 30분",
    leader: "이양재 목사",
    contents: [
      { label: "찬양", value: "찬양팀" },
      { label: "기도", value: "신경숙 집사" },
      { label: "성경봉독", value: "고전 9:20-23" },
      { label: "말씀", value: '"플랫폼 전도법"', subValue: "/ 이준영 전도사" },
      { label: "찬송", value: "502장" },
      { label: "광고", value: "", mergeNextValue: true },
      { label: "축도", value: "/ 인도자" },
    ],
  },
  afternoonMokjangMode: false,
  wednesdayService: {
    time: "저녁 7시 30분",
    leader: "이양재 목사",
    contents: [
      { label: "성경봉독", value: "삼하 22:30-37" },
      { label: "말씀", value: '"세월 지나갈수록"' },
      { label: "특강", value: "/ 이양재 목사" },
      { label: "찬송", value: "384장" },
      { label: "광고", value: "", mergeNextValue: true },
      { label: "축도", value: "/ 인도자" },
    ],
  },
  nextWeekPrayer: ["1부 홍성란 권사", "2부 박광식 안집", "3부 곽정매 권사"],
  offeringCommittee: [
    { part: "1부", names: "김미경" },
    { part: "2부", names: "김은숙 이경자" },
    { part: "3부", names: "박경란 김성숙" },
  ],
  guideCommittee: [
    { part: "1부", indoor: "김선자", outdoor: "경현주" },
    { part: "2부", indoor: "장서연", outdoor: "김수인" },
    { part: "3부", indoor: "권순애", outdoor: "박영순" },
  ],
  dawnReadings: [
    { date: "4월 19일(주일)", passage: "주일은 쉽니다" },
    { date: "4월 20일(월)", passage: "왕상 7- 8장" },
    { date: "4월 21일(화)", passage: "왕상 9-11장" },
    { date: "4월 22일(수)", passage: "왕상 12-14장" },
    { date: "주의 말씀은 내 발에 등이요 내 길에 빛이니이다(시119:105)", passage: "" },
    { date: "4월 23일(목)", passage: "왕상 15-17장" },
    { date: "4월 24일(금)", passage: "왕상 18-20장" },
    { date: "4월 25일(토)", passage: "왕상 21-22장" },
  ],
  prayerItems: [
    "올해 복음의 열매를 풍성히 맺는 교회와 성도들 되게 하소서",
    "날마다 경건생활 습관(예배, 기도, 말씀, 독서) 운동을 통해 건강한 그리스도인들이 되게 하소서",
    "각 목장이 마음을 다하여 영혼을 돌보고 복음을 전하는 선교사역을 잘 감당하게 하소서",
    "다음 세대를 세우는 교회교육(영유아부·유년부·초등부·청년부)에 성령의 역사가 임하게 하소서",
    "모든 가정이 화목하며 신앙 안에서 자녀들이 바르게 성장하고 부모가 본이 되게 하소서",
    "국가와 민족, 위정자들을 위해 기도하며 이 땅에 공의와 평화가 세워지게 하소서",
    "담임목사님이 더욱 강건하고 은혜와 성령으로 충만하며 주어진 목회 사역을 잘 감당하게 하소서",
  ],
  serviceSchedule: [
    { label: "주일 1부", time: "오전 8시", place: "본 당", rightLabel: "영유치부", rightTime: "낮 12시", rightPlace: "본 관 1층" },
    { label: "주일 2부", time: "오전 10시", place: "본 당", rightLabel: "아동부", rightTime: "오전 10시", rightPlace: "교육관 2층" },
    { label: "주일 3부", time: "낮 12시", place: "본 당", rightLabel: "청소년부", rightTime: "낮 12시", rightPlace: "교육관 3층" },
    { label: "주일 오후", time: "오후 2시30분", place: "본 당", rightLabel: "청년부", rightTime: "매월 첫째 주일\n오후 2시 30분", rightPlace: "본 당" },
    { label: "금요기도회", time: "저녁 8시30분", place: "본 당", rightLabel: "수요예배", rightTime: "저녁 7시 30분", rightPlace: "본 당" },
    { label: "새벽기도회", time: "오전 6시 (토·주일 없음)", place: "" },
  ],
  mokjangList: [
    { id: 1,  name: "김철수", sub: "이영희" },
    { id: 2,  name: "박민준", sub: "최수진" },
    { id: 3,  name: "정재훈", sub: "강미란" },
    { id: 4,  name: "조현우", sub: "윤지혜" },
    { id: 5,  name: "장성호", sub: "임은정" },
    { id: 6,  name: "한상민", sub: "오미경" },
    { id: 7,  name: "서준혁", sub: "신예진" },
    { id: 8,  name: "권태영", sub: "황수연" },
    { id: 9,  name: "안동현", sub: "송지은" },
    { id: 10, name: "류승현", sub: "전미선" },
    { id: 11, name: "홍기범", sub: "고은주" },
    { id: 12, name: "문성준", sub: "양혜경" },
    { id: 13, name: "손민석", sub: "배정아" },
    { id: 14, name: "백승우", sub: "허윤정" },
    { id: 15, name: "남기홍", sub: "유소영" },
    { id: 16, name: "김도현", sub: "이채원" },
    { id: 17, name: "박준서", sub: "최다혜" },
    { id: 18, name: "정민호", sub: "강보람" },
    { id: 19, name: "조성진", sub: "윤아라" },
    { id: 20, name: "장태준", sub: "임수빈" },
    { id: 21, name: "한재원", sub: "오지현" },
    { id: 22, name: "서동훈", sub: "신혜원" },
    { id: 23, name: "권민재", sub: "황다은" },
    { id: 24, name: "안성진", sub: "송하나" },
    { id: 25, name: "류재호", sub: "전보미" },
    { id: 26, name: "홍승민", sub: "고지수" },
    { id: 27, name: "문태현", sub: "양은비" },
    { id: 28, name: "손정우", sub: "배수아" },
    { id: 29, name: "백민철", sub: "허소연" },
    { id: 30, name: "남준호", sub: "유민정" },
    { id: 31, name: "김영민", sub: "이정현" },
    { id: 32, name: "박재혁", sub: "최영주" },
    { id: 33, name: "정우진", sub: "강선희" },
    { id: 34, name: "조민규", sub: "윤지원" },
    { id: 35, name: "장현수", sub: "임나영" },
    { id: 36, name: "한민우", sub: "오하늘" },
    { id: 37, name: "서재원", sub: "신다영" },
    { id: 38, name: "권성혁", sub: "황미연" },
    { id: 39, name: "안재민", sub: "송은지" },
    { id: 40, name: "류민성", sub: "전수현" },
  ],
  offerings: [
    { label: "십 일 조", names: "김철수 이영희\n박민준 최수진" },
    { label: "감사헌금", names: "정재훈 강미란\n조현우 윤지혜\n장성호 임은정\n한상민 오미경\n서준혁 신예진" },
    { label: "생일감사", names: "권태영" },
    { label: "특별헌금", names: "안동현 송지은" },
    { label: "부활감사", names: "류승현" },
    { label: "장학헌금", names: "홍기범 고은주" },
    { label: "구제헌금", names: "문성준" },
    { label: "선교헌금", names: "손민석 배정아" },
    { label: "일천번제", names: "백승우" },
    { label: "주정헌금", names: "남기홍 유소영\n김도현 이채원\n박준서 최다혜\n정민호 강보람" },
    { label: "성전헌금", names: "조성진 윤아라\n장태준 임수빈" },
  ],
  weekTotal: "0원",
  cumulativeTotal: "0원",
  accountNote:
    '* 온라인헌금 - 농협 355-0068-1115-73 명성비전교회 / 필수: "이름 헌금종류" 예) "박야곱십일조"',
};

type ServiceContentRow = {
  label: string;
  value: string;
  subValue?: string;
  mergeNextValue?: boolean;
};

/** 라벨이 일치하는 행만 입력값으로 덮어쓴다. value/subValue 가 비어있으면 기본값을 유지한다. */
function patchServiceContents(
  base: ServiceContentRow[],
  patches: { label: string; value?: string | null; subValue?: string | null }[],
): ServiceContentRow[] {
  return base.map((row) => {
    const patch = patches.find((p) => p.label === row.label);
    if (!patch) return row;
    const next: ServiceContentRow = { ...row };
    if (patch.value) next.value = patch.value;
    if (patch.subValue) next.subValue = patch.subValue;
    return next;
  });
}

export function weeklyToBackData(
  w: Weekly,
  master?: BulletinMasterData,
  overrides?: Partial<BulletinBackData>,
): BulletinBackData {
  const data: BulletinBackData = { ...DEFAULT_DATA };

  // 기본 contents(찬양/기도/말씀/찬송/광고/축도 등)를 유지한 채
  // 사용자 입력만 라벨로 매칭해 해당 행의 value/subValue 만 부분 갱신한다.
  // 입력이 비어있으면 기본값을 그대로 둔다(실수로 행 자체가 사라지지 않도록).
  if (w.afternoon_service) {
    const a = w.afternoon_service;
    data.afternoonService = {
      ...data.afternoonService,
      contents: patchServiceContents(data.afternoonService.contents, [
        { label: "성경봉독", value: a.scripture },
        {
          label: "말씀",
          value: a.title,
          subValue: a.pastor ? `/ ${a.pastor}` : undefined,
        },
      ]),
    };
  }
  data.afternoonMokjangMode = !!w.afternoon_mokjang_mode;

  if (w.wednesday_service) {
    const ws = w.wednesday_service;
    data.wednesdayService = {
      ...data.wednesdayService,
      leader: ws.leader || data.wednesdayService.leader,
      contents: patchServiceContents(data.wednesdayService.contents, [
        { label: "성경봉독", value: ws.scripture },
        { label: "말씀", value: ws.title },
        { label: "특강", value: ws.pastor ? `/ ${ws.pastor}` : "" },
        { label: "찬송", value: ws.hymn },
        { label: "축도", value: ws.benediction ? `/ ${ws.benediction}` : "" },
      ]),
    };
  }

  if (w.dawn_readings && w.dawn_readings.length > 0) {
    // MAX 8 — pairRows 4행 고정. 초과 시 페이지 높이 붕괴
    data.dawnReadings = w.dawn_readings.slice(0, 8).map((d) => ({ date: d.date, passage: d.passage }));
  }

  // ── 교회공동체 기도제목: 마스터(live reference)에서만 가져옴
  if (master && master.communityPrayers.length > 0) {
    // MAX 7 — 초과 시 페이지 높이 붕괴
    data.prayerItems = master.communityPrayers.slice(0, 7);
  }

  if (w.offering_members) {
    const om = w.offering_members;
    data.offeringCommittee = [
      { part: "1부", names: om.p1 ?? "" },
      { part: "2부", names: om.p2 ?? "" },
      { part: "3부", names: om.p3 ?? "" },
    ];
  }

  // ── 안내위원: 매주 변경 — guide_committee 배열
  if (w.guide_committee && w.guide_committee.length > 0) {
    data.guideCommittee = w.guide_committee.slice(0, 3);
  }

  // ── 다음주기도: next_week_prayer 배열
  if (w.next_week_prayer && w.next_week_prayer.length > 0) {
    data.nextWeekPrayer = w.next_week_prayer.slice(0, 3);
  }

  // ── 목장: 마스터(live reference)
  if (master && master.mokjang.length > 0) {
    data.mokjangList = master.mokjang.slice(0, 40);
  }

  // ── 향기로운 예물: offerings (특별헌금 슬롯은 토글에 따라 라벨 치환 또는 행 제거)
  if (w.offerings && w.offerings.length > 0) {
    const so = w.special_offering ?? {
      enabled: false,
      label: SPECIAL_OFFERING_DEFAULT_LABEL,
    };
    data.offerings = w.offerings.slice(0, 11).flatMap((o, i) => {
      if (i !== SPECIAL_OFFERING_INDEX) return [o];
      if (!so.enabled) return [];
      return [{ ...o, label: so.label || SPECIAL_OFFERING_DEFAULT_LABEL }];
    });
  }
  if (w.week_total) data.weekTotal = w.week_total;
  if (w.cumulative_total) data.cumulativeTotal = w.cumulative_total;

  return { ...data, ...(overrides ?? {}) };
}

const TEXT_MAIN = "text-gray-800";

/**
 * 페이지 2: 뒷면 좌측 — 오후/수요예배 + 다음주기도 + 새벽예배 + 기도제목 + 예배모임안내
 *
 * ⚠️  LAYOUT LOCKED — A5 인쇄 규격 고정 (zoom 1.11 적용 시 148mm × 210mm)
 * 아래 항목을 절대 수정하지 마세요:
 *   - zoom / py / px / mb / gap / leading / text-* 등 모든 스타일 값
 *   - 섹션 구조 및 순서
 * DB 연동 시 weeklyToBackData() 매핑 함수만 수정하세요.
 * 각 섹션 최대 항목 수는 slice 주석으로 표시됨 — 초과 데이터는 무시됩니다.
 */
export function BulletinBackLeft({ data }: { data: BulletinBackData }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-1" style={{ zoom: 0.9 }}>
        {data.afternoonMokjangMode ? (
          <MokjangSection />
        ) : (
          <ServiceSection
            title="주일오후 찬양예배"
            time={data.afternoonService.time ?? ""}
            leader={data.afternoonService.leader ?? ""}
            contents={data.afternoonService.contents}
            compact
          />
        )}
        <ServiceSection
          title="수요예배"
          time={data.wednesdayService.time ?? ""}
          leader={data.wednesdayService.leader ?? ""}
          contents={data.wednesdayService.contents}
        />
      </div>

      <div className="border-t-2 border-b-2 border-gray-300 py-0.5 mb-1" style={{ zoom: 0.9 }}>
        <div className="bg-gray-200 text-center text-xs font-bold py-0.5 mb-1">
          다음 주 기도
        </div>
        <div className="grid grid-cols-3 text-center text-xs mb-1">
          {/* MAX 3 — 고정 3열 구조 */}
          {data.nextWeekPrayer.slice(0, 3).map((p, i) => (
            <div key={i} className="py-px">
              {p}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 items-stretch" style={{ zoom: 0.95 }}>
          <div className="flex flex-col">
            <div className="bg-gray-200 text-center text-xs font-bold py-0.5 mb-1">
              헌금위원
            </div>
            <table className="w-full h-full text-xs text-center border-collapse">
              <tbody>
                {/* MAX 3 — 1부/2부/3부 고정 */}
                {data.offeringCommittee.slice(0, 3).map((row, i) => (
                  <tr
                    key={i}
                    className={i < data.offeringCommittee.slice(0, 3).length - 1 ? "border-b border-gray-100" : ""}
                  >
                    <td className="py-px font-bold w-8">{row.part}</td>
                    <td className="py-px whitespace-pre-wrap">{row.names}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col">
            <div className="bg-gray-200 text-center text-xs font-bold py-0.5 mb-1">
              안내위원
            </div>
            <table className="w-full h-full text-xs text-center border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="py-px w-8"></th>
                  <th className="py-px">실내안내</th>
                  <th className="py-px">실외안내</th>
                </tr>
              </thead>
              <tbody>
                {/* MAX 3 — 1부/2부/3부 고정 */}
                {data.guideCommittee.slice(0, 3).map((row, i) => (
                  <tr
                    key={i}
                    className={i < data.guideCommittee.slice(0, 3).length - 1 ? "border-b border-gray-100" : ""}
                  >
                    <td className="py-px font-bold">{row.part}</td>
                    <td className="py-px">{row.indoor}</td>
                    <td className="py-px">{row.outdoor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="mb-1">
        <h3 className="text-sm font-bold border-b-2 border-liturgy mb-1">
          새벽 예배(신앙일기)
        </h3>
        <table className="w-full text-xs border-collapse table-fixed">
          <colgroup>
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
            <col style={{ width: "25%" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-300">
              <th className="py-0 text-center">날짜</th>
              <th className="py-0 text-center">본문</th>
              <th className="py-0 text-center">날짜</th>
              <th className="py-0 text-center">본문</th>
            </tr>
          </thead>
          <tbody>
            {/* MAX 8항목(4행) — 초과 시 섹션 높이 초과. weeklyToBackData에서 이미 제한됨 */}
            {pairRows(data.dawnReadings.slice(0, 8)).map((pair, i) => (
              <tr
                key={i}
                className={i < pairRows(data.dawnReadings.slice(0, 8)).length - 1 ? "border-b border-gray-100" : ""}
              >
                <td className="py-0">{pair[0]?.date ?? ""}</td>
                <td className="py-0">{pair[0]?.passage ?? ""}</td>
                {pair[1] && pair[1].passage === "" ? (
                  <td className="py-0 overflow-hidden" colSpan={2}>
                    <span style={{ display: "inline-block", whiteSpace: "nowrap", letterSpacing: "-0.07em", transform: "scaleX(0.88)", transformOrigin: "left" }}>
                      {pair[1].date}
                    </span>
                  </td>
                ) : (
                  <>
                    <td className="py-0">{pair[1]?.date ?? ""}</td>
                    <td className="py-0">{pair[1]?.passage ?? ""}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-1">
        <h3 className="text-sm font-bold border-b-2 border-liturgy mb-1">
          교회공동체 기도제목
        </h3>
        <ol className="leading-tight" style={{ fontSize: "11px" }}>
          {/* MAX 7 — 초과 시 섹션 높이 초과. weeklyToBackData에서 이미 제한됨 */}
          {data.prayerItems.slice(0, 7).map((p, i) => (
            <li key={i}>
              {i + 1}. {p}
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-1">
        <h3 className="text-sm font-bold border-b-2 border-liturgy mb-1">
          예배모임 안내
        </h3>
        <table className="w-full text-xs border-collapse" style={{ zoom: 0.95 }}>
          <tbody>
            {/* MAX 6 — 초과 시 섹션 높이 초과 */}
            {data.serviceSchedule.slice(0, 6).map((row, i) => (
              <tr
                key={i}
                className={i < data.serviceSchedule.length - 1 ? "border-b border-gray-200" : ""}
              >
                <td className="py-0 px-1 font-bold w-20" style={{ textAlign: "justify", textAlignLast: "justify", textJustify: "inter-character" }}>{row.label}</td>
                {!row.place ? (
                  <td className="py-0 text-center w-24" colSpan={2} style={{ whiteSpace: "nowrap" }}>{row.time}</td>
                ) : (
                  <>
                    <td className="py-0 text-center w-24" style={{ whiteSpace: "pre-line" }}>{row.time}</td>
                    <td className="py-0 text-center w-16">{row.place}</td>
                  </>
                )}
                {row.rightLabel !== undefined ? (
                  <>
                    <td className="py-0 px-1 font-bold w-16" style={{ textAlign: "justify", textAlignLast: "justify", textJustify: "inter-character" }}>{row.rightLabel}</td>
                    <td className="py-0 text-center" style={{ whiteSpace: "pre-line" }}>{row.rightTime ?? ""}</td>
                    <td className="py-0 text-center">{row.rightPlace ?? ""}</td>
                  </>
                ) : (
                  <td className="py-0" colSpan={3}></td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ⚠️ LAYOUT LOCKED — 이 컴포넌트의 레이아웃·스타일·구조를 임의로 변경하지 말 것.
// DB 연동 시 데이터만 교체하고 렌더링 코드는 건드리지 않는다.
// slice 상한선은 레이아웃 고정을 위한 안전망이므로 제거하지 말 것.
/** 페이지 3: 뒷면 우측 — 소그룹 목장 + 향기로운 예물 + 헌금 안내 */
export function BulletinBackRight({ data }: { data: BulletinBackData }) {
  return (
    <div>
      <section className="mb-4">
        <h3 className="text-sm font-bold border-b-2 border-liturgy mb-2">
          2026년도 소그룹 목장
        </h3>
        <div className="grid grid-cols-4 gap-x-2 text-[10px]" style={{ zoom: 0.95 }}>
          {[0, 1, 2, 3].map((col) => (
            <div key={col}>
              <MokjangHeader />
              {data.mokjangList.slice(0, 40).slice(col * 10, col * 10 + 10).map((m) => (
                <MokjangRow key={m.id} id={m.id} name={m.name} sub={m.sub} />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold border-b-2 border-liturgy mb-2">
          향기로운 예물
        </h3>
        <div className="space-y-0 text-[11px]" style={{ zoom: 1 }}>
          {data.offerings.slice(0, 11).map((o, i) => (
            <OfferingRow key={i} label={o.label} names={o.names} />
          ))}
        </div>
      </section>

      <div className="mt-4 border-2 border-gray-400 p-2 text-xs">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold">※ 새 성전을 위해 기도해 주시기 바랍니다.</span>
          <span>
            지난주 헌금 : {data.weekTotal} | 누계 : {data.cumulativeTotal}
          </span>
        </div>
        {data.accountNote && (
          <div className="text-[10px] text-right border-t pt-1">{data.accountNote}</div>
        )}
      </div>
    </div>
  );
}

export default function BulletinBack({ data }: { data: BulletinBackData }) {
  return (
    <div className={`bulletin-back bg-white ${TEXT_MAIN} text-[11px] leading-tight`}>
      <div className="grid grid-cols-2 gap-6 p-4">
        <BulletinBackLeft data={data} />
        <BulletinBackRight data={data} />
      </div>
    </div>
  );
}

function pairRows<T>(arr: T[]): [T | undefined, T | undefined][] {
  const rowCount = Math.ceil(arr.length / 2);
  const result: [T | undefined, T | undefined][] = [];
  for (let i = 0; i < rowCount; i++) {
    result.push([arr[i], arr[i + rowCount]]);
  }
  return result;
}

function ServiceSection({
  title,
  time,
  leader,
  contents,
  compact = false,
}: {
  title: string;
  time: string;
  leader: string;
  contents: { label: string; value: string; subValue?: string; mergeNextValue?: boolean }[];
  compact?: boolean;
}) {
  return (
    <div className="mb-1">
      <div className="border-b-2 border-liturgy mb-1">
        <span className="text-sm font-bold">{title}</span>
      </div>
      <div className="text-[10px] text-gray-600 mb-1">{time}&nbsp;/&nbsp;인도 : {leader}</div>
      <table className="w-full text-xs border-collapse" style={compact ? { zoom: 0.95 } : undefined}>
        <tbody>
          {contents.flatMap((row, i) => {
            const py = compact ? "py-0" : "py-0.5";
            const labelStyle = { textAlign: "justify" as const, textAlignLast: "justify" as const, textJustify: "inter-character" as const };
            if (i > 0 && contents[i - 1].mergeNextValue) {
              return [
                <tr key={i} className="border-b border-gray-100">
                  <td className={`${py} font-semibold w-12`} style={labelStyle}>{row.label}</td>
                </tr>,
              ];
            }
            if (row.mergeNextValue) {
              return [
                <tr key={i} className="border-b border-gray-100">
                  <td className={`${py} font-semibold w-12`} style={labelStyle}>{row.label}</td>
                  <td className={`${py} pl-2`} rowSpan={2}>{contents[i + 1]?.value ?? ""}</td>
                </tr>,
              ];
            }
            if (row.subValue) {
              return [
                <tr key={`${i}-a`} className="border-b border-gray-100">
                  <td rowSpan={2} className={`${py} font-semibold w-12 align-middle`} style={labelStyle}>{row.label}</td>
                  <td className={`${py} pl-2`}>{row.value}</td>
                </tr>,
                <tr key={`${i}-b`} className="border-b border-gray-100">
                  <td className={`${py} pl-2 text-gray-500`}>{row.subValue}</td>
                </tr>,
              ];
            }
            return [
              <tr key={i} className="border-b border-gray-100">
                <td className={`${py} font-semibold w-12`} style={labelStyle}>{row.label}</td>
                <td className={`${py} pl-2`}>{row.value}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function MokjangSection() {
  return (
    <div className="mb-1">
      <div className="border-b-2 border-liturgy mb-1">
        <span className="text-sm font-bold">주일오후 찬양예배</span>
      </div>
      <div className="flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mokjang.jpg" alt="목장모임" className="h-28 w-auto" />
        <p className="mt-1 text-center text-xs font-semibold text-gray-700">
          각 목장 모임으로 대체됩니다.
        </p>
      </div>
    </div>
  );
}

function MokjangHeader() {
  return (
    <div className="grid grid-cols-[1.5rem_1fr_1fr] border-b border-black font-bold">
      <div className="px-1 border-r border-gray-300 text-center" style={{ whiteSpace: "nowrap", letterSpacing: "-0.05em" }}>목장</div>
      <div className="px-1 border-r border-gray-300 text-center" style={{ whiteSpace: "nowrap", letterSpacing: "-0.05em" }}>목자</div>
      <div className="px-1 text-center" style={{ whiteSpace: "nowrap", letterSpacing: "-0.05em" }}>부목자</div>
    </div>
  );
}

function MokjangRow({ id, name, sub }: { id: number; name: string; sub: string }) {
  return (
    <div className="grid grid-cols-[1.5rem_1fr_1fr] py-0.5 border-b border-gray-100">
      <div className="px-1 border-r border-gray-200 text-center">{id}</div>
      <div className="px-1 border-r border-gray-200 text-center" style={{ whiteSpace: "nowrap", letterSpacing: "-0.05em" }}>{name}</div>
      <div className="px-1 text-gray-500 text-center" style={{ whiteSpace: "nowrap", letterSpacing: "-0.05em" }}>{sub}</div>
    </div>
  );
}

function OfferingRow({ label, names }: { label: string; names: string }) {
  return (
    <div className="flex border-b border-gray-200 py-0.5">
      <span className="w-16 font-bold text-blue-900 shrink-0">{label}</span>
      <span className="leading-tight whitespace-pre-wrap">{names}</span>
    </div>
  );
}
