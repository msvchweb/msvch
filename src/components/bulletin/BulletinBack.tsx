import type { Weekly } from "@/types/notice";

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
    contents: { label: string; value: string; subValue?: string }[];
  };
  wednesdayService: {
    time?: string;
    leader?: string;
    contents: { label: string; value: string; subValue?: string }[];
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
      { label: "광고", value: "" },
      { label: "축도", value: "/ 인도자" },
    ],
  },
  wednesdayService: {
    time: "저녁 7시 30분",
    leader: "이양재 목사",
    contents: [
      { label: "성경봉독", value: "삼하 22:30-37" },
      { label: "말씀", value: '"세월 지나갈수록"' },
      { label: "특강", value: "/ 이양재 목사" },
      { label: "찬송", value: "384장" },
      { label: "광고", value: "" },
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
    { label: "주일 1부", time: "오전 8시", place: "본 당", rightLabel: "영 유 아 부", rightTime: "낮 12시", rightPlace: "교육관 1층" },
    { label: "주일 2부", time: "오전 10시", place: "본 당", rightLabel: "유 년 부", rightTime: "오전 10시", rightPlace: "교육관 2층" },
    { label: "주일 3부", time: "낮 12시", place: "본 당", rightLabel: "초 등 부", rightTime: "오전 10시", rightPlace: "교육관 3층" },
    { label: "주일오후 찬양", time: "오후 2시30분", place: "본 당", rightLabel: "청 년 부", rightTime: "토요일 7시30분", rightPlace: "본 당" },
    { label: "금요기도회", time: "저녁 8시30분", place: "본 당" },
    { label: "새벽기도회", time: "오전 6시 (월~금,토) / 주일 7시30분", place: "" },
  ],
  mokjangList: Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    name: `목자${i + 1}`,
    sub: `부목자${i + 1}`,
  })),
  offerings: [
    { label: "십일조", names: "" },
    { label: "감사헌금", names: "" },
    { label: "생일감사", names: "" },
    { label: "특별헌금", names: "" },
    { label: "부활감사", names: "" },
    { label: "장학헌금", names: "" },
    { label: "구제헌금", names: "" },
    { label: "선교헌금", names: "" },
    { label: "일천번제", names: "" },
    { label: "주정헌금", names: "" },
    { label: "성전헌금", names: "" },
  ],
  weekTotal: "0원",
  cumulativeTotal: "0원",
  accountNote:
    '* 온라인헌금 - 농협 355-0068-1115-73 명성비전교회 / 필수: "이름 헌금종류" 예) "박야곱십일조"',
};

export function weeklyToBackData(w: Weekly, overrides?: Partial<BulletinBackData>): BulletinBackData {
  const data: BulletinBackData = { ...DEFAULT_DATA };

  if (w.afternoon_service) {
    const a = w.afternoon_service;
    const contents: { label: string; value: string; subValue?: string }[] = [];
    if (a.scripture) contents.push({ label: "성경봉독", value: a.scripture });
    if (a.title) contents.push({ label: "말씀", value: a.title });
    if (a.pastor) contents.push({ label: "설교", value: a.pastor });
    if (contents.length) data.afternoonService = { ...data.afternoonService, contents };
  }

  if (w.wednesday_service) {
    const ws = w.wednesday_service;
    const contents: { label: string; value: string; subValue?: string }[] = [];
    if (ws.scripture) contents.push({ label: "성경봉독", value: ws.scripture });
    if (ws.title) contents.push({ label: "말씀", value: ws.title });
    if (contents.length) data.wednesdayService = { ...data.wednesdayService, contents };
  }

  if (w.dawn_readings && w.dawn_readings.length > 0) {
    data.dawnReadings = w.dawn_readings.map((d) => ({ date: d.date, passage: d.passage }));
  }

  if (w.prayer_items && w.prayer_items.length > 0) {
    data.prayerItems = w.prayer_items.map((p) => p.text);
  }

  if (w.offering_members) {
    const om = w.offering_members;
    data.offeringCommittee = [
      { part: "1부", names: om.p1 ?? "" },
      { part: "2부", names: om.p2 ?? "" },
      { part: "3부", names: om.p3 ?? "" },
    ];
  }

  return { ...data, ...(overrides ?? {}) };
}

const TEXT_MAIN = "text-gray-800";

export default function BulletinBack({ data }: { data: BulletinBackData }) {
  return (
    <div className={`bulletin-back bg-white ${TEXT_MAIN} text-[11px] leading-tight`}>
      <div className="grid grid-cols-2 gap-6 p-4">
        {/* 좌측 컬럼 */}
        <div>
          <div className="grid grid-cols-2 gap-4 mb-1">
            <ServiceSection
              title="주일오후 찬양예배"
              time={data.afternoonService.time ?? ""}
              leader={data.afternoonService.leader ?? ""}
              contents={data.afternoonService.contents}
            />
            <ServiceSection
              title="수요예배"
              time={data.wednesdayService.time ?? ""}
              leader={data.wednesdayService.leader ?? ""}
              contents={data.wednesdayService.contents}
            />
          </div>

          <div className="border-t-2 border-b-2 border-gray-300 py-1 mb-2">
            <div className="bg-gray-200 text-center text-xs font-bold py-0.5 mb-1">
              다음 주 기도
            </div>
            <div className="grid grid-cols-3 text-center text-xs mb-2">
              {data.nextWeekPrayer.map((p, i) => (
                <div key={i} className="py-0.5">
                  {p}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 items-stretch">
              <div className="flex flex-col">
                <div className="bg-gray-200 text-center text-xs font-bold py-0.5 mb-1">
                  헌금위원
                </div>
                <table className="w-full h-full text-xs text-center border-collapse">
                  <tbody>
                    {data.offeringCommittee.map((row, i) => (
                      <tr
                        key={i}
                        className={i < data.offeringCommittee.length - 1 ? "border-b border-gray-100" : ""}
                      >
                        <td className="py-0.5 font-bold w-8">{row.part}</td>
                        <td className="py-0.5">{row.names}</td>
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
                      <th className="py-0.5 w-8"></th>
                      <th className="py-0.5">실내안내</th>
                      <th className="py-0.5">실외안내</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.guideCommittee.map((row, i) => (
                      <tr
                        key={i}
                        className={i < data.guideCommittee.length - 1 ? "border-b border-gray-100" : ""}
                      >
                        <td className="py-0.5 font-bold">{row.part}</td>
                        <td className="py-0.5">{row.indoor}</td>
                        <td className="py-0.5">{row.outdoor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <section className="mb-2">
            <h3 className="text-lg font-bold border-b-2 border-blue-800 mb-1">
              새벽 예배(신앙일기)
            </h3>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="py-0.5 text-left">날짜</th>
                  <th className="py-0.5 text-left">본문</th>
                  <th className="py-0.5 text-left">날짜</th>
                  <th className="py-0.5 text-left">본문</th>
                </tr>
              </thead>
              <tbody>
                {pairRows(data.dawnReadings).map((pair, i) => (
                  <tr
                    key={i}
                    className={i < pairRows(data.dawnReadings).length - 1 ? "border-b border-gray-100" : ""}
                  >
                    <td className="py-0.5">{pair[0]?.date ?? ""}</td>
                    <td className="py-0.5">{pair[0]?.passage ?? ""}</td>
                    <td className="py-0.5">{pair[1]?.date ?? ""}</td>
                    <td className="py-0.5">{pair[1]?.passage ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mb-2">
            <h3 className="text-lg font-bold border-b-2 border-blue-800 mb-1">
              교회공동체 기도제목
            </h3>
            <ol className="text-xs leading-relaxed">
              {data.prayerItems.map((p, i) => (
                <li key={i}>
                  {i + 1}. {p}
                </li>
              ))}
            </ol>
          </section>

          <section className="mb-2">
            <h3 className="text-lg font-bold border-b-2 border-blue-800 mb-1">
              예배모임 안내
            </h3>
            <table className="w-full text-xs border-collapse">
              <tbody>
                {data.serviceSchedule.map((row, i) => (
                  <tr
                    key={i}
                    className={i < data.serviceSchedule.length - 1 ? "border-b border-gray-200" : ""}
                  >
                    <td className="py-0.5 font-bold w-20">{row.label}</td>
                    <td className="py-0.5 w-24">{row.time}</td>
                    <td className="py-0.5 w-16">{row.place}</td>
                    {row.rightLabel !== undefined ? (
                      <>
                        <td className="py-0.5 font-bold w-16">{row.rightLabel}</td>
                        <td className="py-0.5">{row.rightTime ?? ""}</td>
                        <td className="py-0.5">{row.rightPlace ?? ""}</td>
                      </>
                    ) : (
                      <td className="py-0.5" colSpan={3}></td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* 우측 컬럼 */}
        <div>
          <section className="mb-4">
            <h3 className="text-xl font-bold border-b-2 border-blue-800 mb-2">
              2026년도 소그룹 목장
            </h3>
            <div className="grid grid-cols-4 gap-x-2 text-[10px]">
              <MokjangHeader />
              {data.mokjangList.map((m) => (
                <MokjangRow key={m.id} id={m.id} name={m.name} sub={m.sub} />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold border-b-2 border-blue-800 mb-2">
              향기로운 예물
            </h3>
            <div className="space-y-1.5 text-[11px]">
              {data.offerings.map((o, i) => (
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
}: {
  title: string;
  time: string;
  leader: string;
  contents: { label: string; value: string; subValue?: string }[];
}) {
  return (
    <div className="border border-gray-400 rounded">
      <div className="bg-blue-50 px-2 py-0.5 font-bold text-sm border-b border-gray-400 flex justify-between">
        <span>{title}</span>
      </div>
      <div className="px-2 py-1 text-xs flex justify-between border-b border-gray-200">
        <span>{time}</span>
        <span>인도 : {leader}</span>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {contents.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-b-0">
              <td className="px-2 py-0.5 font-semibold w-16 align-top">{row.label}</td>
              <td className="px-2 py-0.5">{row.value}</td>
              <td className="px-2 py-0.5 text-right text-gray-500">
                {row.subValue ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MokjangHeader() {
  return (
    <div className="contents font-bold">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="grid grid-cols-[1.5rem_1fr_1fr] border-b border-black"
        >
          <div className="px-1 border-r border-gray-300">목장</div>
          <div className="px-1 border-r border-gray-300">목자</div>
          <div className="px-1">부목자</div>
        </div>
      ))}
    </div>
  );
}

function MokjangRow({ id, name, sub }: { id: number; name: string; sub: string }) {
  return (
    <div className="grid grid-cols-[1.5rem_1fr_1fr] py-0.5 border-b border-gray-100">
      <div className="px-1 border-r border-gray-200">{id}</div>
      <div className="px-1 border-r border-gray-200">{name}</div>
      <div className="px-1 text-gray-500">{sub}</div>
    </div>
  );
}

function OfferingRow({ label, names }: { label: string; names: string }) {
  return (
    <div className="flex border-b border-gray-200 pb-1">
      <span className="w-16 font-bold text-blue-900 shrink-0">{label}</span>
      <span className="leading-relaxed whitespace-pre-line">{names}</span>
    </div>
  );
}
