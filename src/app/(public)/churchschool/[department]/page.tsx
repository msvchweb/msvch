import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { getGalleryAlbums } from "@/lib/gallery";
import Image from "next/image";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface OrgMember {
  role: string;
  name: string;
}

interface DepartmentInfo {
  title: string;
  description: string;
  target: string;
  time: string;
  location: string;
  motto: string;
  verse: string;
  goals: string[];
  organization: OrgMember[];
  prayers: string[];
  galleryTag: string;
  instagram?: { url: string; handle: string };
}

const departments: Record<string, DepartmentInfo> = {
  infant: {
    title: "영유치부",
    description: "하나님의 사랑 안에서 자라는 아이들",
    target: "0~7세",
    time: "주일 낮 12시",
    location: "본관 1층",
    motto: "복음의 열매 맺는 영유치부",
    verse: "복음으로 쑥쑥쑥! 자라나는 우리 영유치부",
    goals: [
      "하나님께서 성령으로 부흥하게 하심을 믿게한다.",
      "예수님의 성품을 배워 공동체가 하나 되며, 이웃을 섬긴다.",
      "성령의 인도하심을 경험하며 제자로서 성장한다.",
    ],
    organization: [
      { role: "지도교역자", name: "박가람 교육사" },
      { role: "위원장", name: "박영옥 권사" },
      { role: "부장", name: "최은옥 권사" },
      { role: "총무·회계", name: "이민영" },
      { role: "서기", name: "이서경" },
      { role: "교사", name: "종승연, 신경식, 고종인, 강다은" },
    ],
    prayers: [
      "성령의 감동으로 예배하는 어린이 되도록",
      "아이들 가정에 성령의 지혜와 인내를 부어주시도록",
      "성령의 능력으로 자라나는 부서가 되도록",
    ],
    galleryTag: "영유치부",
  },
  elementary: {
    title: "아동부",
    description: "말씀으로 자라나는 어린이 제자",
    target: "초등학교 1학년~6학년",
    time: "주일 낮 10시",
    location: "교육관 2층",
    motto: "복음의 열매와 사랑이 넘치는 아동부",
    verse: "내 계명은 곧 내가 너희를 사랑한 것 같이 너희도 서로 사랑하라 하는 이것이니라 (요한복음 15:12)",
    goals: [
      "아이들이 믿음 안에서 자라나서 다른 친구들에게도 하나님을 전하기.",
      "말씀에 순종하며 하나님 사랑과 이웃사랑에 힘쓰기.",
      "서로가 믿음의 동역자가 되어 기도하고 아껴주기.",
    ],
    organization: [
      { role: "지도교역자", name: "임한나 전도사" },
      { role: "부장", name: "정세비 권사" },
      { role: "총무·서기", name: "이지석" },
      { role: "교사", name: "이영미, 강지수, 배상훈, 임예나, 최지안, 심현우, 전희수" },
    ],
    prayers: [
      "아이들이 가진 달란트를 잘 발견하여 하나님께 쓰임 받을 수 있는 제자 되기.",
      "아이들이 가는 곳마다 기쁨이 넘쳐나고 복의 근원이 되는 친구들이 되기를.",
      "아이들을 통하여 가정과 학교와 삶이 변화되길.",
    ],
    galleryTag: "아동부",
    instagram: { url: "https://www.instagram.com/msvch_children?igsh=MXJmbDdzeTkzdWw3eQ==", handle: "@msvch_children" },
  },
  teen: {
    title: "청소년부",
    description: "꿈을 품고 세상을 변화시키는 청소년",
    target: "14세~19세",
    time: "주일 낮 12시",
    location: "교육관 3층 갈릴리실",
    motto: "복음의 열매를 맺는 청소년부",
    verse: "나는 포도나무요 너희는 가지라 그가 내 안에, 내가 그 안에 거하면 사람이 열매를 많이 맺나니 나를 떠나서는 너희가 아무 것도 할 수 없음이라 (요한복음 15:5)",
    goals: [
      "하나님 자녀의 정체성이 분명한 청소년.",
      "학생들 개인의 특성과 은사, 눈높이에 맞춘 양육 프로그램 실천.",
      "말씀과 기도의 생활화, 비전과 은사의 발견.",
    ],
    organization: [
      { role: "지도교역자", name: "최희성 전도사" },
      { role: "부장", name: "전용우 안수집사" },
      { role: "총무", name: "홍성란 권사" },
      { role: "회계", name: "문진혁" },
      { role: "교사", name: "홍성란, 신경숙, 하수미, 문진혁, 강현진, 김명빈, 김은상, 김자민, 박재언, 김정숙" },
    ],
    prayers: [
      "아이들이 가진 달란트를 잘 발견하여 하나님께 쓰임 받을 수 있는 제자 되기.",
      "아이들이 가는 곳마다 기쁨이 넘쳐나고 복의 근원이 되는 친구들이 되기를.",
      "아이들을 통하여 가정과 학교와 삶이 변화되길.",
    ],
    galleryTag: "청소년부",
    instagram: { url: "https://www.instagram.com/msvch_middle?igsh=Y3prOHR0d2trajRn", handle: "@msvch_middle" },
  },
  youth: {
    title: "청년부",
    description: "믿음 위에 미래를 세우는 청년 공동체",
    target: "청년",
    time: "매월 첫째주일 14:30",
    location: "본관 2층",
    motto: "복음의 열매 안에서 함께 지어져 가는 우리",
    verse: "너희도 성령 안에서 하나님이 거하실 처소가 되기 위하여 그리스도 예수 안에서 함께 지어져 가느니라 (에베소서 2:22)",
    goals: [
      "교회와 가정에서 예배와 말씀을 통해 하나님을 만나며, 말씀에 순종한다.",
      "예수님의 성품을 배워 공동체가 하나 되며, 이웃을 섬긴다.",
      "성령의 인도하심을 경험하며 제자로서 성장한다.",
    ],
    organization: [
      { role: "지도교역자", name: "이준영 전도사" },
      { role: "부장", name: "김재락 장로" },
      { role: "부감", name: "박영호 집사" },
      { role: "회장", name: "유세인 청년" },
      { role: "총무", name: "종승연 청년" },
      { role: "서기", name: "최지안 청년" },
    ],
    prayers: [
      "성령의 능력 안에서 함께 지어져 가는 청년부 되도록.",
      "청년부가 부흥하고, 믿음의 깊이가 더욱 깊어지도록.",
      "청년의 때에 악과 선을 분별할 수 있도록.",
    ],
    galleryTag: "청년부",
    instagram: { url: "https://www.instagram.com/msvch_insta?igsh=dWJlZ3J2ZDhwZGdq", handle: "@msvch_insta" },
  },
};

type Params = Promise<{ department: string }>;

export const revalidate = 3600;

export async function generateStaticParams() {
  return Object.keys(departments).map((department) => ({ department }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { department } = await params;
  const dept = departments[department];
  if (!dept) return {};
  return { title: dept.title };
}

export default async function DepartmentPage({
  params,
}: {
  params: Params;
}) {
  const { department } = await params;
  const dept = departments[department];
  if (!dept) notFound();

  const albums = await getGalleryAlbums({
    tags: ["교회학교", dept.galleryTag],
    limit: 3,
    withImages: true,
  });
  const photos = albums.flatMap((a) => a.images).slice(0, 6);

  return (
    <>
      <PageHeader title={dept.title} description={dept.description} />
      <Container>
        <div className="mx-auto max-w-3xl space-y-8">
          {/* 인스타그램 */}
          {dept.instagram && (
            <div className="flex justify-center">
              <a
                href={dept.instagram.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-pink-300 hover:text-pink-600"
              >
                <InstagramIcon size={18} className="text-pink-500" />
                {dept.instagram.handle}
              </a>
            </div>
          )}

          {/* 갤러리 사진 */}
          {photos.length > 0 && (
            <Link
              href={`/gallery?category=교회학교&sub=${dept.galleryTag}`}
              className="grid grid-cols-3 gap-2 overflow-hidden rounded-2xl"
            >
              {photos.map((photo) => (
                <div key={photo.id} className="relative aspect-[4/3]">
                  <Image
                    src={photo.image_url}
                    alt=""
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-105"
                    sizes="(max-width: 768px) 33vw, 250px"
                  />
                </div>
              ))}
            </Link>
          )}

          {/* 기본 정보 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="font-medium text-gray-500">대상</p>
                <p className="mt-1 font-semibold text-gray-900">{dept.target}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="font-medium text-gray-500">시간</p>
                <p className="mt-1 font-semibold text-gray-900">{dept.time}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="font-medium text-gray-500">장소</p>
                <p className="mt-1 font-semibold text-gray-900">{dept.location}</p>
              </div>
            </div>
          </div>

          {/* 표어 & 말씀 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="font-bold text-gray-900">2026 표어</h3>
            <p className="mt-2 text-lg font-semibold text-primary-600">{dept.motto}</p>
            <h3 className="mt-6 font-bold text-gray-900">주제말씀</h3>
            <blockquote className="mt-2 border-l-4 border-church-gold pl-4 text-gray-600 italic">
              {dept.verse}
            </blockquote>
          </div>

          {/* 교육목표 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="font-bold text-gray-900">교육목표</h3>
            <ol className="mt-3 space-y-2">
              {dept.goals.map((goal, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                    {i + 1}
                  </span>
                  {goal}
                </li>
              ))}
            </ol>
          </div>

          {/* 조직 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="font-bold text-gray-900">섬기는 이들</h3>
            <div className="mt-3 divide-y divide-gray-100">
              {dept.organization.map((member) => (
                <div key={member.role} className="flex gap-4 py-2.5 text-sm">
                  <span className="w-20 shrink-0 font-medium text-gray-500">{member.role}</span>
                  <span className="text-gray-900">{member.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 기도제목 */}
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h3 className="font-bold text-gray-900">기도제목</h3>
            <ol className="mt-3 space-y-2">
              {dept.prayers.map((prayer, i) => (
                <li key={i} className="flex gap-3 text-sm text-gray-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-church-gold-light text-xs font-bold text-church-gold">
                    {i + 1}
                  </span>
                  {prayer}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Container>
    </>
  );
}
