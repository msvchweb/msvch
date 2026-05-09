import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "홈페이지 기능 보고서",
  description:
    "명성비전교회 자체 개발 홈페이지의 기능 정리 — 임원회의 보고용 초안.",
  robots: { index: false, follow: false },
};

const LAST_UPDATED = "2026-05-09";

export default function BoardReportPage() {
  return (
    <>
      <PageHeader
        title="홈페이지 기능 보고서"
        description="자체 개발 홈페이지의 기능 정리와 기존 Wix 대비 신규/강화 기능"
      />
      <Container className="py-8 md:py-12">
        <article className="mx-auto max-w-3xl space-y-10 text-gray-800 leading-relaxed">
          <p className="text-sm text-gray-500">
            작성일 {LAST_UPDATED} · 임원회의 보고용 초안
          </p>

          {/* 1. 한눈에 비교 */}
          <Section number="1" title="한눈에 — 왜 자체 개발인가">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {COMPARISON.map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-church-gold mb-2">
                    {row.label}
                  </p>
                  <dl className="space-y-1.5 text-sm">
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-gray-400">Wix</dt>
                      <dd className="text-gray-600">{row.wix}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-gray-400">자체 개발</dt>
                      <dd className="font-medium text-gray-900">{row.self}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
              <strong>핵심</strong>: 비용을 거의 0원으로 줄이는 동시에, Wix에서
              막혀 있던 &ldquo;교회 운영에 진짜 필요한 기능들&rdquo;을 자유롭게
              넣었습니다.
            </p>
          </Section>

          {/* 2. 일반 성도 기능 */}
          <Section number="2" title="일반 성도(방문자)가 보는 기능">
            <p className="mb-4 text-sm text-gray-600">
              아래 항목을 눌러 펼치면 자세한 설명이 나옵니다.
            </p>
            <div className="space-y-2">
              <Accordion title="2.1 메인 메뉴 — 기존 페이지 정리해서 재구현">
                <p className="mb-3">
                  기존 Wix의 23개 페이지를 모두 다시 만들면서 정보 구조를 단순화.
                </p>
                <MenuList
                  items={[
                    {
                      label: "교회소개",
                      desc: "인사말 / 공지사항 / 예배안내 / 섬기는 이들 / 찾아오시는 길 / 주보 / 새가족 등록",
                    },
                    {
                      label: "말씀영상",
                      desc: "설교 영상 목록 (주일·수요·새벽 등 카테고리 탭)",
                    },
                    {
                      label: "비전갤러리",
                      desc: "카테고리 + 부서 2단계 필터 (예배·교회학교·교회행사·봉사센터·새가족)",
                    },
                    {
                      label: "교회학교",
                      desc: "영유치부 / 아동부 / 청소년부 / 청년부 — 표어·기도제목 등 부서별 안내",
                    },
                    {
                      label: "봉사센터",
                      desc: "사랑의 반찬나눔·이미용·비전문화학교·탁구교실",
                    },
                  ]}
                />
              </Accordion>

              <Accordion title="2.2 홈 메인 슬라이더" badge="신규">
                <Ul>
                  <li>
                    공지사항에 새 글이 올라오면{" "}
                    <strong>자동으로 메인 상단 슬라이드</strong>에 노출됨
                  </li>
                  <li>
                    별도 슬라이더 관리 작업 불필요 — &ldquo;공지 게시&rdquo;가 곧
                    &ldquo;메인 노출&rdquo;
                  </li>
                  <li>
                    카테고리에 따라 &ldquo;교회소식 / 긴급공지 /
                    교회행사&rdquo; 라벨 자동 부착
                  </li>
                  <li>큰 이미지도 알아서 자동 압축</li>
                  <li>네이버 블로그에 글이 올라오면 자동 매핑</li>
                </Ul>
              </Accordion>

              <Accordion title="2.3 갤러리(비전갤러리)" badge="강화">
                <Ul>
                  <li>카테고리(5개) × 부서(4개) 두 단계로 동시 필터링</li>
                  <li>사진 클릭 시 큰 화면으로 슬라이드 보기(라이트박스)</li>
                  <li>한 번에 최대 30장 업로드, 큰 이미지는 자동 압축</li>
                  <li>
                    인스타 자동 연동도 시도했으나, 부서 계정 소유권 이슈로 보류
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="2.4 주보 시스템" badge="대폭 신규">
                <p className="mb-3 text-sm text-gray-600">
                  기존 Wix: 주보 PDF를 첨부 파일로 올리는 게시판 수준.
                </p>
                <p className="mb-3">
                  자체 개발:{" "}
                  <strong>
                    주보를 입력 폼으로 작성하면, 웹·인쇄용 PDF가 자동으로
                    생성됨.
                  </strong>
                </p>
                <Ul>
                  <li>
                    입력 폼은 5개 탭(기본 / 주일예배 / 예배안내 / 헌금 /
                    교회소식) + &ldquo;주보 마스터&rdquo; 탭
                  </li>
                  <li>
                    <strong>우측에 실시간 미리보기</strong>: 입력하는 즉시 4페이지
                    주보가 화면에 그려짐
                  </li>
                  <li>
                    &ldquo;주보 마스터&rdquo;(올해 표어, 목장 현황, 섬기는 이,
                    후원 항목, 공동체 기도제목)는{" "}
                    <strong>한 번 등록하면 모든 주보에 자동 반영</strong>
                  </li>
                  <li>
                    &ldquo;PDF 생성&rdquo; 버튼 한 번이면 인쇄용 A4 PDF가 자동
                    생성·저장
                  </li>
                  <li>
                    주별 변동은 토글로 — &ldquo;주일오후 찬양예배 →
                    목장모임&rdquo; 전환, &ldquo;부활감사&rdquo; 헌금 항목 켜고
                    끄기 등
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="2.5 교회 일정 캘린더" badge="신규">
                <Ul>
                  <li>월간 캘린더 + 일정 점 표시 + 마우스/터치로 미리보기</li>
                  <li>
                    처음에는 Google Calendar 임베드를 쓰다가{" "}
                    <strong>자체 운영으로 전환</strong> → 외부 의존 제거, 알림톡
                    연동 가능
                  </li>
                  <li>다가오는 일정 위젯은 메인 화면에도 자동 노출</li>
                  <li>
                    (예정) 주보 업로드 시 AI가 일정을 자동으로 읽어 캘린더에 반영
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="2.6 카카오 알림톡 — D-1 일정 알림" badge="신규">
                <Ul>
                  <li>
                    관리자가 &ldquo;알림 발송 대상&rdquo;으로 체크한 일정에
                    한해, <strong>하루 전 오전 6시</strong> 에 등록된 분들께
                    카카오 알림톡 자동 발송
                  </li>
                  <li>같은 일정·같은 사람에게 두 번 가는 일 없도록 중복 방지</li>
                  <li>
                    카카오 비즈니스 채널 승인 후 즉시 가동 가능 (현재는 발송
                    추적만 작동)
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="2.7 새가족 등록 폼" badge="신규">
                <Ul>
                  <li>누구나 비로그인으로 9문항 작성 가능</li>
                  <li>
                    개인정보 동의 필수 (동의 안 하면 저장 자체가 안 됨)
                  </li>
                  <li>
                    관리자 화면에서 처리 상태 관리:{" "}
                    <strong>신규 → 연락중 → 배정완료 → 완료</strong>, 메모 첨부
                    가능
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="2.8 소모임 게시판" badge="신규">
                <Ul>
                  <li>
                    목장·선교회·임시 행사용 게시판을{" "}
                    <strong>관리자가 임의로 만들고 멤버를 직접 지정</strong>
                  </li>
                  <li>
                    멤버만 글·댓글·사진을 올릴 수 있는 비공개 게시판
                  </li>
                  <li>용도가 끝나면 &ldquo;숨김&rdquo; 처리 (데이터는 보존)</li>
                </Ul>
              </Accordion>

              <Accordion title="2.9 챗봇 (AI)" badge="신규">
                <Ul>
                  <li>
                    우측 하단 떠 있는 채팅창. 교회 위치·예배시간·새가족 안내
                    등 자주 받는 문의에 즉답
                  </li>
                  <li>
                    <strong>최신 공지사항을 AI에게 함께 알려줌</strong> — 답변에
                    최신 소식이 자동 반영
                  </li>
                  <li>
                    답으로 해결 안 되는 문의는 &ldquo;문의 접수&rdquo;로 저장 →
                    관리자가 확인
                  </li>
                  <li>한 사람이 너무 많이 호출하지 못하도록 횟수 제한</li>
                </Ul>
              </Accordion>

              <Accordion title="2.10 링크 모음 페이지" badge="신규">
                <Ul>
                  <li>
                    인스타 프로필 등에 거는 통합 링크 페이지 (홈/블로그/메인
                    IG/3개 부서 IG)
                  </li>
                  <li>
                    페이지 자체 QR 코드를 자동으로 만들어 인쇄물에 그대로 사용
                    가능
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="2.11 개인정보 처리방침 페이지" badge="신규">
                <Ul>
                  <li>Meta 등 외부 인증·법적 요구를 위한 정식 처리방침</li>
                  <li>새가족 폼 동의 항목과 연결</li>
                </Ul>
              </Accordion>

              <Accordion title="2.12 모바일 사용성" badge="강화">
                <Ul>
                  <li>
                    화면 하단에 5개 탭바(홈/말씀/갤러리/소식/더보기) — 앱 같은
                    느낌
                  </li>
                  <li>햄버거 메뉴는 풀스크린으로 펼쳐져 좁은 화면에서도 편함</li>
                  <li>&ldquo;마지막 방문 이후 새 글&rdquo; 빨간 점 배지 안내</li>
                </Ul>
              </Accordion>
            </div>
          </Section>

          {/* 3. 관리자 기능 */}
          <Section number="3" title="관리자(직원) 기능">
            <div className="space-y-2">
              <Accordion title="3.1 관리자 대시보드">
                <Ul>
                  <li>
                    새가족 신규 접수 / 챗봇 문의 / 소모임 새 글 / 다가오는 일정을
                    한 화면에 요약
                  </li>
                </Ul>
              </Accordion>

              <Accordion
                title="3.2 관리자 가이드 + 화면 따라가는 안내 투어"
                badge="신규"
              >
                <Ul>
                  <li>단계별 사용설명서(공지/갤러리/주보/포스터/문의)</li>
                  <li>
                    &ldquo;투어 시작&rdquo; 버튼: 화면을 어둡게 하고 다음 클릭할
                    버튼만 밝게 비추는 <strong>16단계 안내</strong> — 신규
                    직원이 처음 들어와도 따라가기만 하면 됨
                  </li>
                  <li>탭 전환·페이지 이동까지 알아서 따라감</li>
                </Ul>
              </Accordion>

              <Accordion title="3.3 콘텐츠 작성·관리">
                <Ul>
                  <li>
                    공지사항 / 주보 / 갤러리 / 설교 / 일정의 작성·수정·삭제·게시
                    토글
                  </li>
                  <li>주보는 우측 실시간 미리보기 + 자동 PDF 생성</li>
                </Ul>
              </Accordion>

              <Accordion title="3.4 설교 영상 자동 동기화" badge="신규">
                <Ul>
                  <li>
                    매일 오후 3시, 유튜브 채널의 최신 50개 영상을 자동으로 가져와
                    누적
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="3.5 설교 요약 (AI)" badge="신규">
                <Ul>
                  <li>
                    설교 영상 1개 선택 → &ldquo;AI 요약 생성&rdquo; 버튼 → 본문
                    요약 텍스트
                  </li>
                  <li>그대로 공지사항으로 저장 가능</li>
                </Ul>
              </Accordion>

              <Accordion title="3.6 포스터 프롬프트 도우미" badge="신규">
                <Ul>
                  <li>
                    행사 정보 + 분위기 칩(따뜻한/현대적/전통적 등) 입력
                  </li>
                  <li>
                    AI가 영문 이미지 생성 명령어를 만들어 줌 → 직원이 자기
                    ChatGPT/Gemini 등에 붙여넣어 이미지 생성
                  </li>
                  <li>
                    만든 이미지에 한글 행사명·교회 로고·전화번호·QR을 자동 합성
                    (SNS 정사각·스토리·A4 인쇄 3종 비율)
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="3.7 챗봇 문의 / 새가족 / 소모임 게시판 운영">
                <Ul>
                  <li>챗봇이 답하지 못한 문의 모아보기</li>
                  <li>새가족 등록 상태 추적, 메모 작성</li>
                  <li>소모임 게시판 신설·멤버 일괄 지정·숨김</li>
                </Ul>
              </Accordion>

              <Accordion
                title="3.8 쇼츠 자동화"
                badge="신규 · 운영 준비 중"
              >
                <Ul>
                  <li>
                    설교 영상 1개를 자동으로 짧게(9:16) 잘라 자막까지 입혀서
                    쇼츠 후보를 만들어 줌
                  </li>
                  <li>
                    관리자 화면에서 &ldquo;쇼츠 생성&rdquo; 버튼만 누르면 시작,
                    검수 후 업로드
                  </li>
                </Ul>
              </Accordion>

              <Accordion title="3.9 네이버 블로그 자동 동기화" badge="신규">
                <Ul>
                  <li>
                    교회 네이버 블로그(msvch01)에 새 글이 올라오면 자동으로
                    가져와 공지/소식에 반영
                  </li>
                  <li>
                    이미지는 우리 저장소로 다시 올려서 외부 링크가 깨질 걱정 없음
                  </li>
                </Ul>
              </Accordion>
            </div>
          </Section>

          {/* 4. 신규/강화 한눈에 */}
          <Section number="4" title="기존 Wix 대비 신규/강화 기능 한눈에 보기">
            <div className="space-y-2">
              <Accordion title="✨ 완전 신규 (Wix에 없던 기능)" defaultOpen>
                <ol className="space-y-1.5 list-decimal pl-5 text-sm">
                  <li>
                    <strong>AI 챗봇</strong> — 24시간 자동 응대 + 최신 공지 자동
                    반영
                  </li>
                  <li>
                    <strong>AI 설교 요약</strong> — 한 번 클릭으로 설교 본문
                    요약
                  </li>
                  <li>
                    <strong>AI 포스터 도우미</strong> — 직원이 손쉽게 행사 포스터
                    제작
                  </li>
                  <li>
                    <strong>자체 일정 캘린더 + 카카오 알림톡 자동 발송</strong>
                  </li>
                  <li>
                    <strong>새가족 등록 공개 폼 + 처리 상태 추적</strong>
                  </li>
                  <li>
                    <strong>소모임(목장/선교회) 게시판</strong> — 멤버 한정
                    비공개 게시판
                  </li>
                  <li>
                    <strong>유튜브 설교 영상 자동 동기화</strong>
                  </li>
                  <li>
                    <strong>유튜브 쇼츠 자동 생성 파이프라인</strong>
                  </li>
                  <li>
                    <strong>네이버 블로그 자동 동기화</strong>
                  </li>
                  <li>
                    <strong>관리자 가이드 + 16단계 화면 안내 투어</strong>
                  </li>
                  <li>
                    <strong>링크 모음 + QR</strong> (인스타 바이오용)
                  </li>
                  <li>
                    <strong>개인정보 처리방침 정식 페이지</strong>
                  </li>
                  <li>
                    <strong>&ldquo;새 글 빨간 점&rdquo; 배지</strong>
                  </li>
                  <li>
                    <strong>모바일 하단 탭바 / 풀스크린 햄버거 메뉴</strong>
                  </li>
                </ol>
              </Accordion>

              <Accordion title="🔁 Wix 대비 대폭 강화">
                <ol className="space-y-1.5 list-decimal pl-5 text-sm">
                  <li>
                    <strong>주보</strong> — PDF 첨부 → 입력 폼 + 실시간 미리보기
                    + 자동 PDF 생성 + 마스터 자동 반영
                  </li>
                  <li>
                    <strong>갤러리</strong> — 단순 앨범 → 카테고리/부서 2단 필터
                    + 라이트박스 + 자동 압축
                  </li>
                  <li>
                    <strong>공지사항</strong> — 단순 게시판 → 메인 슬라이더 자동
                    연동 + 챗봇 자동 반영
                  </li>
                  <li>
                    <strong>예배 안내</strong> — 시간표 이미지 한 장 → 데이터
                    기반 카드 (메인에도 자동 노출)
                  </li>
                  <li>
                    <strong>설교 영상</strong> — 단순 임베드 → 자동 누적 +
                    카테고리 자동 분류 + 메인 최신영상
                  </li>
                  <li>
                    <strong>모바일 사용성</strong> — 자동 반응형 → 앱 수준
                    사용감
                  </li>
                </ol>
              </Accordion>

              <Accordion title="💰 비용">
                <Ul>
                  <li>Wix: 연 수십만 원</li>
                  <li>
                    자체 개발:{" "}
                    <strong>사실상 0원</strong> (도메인 갱신 비용만)
                  </li>
                </Ul>
              </Accordion>
            </div>
          </Section>

          {/* 5. 향후 후속 과제 */}
          <Section number="5" title="향후 후속 과제">
            <Ul>
              <li>카카오 비즈니스 채널 승인 → 알림톡 실 발송 활성화</li>
              <li>
                인스타그램 부서 계정 → 갤러리 자동 동기화 (소유권 정리 후 적용)
              </li>
              <li>네이버 검색어드바이저 소유권 인증</li>
              <li>쇼츠 자동화 운영 본격화</li>
              <li>주보 업로드 시 AI가 일정을 읽어 캘린더 자동 반영</li>
            </Ul>
          </Section>

          {/* 6. 직원 학습 정리 */}
          <Section number="6" title="직원이 익혀야 할 기능 정리">
            <p className="mb-4 text-sm text-gray-600">
              미디어선교부원 + 교역자가 함께 운영합니다. 기능별로 누가 다룰지
              미리 정해두면 인수인계가 쉬워집니다.
            </p>

            <div className="space-y-2">
              <Accordion
                title="👥 모든 직원 공통 (미디어선교부원 + 교역자)"
                defaultOpen
              >
                <TrainingList
                  items={[
                    {
                      label: "공지사항",
                      desc: "새 공지 작성·수정·삭제, 카테고리 선택(메인 슬라이더 자동 라벨 결정), 이미지 첨부",
                    },
                    {
                      label: "갤러리",
                      desc: "앨범 만들기, 카테고리/부서 태그 지정, 사진 일괄 업로드(최대 30장), 공개 토글",
                    },
                    {
                      label: "새가족 등록",
                      desc: "접수 내역 확인, 상태 변경(신규→연락중→배정완료→완료), 메모 작성",
                    },
                    {
                      label: "소모임 게시판",
                      desc: "(관리자 권한자) 게시판 신설·멤버 지정·숨김 처리 / (멤버) 글·댓글·사진 작성",
                    },
                    {
                      label: "챗봇 문의 내역",
                      desc: "챗봇이 답하지 못한 문의 모아보기 및 후속 응대",
                    },
                    {
                      label: "링크 페이지",
                      desc: "인쇄물·인스타 바이오에 거는 통합 링크 + QR 코드 사용법",
                    },
                    {
                      label: "포스터 도구",
                      desc: "행사 정보 입력 → AI 프롬프트 받기 → 외부 AI 도구로 이미지 만들기 → 한글·로고·QR 자동 합성",
                    },
                  ]}
                />
              </Accordion>

              <Accordion title="⛪ 교역자 전용" defaultOpen>
                <TrainingList
                  items={[
                    {
                      label: "주보",
                      desc: "5개 탭 입력 폼 + 주보 마스터 사용법, 실시간 미리보기 확인, PDF 자동 생성",
                    },
                    {
                      label: "교회 일정 캘린더",
                      desc: "일정 등록(시작시간만 필수), 알림톡 발송 대상 체크, 다가오는 일정 위젯 확인",
                    },
                    {
                      label: "설교 요약 (AI)",
                      desc: "영상 선택 → AI 요약 생성 → 공지사항으로 저장",
                    },
                    {
                      label: "쇼츠 자동화",
                      desc: '설교 영상에서 "쇼츠 생성" 버튼 실행 → 검수 후 업로드',
                    },
                  ]}
                />
              </Accordion>

              <Accordion title="📚 공통 학습 자료">
                <Ul>
                  <li>
                    관리자 페이지 안의 <strong>/admin/guide</strong> — 단계별
                    사용설명서 + &ldquo;투어 시작&rdquo; 버튼(16단계 화면 안내)
                  </li>
                  <li>모르는 기능이 있을 때 가장 먼저 들어가 볼 곳</li>
                </Ul>
              </Accordion>
            </div>
          </Section>

          <p className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
            본 문서는 임원회의 보고용 초안. 의견 반영 후 확정.
          </p>
        </article>
      </Container>
    </>
  );
}

/* ─────────────────────────────────────────────
 *  내부 컴포넌트
 * ───────────────────────────────────────────── */

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-church-gold">
          Section {number}
        </span>
      </div>
      <h2 className="mb-5 text-xl font-bold tracking-tight text-gray-900 md:text-2xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Accordion({
  title,
  badge,
  defaultOpen,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group rounded-xl border border-gray-200 bg-white open:bg-gray-50/60 open:shadow-sm transition-colors"
      {...(defaultOpen ? { open: true } : {})}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-4 text-left [&::-webkit-details-marker]:hidden">
        <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900 sm:text-base">
          <span>{title}</span>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-church-gold/30 bg-church-gold/10 px-2 py-0.5 text-[11px] font-medium text-church-gold">
              ✨ {badge}
            </span>
          )}
        </h3>
        <ChevronDown
          size={18}
          className="shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-gray-200 px-4 py-4 text-sm leading-relaxed text-gray-700">
        {children}
      </div>
    </details>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

function MenuList({
  items,
}: {
  items: { label: string; desc: string }[];
}) {
  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
      {items.map((it) => (
        <li key={it.label} className="px-3 py-2.5">
          <p className="text-sm font-semibold text-gray-900">{it.label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600 sm:text-sm">
            {it.desc}
          </p>
        </li>
      ))}
    </ul>
  );
}

function TrainingList({
  items,
}: {
  items: { label: string; desc: string }[];
}) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li
          key={it.label}
          className="rounded-lg border border-gray-100 bg-white px-3 py-2.5"
        >
          <p className="text-sm font-semibold text-gray-900">{it.label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-gray-600 sm:text-sm">
            {it.desc}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* ─────────────────────────────────────────────
 *  데이터
 * ───────────────────────────────────────────── */

const COMPARISON: { label: string; wix: string; self: string }[] = [
  {
    label: "비용",
    wix: "연 수십만 원 (유료 플랜)",
    self: "사실상 0원",
  },
  {
    label: "콘텐츠 관리",
    wix: "Wix 에디터 안에서만 가능",
    self: "우리 입맛대로 만든 관리자 페이지",
  },
  {
    label: "모바일 사용성",
    wix: "일반 웹사이트 수준",
    self: "앱처럼 쓰는 느낌 (하단 탭바, 풀스크린 메뉴)",
  },
  {
    label: "AI 기능",
    wix: "없음",
    self: "챗봇·설교 요약·포스터 도우미",
  },
  {
    label: "알림 / 자동화",
    wix: "없음",
    self: "카카오 알림톡, 설교/블로그 자동 가져오기",
  },
  {
    label: "데이터",
    wix: "Wix가 보유",
    self: "우리 교회가 직접 보유 — 언제든 이전 가능",
  },
];
