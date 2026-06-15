"use client";

import { useState, useEffect, useCallback } from "react";
import { Camera, Mic, Settings, AlertCircle, ArrowUpLeft, X, CheckCircle2 } from "lucide-react";

interface MediaPermissionGuideProps {
  onGranted: (stream: MediaStream) => void;
  onClose?: () => void;
}

type PermissionStatus = "initial" | "requesting" | "granted" | "denied";

export function MediaPermissionGuide({ onGranted, onClose }: MediaPermissionGuideProps) {
  const [status, setStatus] = useState<PermissionStatus>("initial");
  const [error, setError] = useState<string>("");
  const [showManualGuide, setShowManualGuide] = useState(false);

  const requestPermission = useCallback(async () => {
    setStatus("requesting");
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStatus("granted");
      onGranted(stream);
    } catch (err: unknown) {
      console.error("Permission request failed:", err);
      setStatus("denied");
      
      const errorName = err instanceof Error ? err.name : "";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        setError("카메라 및 마이크 권한이 거부되었습니다.");
      } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
        setError("카메라나 마이크 장치를 찾을 수 없습니다.");
      } else {
        setError("미디어 장치에 접근하는 중 오류가 발생했습니다.");
      }
    }
  }, [onGranted]);

  // 초기 진입 시 권한 상태 확인 (이미 허용되어 있는지)
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;

    navigator.permissions.query({ name: "camera" as PermissionName }).then((result) => {
      if (result.state === "granted") {
        // 이미 허용된 경우 바로 요청해서 스트림 확보
        requestPermission();
      }
    });
  }, [requestPermission]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        )}

        {/* ── 가이드 상단 비주얼 ── */}
        <div className="bg-primary-50 px-6 py-8 text-center">
          <div className="mb-4 flex justify-center gap-4">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full shadow-inner transition-colors ${status === 'granted' ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-primary-600'}`}>
              {status === 'granted' ? <CheckCircle2 size={32} /> : <Camera size={32} />}
            </div>
            <div className={`flex h-16 w-16 items-center justify-center rounded-full shadow-inner transition-colors ${status === 'granted' ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-primary-600'}`}>
              {status === 'granted' ? <CheckCircle2 size={32} /> : <Mic size={32} />}
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {status === "granted" ? "준비 완료!" : "영상통화 권한 허용"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {status === "granted" 
              ? "카메라와 마이크가 연결되었습니다."
              : "상대방과 대화하기 위해 카메라와 마이크 사용 권한이 필요합니다."}
          </p>
        </div>

        {/* ── 상태별 콘텐츠 ── */}
        <div className="p-6">
          {status === "initial" && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} className="text-primary-600" />
                  잠시 후에 나타나는 팝업에서
                </p>
                <p className="leading-relaxed">
                  브라우저 상단(또는 중앙)에 나타나는 <span className="font-bold text-primary-700 text-base"> [허용] </span> 혹은 <span className="font-bold text-primary-700 text-base"> [Allow] </span> 버튼을 꼭 눌러주세요.
                </p>
              </div>
              <button
                onClick={requestPermission}
                className="w-full rounded-xl bg-primary-600 py-4 text-lg font-bold text-white shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                권한 요청 팝업 띄우기
              </button>
            </div>
          )}

          {status === "requesting" && (
            <div className="relative py-12 text-center">
              <div className="absolute -top-12 left-2 animate-bounce text-primary-600 lg:left-[-20px]">
                <div className="flex flex-col items-center">
                  <ArrowUpLeft size={48} />
                  <span className="text-sm font-bold bg-primary-600 text-white px-2 py-1 rounded-md">여기 &apos;허용&apos;을 눌러주세요!</span>
                </div>
              </div>
              <LoaderSpinner />
              <p className="mt-6 text-sm font-medium text-gray-500">
                브라우저 권한 팝업을 확인 중입니다...
              </p>
            </div>
          )}

          {status === "denied" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="shrink-0 text-rose-600" size={20} />
                  <div>
                    <p className="font-bold text-rose-900">{error}</p>
                    <p className="mt-1 text-xs text-rose-700 leading-relaxed">
                      주소창 옆의 자물쇠 아이콘(🔒)이나 설정 버튼을 눌러 카메라와 마이크 권한을 직접 &lsquo;허용&rsquo;으로 바꿔주셔야 합니다.
                    </p>
                  </div>
                </div>
              </div>

              {!showManualGuide ? (
                <button
                  onClick={() => setShowManualGuide(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Settings size={16} />
                  상세 해결 방법 보기
                </button>
              ) : (
                <div className="space-y-3 pt-2">
                  <ManualGuideStep 
                    title="크롬 / 삼성 인터넷"
                    desc="주소창 왼쪽의 [설정] 아이콘 → [권한] → 카메라/마이크 활성화"
                  />
                  <ManualGuideStep 
                    title="아이폰 (Safari)"
                    desc="주소창 왼쪽 [아아] 또는 [AA] 아이콘 → [웹 사이트 설정] → 카메라/마이크 '허용'"
                  />
                  <button
                    onClick={() => window.location.reload()}
                    className="w-full mt-4 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white"
                  >
                    설정 변경 후 새로고침하기
                  </button>
                </div>
              )}
            </div>
          )}

          {status === "granted" && (
            <div className="py-8 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <p className="mt-4 font-medium text-gray-900">확인되었습니다.</p>
              <p className="mt-1 text-sm text-gray-500">통화 화면으로 이동합니다...</p>
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 text-center">
          <p className="text-[11px] text-gray-400">
            명성비전교회 영상통화는 보안을 위해 암호화된 통로를 사용하며, 
            <br />
            권한 허용 없이는 원활한 대화가 불가능합니다.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoaderSpinner() {
  return (
    <div className="flex justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600"></div>
    </div>
  );
}

function ManualGuideStep({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 text-left">
      <p className="text-xs font-bold text-gray-900">{title}</p>
      <p className="mt-1 text-[11px] text-gray-500 leading-normal">{desc}</p>
    </div>
  );
}
