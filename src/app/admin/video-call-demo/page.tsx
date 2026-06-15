"use client";

import { useState, useRef, useEffect } from "react";
import { MediaPermissionGuide } from "@/components/media/MediaPermissionGuide";
import { Camera, Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

export default function VideoCallDemoPage() {
  const [inCall, setInCall] = useState(false);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (stream && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleStartCall = () => {
    setShowPermissionGuide(true);
  };

  const handlePermissionGranted = (newStream: MediaStream) => {
    setStream(newStream);
    setInCall(true);
    // 가이드는 잠시 성공 메시지를 보여준 뒤 닫히도록 함 (MediaPermissionGuide 내부 로직에 따라 조절 가능)
    setTimeout(() => {
      setShowPermissionGuide(false);
    }, 1500);
  };

  const handleEndCall = () => {
    stream?.getTracks().forEach(track => track.stop());
    setStream(null);
    setInCall(false);
  };

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
      }
    }
  };

  const toggleCam = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCamOn(videoTrack.enabled);
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <div className="bg-primary-600 p-6 text-center text-white">
          <h1 className="text-xl font-bold">영상상담실 (데모)</h1>
          <p className="mt-1 text-sm opacity-80">권한 가이드 UX 개선 테스트 페이지</p>
        </div>

        <div className="p-8">
          {!inCall ? (
            <div className="py-12 text-center">
              <div className="mb-6 flex justify-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                  <Video size={40} />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">상담 시작하기</h2>
              <p className="mt-2 text-gray-500">
                상담원과 연결하기 전에 카메라와 마이크 상태를 확인합니다.
              </p>
              <button
                onClick={handleStartCall}
                className="mt-8 rounded-2xl bg-primary-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                영상통화 입장하기
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-gray-900 shadow-inner">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                <div className="absolute bottom-4 left-4 rounded-lg bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-md">
                  나 (내 화면)
                </div>
                
                {/* 컨트롤 바 */}
                <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-black/40 p-2 backdrop-blur-xl">
                  <button
                    onClick={toggleMic}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${micOn ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-rose-500 text-white'}`}
                  >
                    {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button
                    onClick={toggleCam}
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${camOn ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-rose-500 text-white'}`}
                  >
                    {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white transition-transform hover:scale-110 active:scale-90"
                  >
                    <PhoneOff size={20} />
                  </button>
                </div>
              </div>
              
              <div className="rounded-2xl bg-gray-50 p-4 text-center">
                <p className="text-sm font-medium text-gray-600">통화가 연결되었습니다.</p>
                <p className="text-xs text-gray-400 mt-1">이 페이지는 권한 획득 과정을 보여주기 위한 데모입니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPermissionGuide && (
        <MediaPermissionGuide 
          onGranted={handlePermissionGranted} 
          onClose={() => setShowPermissionGuide(false)}
        />
      )}

      <div className="mt-8 max-w-lg text-center text-xs text-gray-400">
        <p>
          <strong>UX 포인트:</strong> 사용자가 &apos;입장&apos; 버튼을 누른 후, 브라우저의 기본 팝업이 뜨기 전에 
          충분한 안내를 제공합니다. 또한 권한이 거부되었을 때 막막해하지 않도록 
          기기별/브라우저별 상세 설정을 안내하는 가이드가 포함되어 있습니다.
        </p>
      </div>
    </div>
  );
}
