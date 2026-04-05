import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-bold text-white">명성비전교회</h3>
            <p className="text-sm leading-relaxed">
              서울특별시 동작구
              <br />
              전화: 02-XXX-XXXX
              <br />
              이메일: info@msvch.org
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-bold text-white">예배 안내</h3>
            <ul className="space-y-1 text-sm">
              <li>주일예배: 오전 11:00</li>
              <li>수요예배: 오후 7:30</li>
              <li>금요기도회: 오후 9:00</li>
              <li>새벽기도회: 오전 5:30</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-bold text-white">바로가기</h3>
            <ul className="space-y-1 text-sm">
              <li>
                <Link href="/notice" className="hover:text-white">
                  공지사항
                </Link>
              </li>
              <li>
                <Link href="/sermons" className="hover:text-white">
                  설교 영상
                </Link>
              </li>
              <li>
                <Link href="/gallery" className="hover:text-white">
                  갤러리
                </Link>
              </li>
              <li>
                <Link href="/map" className="hover:text-white">
                  오시는 길
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-700 pt-8 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} 명성비전교회. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
