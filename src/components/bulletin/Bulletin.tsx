import type { Weekly } from "@/types/notice";
import type { BulletinMasterData } from "@/types/bulletin-master";
import { weeklyToFrontData, BulletinFrontLeft, BulletinFrontRight } from "./BulletinFront";
import { weeklyToBackData, BulletinBackLeft, BulletinBackRight } from "./BulletinBack";
import { BulletinWebView } from "./BulletinWebView";

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
  if (mode === "print") {
    const frontData = weeklyToFrontData(weekly, master);
    const backData = weeklyToBackData(weekly, master);
    // A4 가로 (297×210mm) 한 장에 A5 (148×210mm) 두 면을 좌·우로 배치 — 책자 임포지션
    //   시트 1 (앞면) : [페이지 4: 교회소식] | [페이지 1: 예배순서] ← 접으면 표지·표4
    //   시트 2 (뒷면) : [페이지 2: 예배안내] | [페이지 3: 헌금]    ← 접으면 내지
    return (
      <div className="bulletin-print">
        <section className="page">
          <div className="a5-cell">
            <div className="liturgy-strip" />
            <div className="bulletin-fit text-[10px] leading-tight text-gray-800">
              <BulletinFrontLeft data={frontData} />
            </div>
          </div>
          <div className="a5-cell">
            <div className="liturgy-strip" />
            <div className="bulletin-fit text-[10px] leading-tight text-gray-800">
              <BulletinFrontRight data={frontData} />
            </div>
          </div>
        </section>
        <section className="page">
          <div className="a5-cell">
            <div className="liturgy-strip" />
            <div className="bulletin-fit text-[11px] leading-tight text-gray-800">
              <BulletinBackLeft data={backData} />
            </div>
          </div>
          <div className="a5-cell">
            <div className="liturgy-strip" />
            <div className="bulletin-fit text-[11px] leading-tight text-gray-800">
              <BulletinBackRight data={backData} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  return <BulletinWebView weekly={weekly} master={master} />;
}
