import React from 'react';

// --- 스타일 상수 ---
const BORDER_COLOR = "border-gray-400";
const TEXT_MAIN = "text-gray-800";
const TITLE_BG = "bg-blue-50";

/**
 * 교회 주보 메인 컴포넌트
 */
const ChurchBulletin: React.FC = () => {
  return (
    <div className={`p-4 bg-white ${TEXT_MAIN} max-w-5xl mx-auto text-[11px] leading-tight`}>
      {/* 상단 2단 레이아웃 시작 */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* 왼쪽 컬럼 */}
        <div>
          {/* 주일오후 찬양예배 & 수요예배 */}
          <div className="grid grid-cols-2 gap-4 mb-1">
            <ServiceSection 
              title="주일오후 찬양예배" 
              time="오후 2시 30분" 
              leader="이양재 목사"
              contents={[
                { label: "찬양", value: "찬양팀" },
                { label: "기도", value: "신경숙 집사" },
                { label: "성경봉독", value: "고전 9:20-23" },
                { label: "말씀", value: '"플랫폼 전도법"', subValue: "/ 이준영 전도사" },
                { label: "찬송", value: "502장" },
                { label: "광고", value: "" },
                { label: "축도", value: "/ 인도자" },
              ]}
            />
            <ServiceSection 
              title="수요예배" 
              time="저녁 7시 30분" 
              leader="이양재 목사"
              contents={[
                { label: "성경봉독", value: "삼하 22:30-37" },
                { label: "말씀", value: '"세월 지나갈수록"' },
                { label: "특강", value: "/ 이양재 목사" },
                { label: "찬송", value: "384장" },
                { label: "광고", value: "" },
                { label: "축도", value: "/ 인도자" },
              ]}
            />
          </div>

          {/* 다음 주 기도 및 위원 */}
          <div className="border-t-2 border-b-2 border-gray-300 py-1 mb-2">
            <div className="bg-gray-200 text-center text-xs font-bold py-0.5 mb-1">다음 주 기도</div>
            <div className="grid grid-cols-3 text-center text-xs mb-2">
              <div className="py-0.5">1부 홍성란 권사</div>
              <div className="py-0.5">2부 박광식 안집</div>
              <div className="py-0.5">3부 곽정매 권사</div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-stretch">
              {/* 좌: 헌금위원 */}
              <div className="flex flex-col">
                <div className="bg-gray-200 text-center text-xs font-bold py-0.5 mb-1">헌금위원</div>
                <table className="w-full h-full text-xs text-center border-collapse">
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-0.5 font-bold w-8">1부</td>
                      <td className="py-0.5">김미경</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-0.5 font-bold">2부</td>
                      <td className="py-0.5">김은숙 이경자</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold">3부</td>
                      <td className="py-0.5">박경란 김성숙</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 우: 안내위원 */}
              <div className="flex flex-col">
                <div className="bg-gray-200 text-center text-xs font-bold py-0.5 mb-1">안내위원</div>
                <table className="w-full h-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="py-0.5 w-8"></th>
                      <th className="py-0.5">실내안내</th>
                      <th className="py-0.5">실외안내</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-0.5 font-bold">1부</td>
                      <td className="py-0.5">김선자</td>
                      <td className="py-0.5">경현주</td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-0.5 font-bold">2부</td>
                      <td className="py-0.5">장서연</td>
                      <td className="py-0.5">김수인</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold">3부</td>
                      <td className="py-0.5">권순애</td>
                      <td className="py-0.5">박영순</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 새벽 예배(신앙일기) */}
          <section className="mb-2">
            <h3 className="text-lg font-bold border-b-2 border-blue-800 mb-1">새벽 예배(신앙일기)</h3>
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
                <ScheduleRow d1="4월 19일(주일)" v1="주일은 쉽니다" d2="4월 23일(목)" v2="왕상 15-17장" />
                <ScheduleRow d1="4월 20일(월)" v1="왕상 7- 8장" d2="4월 24일(금)" v2="왕상 18-20장" />
                <ScheduleRow d1="4월 21일(화)" v1="왕상 9-11장" d2="4월 25일(토)" v2="왕상 21-22장" />
                <ScheduleRow d1="4월 22일(수)" v1="왕상 12-14장" isLast />
              </tbody>
            </table>
          </section>

          {/* 교회공동체 기도제목 */}
          <section className="mb-2">
            <h3 className="text-lg font-bold border-b-2 border-blue-800 mb-1">교회공동체 기도제목</h3>
            <ol className="text-xs leading-relaxed">
              <li>1. 올해 복음의 열매를 풍성히 맺는 교회와 성도들 되게 하소서</li>
              <li>2. 날마다 경건생활 습관(예배, 기도, 말씀, 독서) 운동을 통해 건강한 그리스도인들이 되게 하소서</li>
              <li>3. 각 목장이 마음을 다하여 영혼을 돌보고 복음을 전하는 선교사역을 잘 감당하게 하소서</li>
              <li>4. 다음 세대를 세우는 교회교육(영유아부·유년부·초등부·청년부)에 성령의 역사가 임하게 하소서</li>
              <li>5. 모든 가정이 화목하며 신앙 안에서 자녀들이 바르게 성장하고 부모가 본이 되게 하소서</li>
              <li>6. 국가와 민족, 위정자들을 위해 기도하며 이 땅에 공의와 평화가 세워지게 하소서</li>
              <li>7. 담임목사님이 더욱 강건하고 은혜와 성령으로 충만하며 주어진 목회 사역을 잘 감당하게 하소서</li>
            </ol>
          </section>

          {/* 예배모임 안내 */}
          <section className="mb-2">
            <h3 className="text-lg font-bold border-b-2 border-blue-800 mb-1">예배모임 안내</h3>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 font-bold w-20">주일 1부</td>
                  <td className="py-0.5 w-24">오전 8시</td>
                  <td className="py-0.5 w-16">본 당</td>
                  <td className="py-0.5 font-bold w-16">영 유 아 부</td>
                  <td className="py-0.5">낮 12시</td>
                  <td className="py-0.5">교육관 1층</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 font-bold">주일 2부</td>
                  <td className="py-0.5">오전 10시</td>
                  <td className="py-0.5">본 당</td>
                  <td className="py-0.5 font-bold">유 년 부</td>
                  <td className="py-0.5">오전 10시</td>
                  <td className="py-0.5">교육관 2층</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 font-bold">주일 3부</td>
                  <td className="py-0.5">낮 12시</td>
                  <td className="py-0.5">본 당</td>
                  <td className="py-0.5 font-bold">초 등 부</td>
                  <td className="py-0.5">오전 10시</td>
                  <td className="py-0.5">교육관 3층</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 font-bold">주일오후 찬양</td>
                  <td className="py-0.5">오후 2시30분</td>
                  <td className="py-0.5">본 당</td>
                  <td className="py-0.5 font-bold">청 년 부</td>
                  <td className="py-0.5">토요일 7시30분</td>
                  <td className="py-0.5">본 당</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="py-0.5 font-bold">금요기도회</td>
                  <td className="py-0.5">저녁 8시30분</td>
                  <td className="py-0.5">본 당</td>
                  <td className="py-0.5" colSpan={3}></td>
                </tr>
                <tr>
                  <td className="py-0.5 font-bold">새벽기도회</td>
                  <td className="py-0.5" colSpan={5}>오전 6시 (월~금,토) / 주일 7시30분</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>

        {/* 오른쪽 컬럼 */}
        <div>
          {/* 소그룹 목장 명단 */}
          <section className="mb-4">
            <h3 className="text-xl font-bold border-b-2 border-blue-800 mb-2">2026년도 소그룹 목장</h3>
            <div className="grid grid-cols-4 gap-x-2 text-[10px]">
              <MokjangHeader />
              {/* 1열 */}
              <MokjangRow id={1} name="안아경" sub="권복순" />
              <MokjangRow id={2} name="이윤제" sub="권명분" />
              <MokjangRow id={3} name="장영자" sub="김영순B" />
              <MokjangRow id={4} name="김수정" sub="박민지" />
              <MokjangRow id={5} name="이순옥" sub="정혜란" />
              <MokjangRow id={6} name="박은영" sub="송미경" />
              <MokjangRow id={7} name="최정숙" sub="한아름" />
              <MokjangRow id={8} name="윤서연" sub="배소영" />
              <MokjangRow id={9} name="강미영" sub="노지혜" />
              <MokjangRow id={10} name="허영자" sub="오경미" />

              {/* 2열 */}
              <MokjangRow id={11} name="김명선" sub="김정순" />
              <MokjangRow id={12} name="이영란" sub="전은실" />
              <MokjangRow id={13} name="박순자" sub="김옥란" />
              <MokjangRow id={14} name="정미숙" sub="서유진" />
              <MokjangRow id={15} name="최경희" sub="양수진" />
              <MokjangRow id={16} name="조은희" sub="임혜숙" />
              <MokjangRow id={17} name="한명숙" sub="백선영" />
              <MokjangRow id={18} name="송정희" sub="남궁미" />
              <MokjangRow id={19} name="권영숙" sub="고은영" />
              <MokjangRow id={20} name="배명자" sub="주미란" />

              {/* 3열 */}
              <MokjangRow id={21} name="김희선" sub="문경자" />
              <MokjangRow id={22} name="이숙희" sub="심영옥" />
              <MokjangRow id={23} name="박경란" sub="유지영" />
              <MokjangRow id={24} name="장혜숙" sub="홍미자" />
              <MokjangRow id={25} name="신영희" sub="차은경" />
              <MokjangRow id={26} name="오미영" sub="민현숙" />
              <MokjangRow id={27} name="문지영" sub="하수정" />
              <MokjangRow id={28} name="강순자" sub="조정란" />
              <MokjangRow id={29} name="임영자" sub="양미숙" />
              <MokjangRow id={30} name="전순옥" sub="구희영" />

              {/* 4열 */}
              <MokjangRow id={31} name="김영순" sub="나경희" />
              <MokjangRow id={32} name="이금자" sub="황미영" />
              <MokjangRow id={33} name="박명희" sub="표은숙" />
              <MokjangRow id={34} name="정경숙" sub="안혜란" />
              <MokjangRow id={35} name="최순영" sub="장미자" />
              <MokjangRow id={36} name="조미경" sub="류경옥" />
              <MokjangRow id={37} name="한영숙" sub="원미숙" />
              <MokjangRow id={38} name="송경자" sub="반정희" />
              <MokjangRow id={39} name="권혜숙" sub="도영자" />
              <MokjangRow id={40} name="배영희" sub="천경자" />
            </div>
          </section>

          {/* 향기로운 예물(헌금 명단) */}
          <section>
            <h3 className="text-xl font-bold border-b-2 border-blue-800 mb-2">향기로운 예물</h3>
            <div className="space-y-1.5 text-[11px]">
              <OfferingRow
                label="십일조"
                names={
                  "강인숙 권복순 김대기 김만수 김연자 김원식 김은경 김재락 김효진 문영애 문진혁 성양희 송미경 신영자 안순옥 양경자 오미숙 유정희 윤경순 이금자 이순영\n" +
                  "이영란 이정숙 이혜경 임영숙 장미자 전순애 정미경 정혜란 조은희 주경희 최순영 최은주 하선영 한명숙 홍미자 황영자"
                }
              />
              <OfferingRow
                label="감사헌금"
                names={
                  "강다은 강예은 구영숙 권말례 권영분 김나연 김민환 김은심 김정선 김정숙\n" +
                  "김혜영 나경자 남궁선 노미영 도영숙 류은경 문경희 민혜진 박경란 박순자\n" +
                  "배명자 백선영 서유진 성미란 송정희 심영옥 안혜란 양수진 오정민 유지영\n" +
                  "윤서연 이금순 임혜숙 장혜숙 전미경 정경미 조미란 주미란 차은경 천경자\n" +
                  "최경희 표은숙 하수정 한아름 허영자 홍은미 황미영 황수진 황정숙 황지원"
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <OfferingRow label="생일감사" names="김성숙 무명1" />
                <OfferingRow label="특별헌금" names="2여선교회(미화비)" />
              </div>
              <OfferingRow label="부활감사" names="" />
              <OfferingRow label="장학헌금" names="" />
              <OfferingRow label="구제헌금" names="" />
              <OfferingRow label="선교헌금" names="" />
              <OfferingRow label="일천번제" names="" />
              <OfferingRow
                label="주정헌금"
                names={
                  "강순자 고은영 권혜숙 김영순A 김영순B 김희선 남궁미 노지혜 도영자 류경옥\n" +
                  "문지영 민현숙 박경란 박명희 박야곱 반정희 배소영 백선영 변지영 서유진\n" +
                  "송경자 송미경 신혜정 심영옥 안혜란 양미숙 여금순 오경미 유지영 윤미경\n" +
                  "이영숙 이정순 임혜숙 장미자 전은실 정혜란 조정란 지영미 차은경 채영희"
                }
              />
              <OfferingRow
                label="성전헌금"
                names={
                  "강정희 권명분 김대기 김연자 김은경 김재락 문영애 박영숙 배영희 변지영\n" +
                  "성양희 송미경 신영자 안순옥 양경자 오미숙 유정희 윤경순 이금자 이순영"
                }
              />
            </div>
          </section>

          {/* 하단 통계 및 계좌 정보 */}
          <div className="mt-4 border-2 border-gray-400 p-2 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold">※ 새 성전을 위해 기도해 주시기 바랍니다.</span>
              <span>지난주 헌금 : 375,000원 | 누계 : 147,234,483원</span>
            </div>
            <div className="text-[10px] text-right border-t pt-1">
              * 온라인헌금 - 농협 355-0068-1115-73 명성비전교회 / 필수: "이름 헌금종류" 예) "박야곱십일조"
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// --- 서브 컴포넌트 (함수 단위로 쪼개어 유지보수성 향상) ---

/** 예배 순서 섹션 */
const ServiceSection = ({ title, time, leader, contents }: any) => (
  <div className="flex flex-col">
    <h2 className="text-sm font-extrabold border-b-2 border-black leading-tight">{title}</h2>
    <div className="flex justify-between text-[11px] py-0 border-b border-gray-300 mb-0.5">
      <span>{time}</span>
      <span>인도: {leader}</span>
    </div>
    <div className="text-xs leading-tight">
      {contents.map((item: any, idx: number) => (
        <div key={idx} className="flex justify-between py-px">
          <span className="font-bold w-12">{item.label}</span>
          <span className="flex-1 text-right">{item.value} <span className="text-gray-500">{item.subValue}</span></span>
        </div>
      ))}
    </div>
  </div>
);

/** 새벽예배 일정 행 */
const ScheduleRow = ({ d1, v1, d2, v2, isLast }: any) => (
  <tr className={`${isLast ? '' : 'border-b border-gray-100'}`}>
    <td className="py-0.5 pr-2 font-bold">{d1}</td>
    <td className="py-0.5 pr-4">{v1}</td>
    <td className="py-0.5 pr-2 font-bold">{d2}</td>
    <td className="py-0.5">{v2}</td>
  </tr>
);

/** 목장 테이블 헤더 */
const MokjangHeader = () => (
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

/** 목장 데이터 행 */
const MokjangRow = ({ id, name, sub }: any) => (
  <div className="grid grid-cols-[1.5rem_1fr_1fr] py-0.5 border-b border-gray-100">
    <div className="px-1 border-r border-gray-200">{id}</div>
    <div className="px-1 border-r border-gray-200">{name}</div>
    <div className="px-1 text-gray-500">{sub}</div>
  </div>
);

/** 헌금 명단 행 */
const OfferingRow = ({ label, names }: { label: string, names: string }) => (
  <div className="flex border-b border-gray-200 pb-1">
    <span className="w-16 font-bold text-blue-900 shrink-0">{label}</span>
    <span className="leading-relaxed whitespace-pre-line">{names}</span>
  </div>
);

export default ChurchBulletin;