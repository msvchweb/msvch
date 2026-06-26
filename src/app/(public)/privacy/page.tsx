import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "개인정보 처리방침",
  description:
    "명성비전교회의 개인정보 수집·이용·보관·제공·위탁에 관한 처리방침입니다.",
};

const LAST_UPDATED = "2026-05-08";

export default function PrivacyPage() {
  return (
    <>
      <PageHeader
        title="개인정보 처리방침"
        description="명성비전교회는 이용자의 개인정보를 소중히 다룹니다."
      />
      <Container className="py-10">
        <article className="mx-auto max-w-3xl space-y-8 text-gray-800 leading-relaxed">
          <p className="text-sm text-gray-500">최종 개정일: {LAST_UPDATED}</p>

          <section>
            <p>
              명성비전교회(이하 &ldquo;교회&rdquo;)는{" "}
              <strong>「개인정보 보호법」</strong> 등 관련 법령을 준수하며,
              이용자의 개인정보를 안전하게 보호하기 위해 본 처리방침을 수립·공개합니다.
            </p>
          </section>

          <Section title="1. 처리하는 개인정보 항목">
            <p>교회는 다음의 개인정보를 수집·이용합니다.</p>
            <Ul>
              <li>
                <strong>회원 가입(소셜 로그인)</strong>: 이름, 이메일, 프로필 이미지,
                인증 제공자(Google·Kakao) 식별자
              </li>
              <li>
                <strong>새가족 등록</strong>: 이름, 연락처, 생년월일, 주소(선택),
                가족관계(선택), 신앙 관련 정보(선택), 등록 동기
              </li>
              <li>
                <strong>알림톡 수신 동의</strong>: 휴대전화번호, 수신 동의 여부
              </li>
              <li>
                <strong>홈페이지 이용 기록</strong>: 접속 IP, 브라우저 정보, 접속 일시,
                서비스 이용 로그
              </li>
              <li>
                <strong>인스타그램 콘텐츠 동기화</strong>: 교회 운영 인스타그램
                계정(@msvch_main, @msvch_children, @msvch_middle, @msvch_youth)의
                <em> 공개 게시물 메타데이터(미디어 ID, 캡션, 게시 시각, 미디어 URL,
                썸네일 URL, 영구 링크)</em>
              </li>
            </Ul>
          </Section>

          <Section title="2. 개인정보의 수집·이용 목적">
            <Ul>
              <li>회원 식별, 권한 관리, 본인 확인</li>
              <li>새가족 등록 안내, 교구 배정, 양육 연락</li>
              <li>예배·교회 행사 알림 발송(알림톡, 이메일)</li>
              <li>교회 갤러리·소식 등 콘텐츠 자동 수집·게시</li>
              <li>홈페이지 운영 통계 및 보안 점검</li>
            </Ul>
          </Section>

          <Section title="3. 개인정보의 보유 및 이용 기간">
            <p>
              교회는 수집·이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다.
              다만, 다음의 경우에는 명시한 기간 동안 보관합니다.
            </p>
            <Ul>
              <li>회원 정보: 회원 탈퇴 시까지 (법령상 보관 의무가 있는 경우 그 기간)</li>
              <li>새가족 등록 정보: 등록 후 3년</li>
              <li>알림톡 수신 동의 기록: 수신 거부 시까지</li>
              <li>접속 로그·쿠키: 6개월</li>
              <li>
                인스타그램 게시물 미러링: 갤러리에 게시된 동안 보관(원본 인스타그램
                게시물이 삭제되더라도 교회 갤러리 아카이브 목적으로 보관할 수 있음)
              </li>
            </Ul>
          </Section>

          <Section title="4. 개인정보의 제3자 제공">
            <p>
              교회는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의
              경우는 예외로 합니다.
            </p>
            <Ul>
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령에 따라 제공 의무가 있는 경우</li>
            </Ul>
          </Section>

          <Section title="5. 개인정보 처리의 위탁">
            <p>
              교회는 원활한 서비스 제공을 위하여 다음과 같이 처리 업무를 위탁하고
              있습니다. 위탁받은 자가 관계 법령을 위반하지 않도록 관리·감독합니다.
            </p>
            <table className="my-3 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-300 bg-gray-50">
                  <th className="px-3 py-2 text-left">수탁자</th>
                  <th className="px-3 py-2 text-left">위탁 업무</th>
                  <th className="px-3 py-2 text-left">국가</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-gray-200">
                <tr>
                  <td className="px-3 py-2">Supabase, Inc.</td>
                  <td className="px-3 py-2">데이터베이스 호스팅, 인증, 파일 스토리지</td>
                  <td className="px-3 py-2">미국</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Vercel, Inc.</td>
                  <td className="px-3 py-2">웹사이트 호스팅, CDN</td>
                  <td className="px-3 py-2">미국</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Google LLC</td>
                  <td className="px-3 py-2">소셜 로그인, 지도, AI 기반 챗봇</td>
                  <td className="px-3 py-2">미국</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Kakao Corp.</td>
                  <td className="px-3 py-2">소셜 로그인, 알림톡 발송</td>
                  <td className="px-3 py-2">대한민국</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Meta Platforms, Inc.</td>
                  <td className="px-3 py-2">
                    인스타그램 공개 게시물 조회(Instagram Graph API)
                  </td>
                  <td className="px-3 py-2">미국</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">NAVER Corp.</td>
                  <td className="px-3 py-2">네이버 블로그 RSS 동기화</td>
                  <td className="px-3 py-2">대한민국</td>
                </tr>
              </tbody>
            </table>
          </Section>

          <Section title="6. 인스타그램 데이터의 처리">
            <p>
              교회는 교회가 직접 운영하는 인스타그램 비즈니스 계정에 한하여, 해당
              계정의 <strong>공개 게시물</strong>을 Instagram Graph API를 통해
              조회하고, 미디어 파일을 교회 스토리지에 재업로드하여 본 홈페이지
              갤러리에 게시합니다.
            </p>
            <Ul>
              <li>대상 계정: 교회가 운영·관리 권한을 보유한 인스타그램 계정에 한정</li>
              <li>
                수집 항목: 미디어 ID, 캡션, 미디어 유형, 미디어 URL, 썸네일 URL, 영구
                링크, 게시 시각, 게시 계정 사용자명
              </li>
              <li>
                저장: 인스타그램 측 미디어 URL은 일정 시간이 지나면 만료되므로, 교회
                스토리지에 사본을 저장하여 갤러리에 노출합니다.
              </li>
              <li>
                삭제: 교회 갤러리에서 해당 항목을 삭제하면 스토리지 사본도 함께
                삭제됩니다. 원본 인스타그램 게시물이 삭제되었더라도 교회 갤러리에
                게시된 사본은 별도 요청이 없는 한 보존될 수 있습니다.
              </li>
              <li>
                개인 또는 제3자 인스타그램 계정의 게시물은 본 절차의 대상이 아닙니다.
              </li>
            </Ul>
          </Section>

          <Section title="7. 쿠키 및 자동 수집 도구">
            <p>
              교회 홈페이지는 로그인 세션 유지·서비스 개선을 위해 쿠키를 사용할 수
              있습니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으며,
              이 경우 일부 서비스 이용에 제한이 있을 수 있습니다.
            </p>
          </Section>

          <Section title="8. 정보주체의 권리·의무 및 행사 방법">
            <p>이용자는 다음의 권리를 행사할 수 있습니다.</p>
            <Ul>
              <li>개인정보 열람·정정·삭제·처리정지 요구</li>
              <li>동의 철회</li>
              <li>피해 구제 요청</li>
            </Ul>
            <p>
              권리 행사는 아래 연락처로 서면, 전자우편 등을 통해 요청하실 수 있으며,
              교회는 지체 없이 조치합니다.
            </p>
          </Section>

          <Section title="9. 개인정보의 안전성 확보 조치">
            <Ul>
              <li>접근 권한 관리: 관리자 권한 분리(member·staff·admin·master)</li>
              <li>전송 구간 암호화(HTTPS)</li>
              <li>데이터베이스 행 단위 보안(RLS) 정책 적용</li>
              <li>접근 기록 보관 및 점검</li>
            </Ul>
          </Section>

          <Section title="10. 개인정보 보호책임자">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
              <p>
                <strong>개인정보 보호책임자</strong>: 명성비전교회 사무국
              </p>
              <p>주소: 서울시 동작구 사당로 16바길 9</p>
              <p>전화: 02-534-0691</p>
              <p>이메일: msvch01@naver.com</p>
            </div>
            <p className="mt-3 text-sm">
              개인정보 침해로 인한 신고·상담이 필요한 경우 아래 기관으로 문의하실 수
              있습니다.
            </p>
            <Ul>
              <li>개인정보분쟁조정위원회 (1833-6972, www.kopico.go.kr)</li>
              <li>개인정보침해신고센터 (118, privacy.kisa.or.kr)</li>
              <li>대검찰청 사이버수사과 (1301, www.spo.go.kr)</li>
              <li>경찰청 사이버수사국 (182, ecrm.cyber.go.kr)</li>
            </Ul>
          </Section>

          <Section title="11. 처리방침의 변경">
            <p>
              본 처리방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 본
              페이지를 통해 공지합니다.
            </p>
          </Section>
        </article>
      </Container>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5 text-[15px]">{children}</ul>
  );
}
