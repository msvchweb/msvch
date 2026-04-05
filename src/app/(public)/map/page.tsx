import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";
import { MapPin, Phone, Mail, Bus, Train } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오시는 길",
};

const CHURCH_ADDRESS = "서울특별시 동작구";

export default function MapPage() {
  const mapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  const embedUrl =
    mapsKey && mapsKey !== "placeholder"
      ? `https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(CHURCH_ADDRESS)}&language=ko`
      : null;

  return (
    <>
      <PageHeader title="오시는 길" />
      <Container>
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="h-full w-full"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="교회 위치"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <MapPin size={48} className="mx-auto mb-2" />
                  <p>Google Maps API 키를 설정하면 지도가 표시됩니다.</p>
                  <p className="mt-2 text-sm">{CHURCH_ADDRESS}</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                교회 정보
              </h2>
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex gap-3">
                  <MapPin
                    className="mt-0.5 shrink-0 text-primary-500"
                    size={18}
                  />
                  <span>{CHURCH_ADDRESS}</span>
                </div>
                <div className="flex gap-3">
                  <Phone className="shrink-0 text-primary-500" size={18} />
                  <span>02-XXX-XXXX</span>
                </div>
                <div className="flex gap-3">
                  <Mail className="shrink-0 text-primary-500" size={18} />
                  <span>info@msvch.org</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-bold text-gray-900">
                대중교통 안내
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <Bus
                    className="mt-0.5 shrink-0 text-green-600"
                    size={18}
                  />
                  <div>
                    <p className="font-medium text-gray-900">버스</p>
                    <p className="text-gray-500">
                      정류장 하차 (도보 5분)
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Train
                    className="mt-0.5 shrink-0 text-blue-600"
                    size={18}
                  />
                  <div>
                    <p className="font-medium text-gray-900">지하철</p>
                    <p className="text-gray-500">
                      역 출구 (도보 10분)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </>
  );
}
