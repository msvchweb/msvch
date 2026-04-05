import Link from "next/link";
import { Play, ArrowRight } from "lucide-react";
import type { SermonVideo } from "@/types/youtube";

export function LatestSermon({ sermon }: { sermon: SermonVideo | null }) {
  if (!sermon) return null;

  return (
    <section className="relative overflow-hidden bg-church-dark py-20">
      {/* Subtle glow */}
      <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/5 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">
            최근 설교
          </h2>
          <div className="section-divider mt-3" />
        </div>

        <div className="mx-auto max-w-3xl">
          <div className="group relative aspect-video overflow-hidden rounded-2xl shadow-2xl shadow-black/30">
            <iframe
              src={`https://www.youtube.com/embed/${sermon.videoId}`}
              title={sermon.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
          <div className="mt-5 flex items-start justify-between gap-4">
            <h3 className="text-lg font-semibold text-white">
              {sermon.title}
            </h3>
            <Link
              href="/sermons"
              className="group flex shrink-0 items-center gap-1 text-sm text-gray-400 transition-colors hover:text-church-gold"
            >
              더보기
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// Suppress unused import warning
void Play;
