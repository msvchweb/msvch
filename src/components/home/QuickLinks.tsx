import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

interface QuickLink {
  title: string;
  href: string;
  image: string;
  description: string;
}

const links: QuickLink[] = [
  {
    title: "예배안내",
    href: "/worship",
    image: "/images/worship-hall.avif",
    description: "주일예배, 수요예배, 새벽기도회",
  },
  {
    title: "비전갤러리",
    href: "/gallery",
    image: "/images/pastor-preaching.avif",
    description: "교회 활동과 행사 사진",
  },
  {
    title: "교회학교",
    href: "/churchschool",
    image: "/images/churchschool.avif",
    description: "유아부, 초등부, 청소년부, 청년부",
  },
  {
    title: "봉사센터",
    href: "/volunteer",
    image: "/images/volunteer.avif",
    description: "지역사회를 섬기는 봉사 사역",
  },
];

export function QuickLinks() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {links.map((link) => (
            <Link
              key={link.title}
              href={link.href}
              className="group relative overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              {/* Image */}
              <div className="relative aspect-[4/3]">
                <Image
                  src={link.image}
                  alt={link.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              </div>

              {/* Content overlay */}
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="text-lg font-bold text-white">
                  {link.title}
                </h3>
                <p className="mt-0.5 text-sm text-gray-300">
                  {link.description}
                </p>
                <div className="mt-2 flex items-center gap-1 text-sm font-medium text-church-gold opacity-0 transition-all duration-300 group-hover:opacity-100">
                  자세히 보기
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
