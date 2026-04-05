import type { SermonVideo } from "@/types/youtube";

export function LatestSermon({ sermon }: { sermon: SermonVideo | null }) {
  if (!sermon) return null;

  return (
    <section className="bg-gray-900 py-16 text-white">
      <div className="mx-auto max-w-7xl px-4">
        <h2 className="mb-8 text-center text-2xl font-bold">최근 설교</h2>
        <div className="mx-auto max-w-3xl">
          <div className="aspect-video overflow-hidden rounded-xl shadow-2xl">
            <iframe
              src={`https://www.youtube.com/embed/${sermon.videoId}`}
              title={sermon.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          <h3 className="mt-4 text-center text-xl font-semibold">
            {sermon.title}
          </h3>
        </div>
      </div>
    </section>
  );
}
