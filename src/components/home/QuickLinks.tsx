import Link from "next/link";
import Image from "next/image";

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
    description: "영유치부, 아동부, 청소년부, 청년부",
  },
  {
    title: "봉사센터",
    href: "/volunteer-center",
    image: "/images/volunteer.avif",
    description: "지역사회를 섬기는 봉사 사역",
  },
];

export function QuickLinks() {
  return (
    <section className="bg-white px-4 py-16 sm:px-12 sm:py-20">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-5 lg:grid-cols-4">
        {links.map((c) => (
          <Link key={c.title} href={c.href} className="group cursor-pointer">
            <div className="mb-4 aspect-[4/5] overflow-hidden rounded-[14px] bg-[var(--color-hero-bg-1)]">
              <Image
                src={c.image}
                alt={c.title}
                width={400}
                height={500}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </div>
            <div className="mb-1.5 text-[17px] font-semibold tracking-[-0.02em] text-church-dark">
              {c.title}
            </div>
            <div className="text-[13px] leading-[1.5] text-gray-500">
              {c.description}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
