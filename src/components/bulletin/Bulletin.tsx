import type { Weekly } from "@/types/notice";
import BulletinFront from "./BulletinFront";
import BulletinBack, { weeklyToBackData } from "./BulletinBack";

export type BulletinMode = "print" | "web";

export default function Bulletin({
  weekly,
  mode,
}: {
  weekly: Weekly;
  mode: BulletinMode;
}) {
  const backData = weeklyToBackData(weekly);

  if (mode === "print") {
    return (
      <div className="bulletin-print">
        <section className="page front-page">
          <BulletinFront weekly={weekly} />
        </section>
        <section className="page back-page">
          <BulletinBack data={backData} />
        </section>
      </div>
    );
  }

  return (
    <div className="bulletin-web mx-auto max-w-5xl space-y-6 py-6 px-2 sm:px-4">
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="min-w-[900px]">
          <BulletinFront weekly={weekly} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="min-w-[900px]">
          <BulletinBack data={backData} />
        </div>
      </div>
    </div>
  );
}
