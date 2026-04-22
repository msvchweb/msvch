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
    return (
      <div className="bulletin-print">
        <section className="page front-page">
          <div className="bulletin-front bg-white text-gray-800 text-[10px] leading-tight p-4">
            <div className="grid grid-cols-2 gap-4">
              <BulletinFrontLeft data={frontData} />
              <BulletinFrontRight data={frontData} />
            </div>
          </div>
        </section>
        <section className="page back-page">
          <div className="bulletin-back bg-white text-gray-800 text-[11px] leading-tight">
            <div className="grid grid-cols-2 gap-6 p-4">
              <BulletinBackLeft data={backData} />
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
