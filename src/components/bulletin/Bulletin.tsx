import type { Weekly } from "@/types/notice";
import type { BulletinMasterData } from "@/types/bulletin-master";
import { weeklyToFrontData, BulletinFrontLeft, BulletinFrontRight } from "./BulletinFront";
import { weeklyToBackData, BulletinBackLeft, BulletinBackRight } from "./BulletinBack";

export type BulletinMode = "print" | "web";

export default function Bulletin({
  weekly,
  mode,
  master,
}: {
  weekly: Weekly;
  mode: BulletinMode;
  master?: BulletinMasterData;
}) {
  const frontData = weeklyToFrontData(weekly, master);
  const backData = weeklyToBackData(weekly, master);

  if (mode === "print") {
    // A4 가로 (297×210mm) 한 장에 A5 (148×210mm) 두 면을 좌·우로 배치 — 책자 임포지션
    //   시트 1 (앞면) : [페이지 4: 교회소식] | [페이지 1: 예배순서] ← 접으면 표지·표4
    //   시트 2 (뒷면) : [페이지 2: 예배안내] | [페이지 3: 헌금]    ← 접으면 내지
    return (
      <div className="bulletin-print">
        <section className="page">
          <div className="a5-cell">
            <div className="bulletin-fit text-[10px] leading-tight text-gray-800">
              <BulletinFrontLeft data={frontData} />
            </div>
          </div>
          <div className="a5-cell">
            <div className="bulletin-fit text-[10px] leading-tight text-gray-800">
              <BulletinFrontRight data={frontData} />
            </div>
          </div>
        </section>
        <section className="page">
          <div className="a5-cell">
            <div className="bulletin-fit text-[11px] leading-tight text-gray-800">
              <BulletinBackLeft data={backData} />
            </div>
          </div>
          <div className="a5-cell">
            <div className="bulletin-fit text-[11px] leading-tight text-gray-800">
              <BulletinBackRight data={backData} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bulletin-web mx-auto max-w-5xl space-y-6 py-6 px-2 sm:px-4">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="min-w-[900px] p-4">
          <div className="grid grid-cols-2 gap-4 text-[10px] text-gray-800 leading-tight">
            <BulletinFrontLeft data={frontData} />
            <BulletinFrontRight data={frontData} />
          </div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="min-w-[900px] p-4">
          <div className="grid grid-cols-2 gap-6 text-[11px] text-gray-800 leading-tight">
            <BulletinBackLeft data={backData} />
            <BulletinBackRight data={backData} />
          </div>
        </div>
      </div>
    </div>
  );
}
