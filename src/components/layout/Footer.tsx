import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-church-dark text-gray-400">
      {/* Gold accent line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-church-gold to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Church info */}
          <div>
            <div className="mb-4 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold text-church-gold">
                M
              </div>
              <h3 className="text-lg font-bold text-white">명성비전교회</h3>
            </div>
            <div className="space-y-2.5 text-sm">
              <p className="flex items-start gap-2.5">
                <MapPin size={15} className="mt-0.5 shrink-0 text-church-gold" />
                서울특별시 동작구
              </p>
              <p className="flex items-center gap-2.5">
                <Phone size={15} className="shrink-0 text-church-gold" />
                02-XXX-XXXX
              </p>
              <p className="flex items-center gap-2.5">
                <Mail size={15} className="shrink-0 text-church-gold" />
                info@msvch.org
              </p>
            </div>
          </div>

          {/* Worship times */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-church-gold">
              예배 안내
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>주일예배</span>
                <span className="text-gray-300">오전 11:00</span>
              </li>
              <li className="flex justify-between">
                <span>수요예배</span>
                <span className="text-gray-300">오후 7:30</span>
              </li>
              <li className="flex justify-between">
                <span>금요기도회</span>
                <span className="text-gray-300">오후 9:00</span>
              </li>
              <li className="flex justify-between">
                <span>새벽기도회</span>
                <span className="text-gray-300">오전 5:30</span>
              </li>
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-church-gold">
              바로가기
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/notice", label: "공지사항" },
                { href: "/sermons", label: "설교 영상" },
                { href: "/gallery", label: "갤러리" },
                { href: "/map", label: "오시는 길" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-gray-500">
          &copy; {new Date().getFullYear()} 명성비전교회. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
