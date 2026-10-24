import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight, ArrowLeftRight, Check, Clock3, Download, FileText, FolderOpen, ListChecks, MessageSquare, Paperclip, ShieldCheck, Table2 } from "lucide-react";
import LessonDeck from "@/components/ai-course/lesson/LessonDeck";
import CopyLessonPrompt from "@/components/ai-course/lesson/CopyLessonPrompt";
import { lessonNotice, lessonPrompts, weekOneSlides } from "@/components/ai-course/lesson/week-one";
import styles from "@/components/ai-course/lesson/lesson.module.css";

export const metadata: Metadata = {
  title: "AI 활용 1주차 · 준비표와 안내문 만들기",
  description: "자료 첨부부터 요청, 원문 대조, 수정, 저장까지 함께 해보는 1주차 발표 자료입니다.",
  alternates: { canonical: "https://www.msvch.org/ai-course/week-1" },
  robots: { index: false, follow: false },
};
const materials = "/ai-course/week-1/materials";

function Slide({ index, children, lead, hero = false }: { index: number; children: ReactNode; lead?: string; hero?: boolean }) {
  return <div className={`${styles.canvas} ${hero ? styles.hero : ""}`}>
    <p className={styles.eyebrow}>{index === 0 ? "AI 활용 1주차" : weekOneSlides[index].phase}</p>
    <h1 id={`lesson-title-${index}`} className={styles.title}>{weekOneSlides[index].title}</h1>
    {lead && <p className={styles.lead}>{lead}</p>}
    <div className={styles.content}>{children}</div>
  </div>;
}

export default function WeekOneLessonPage() {
  return <LessonDeck slides={weekOneSlides}>
    <Slide index={0} hero lead="파일을 첨부하고, 결과를 확인하고 수정한 뒤 저장하는 연습입니다.">
      <div className={styles.heroFlow}><span>자료</span><ArrowRight size={22} aria-hidden /><span>요청</span><ArrowRight size={22} aria-hidden /><span>확인</span><ArrowRight size={22} aria-hidden /><span>수정</span><ArrowRight size={22} aria-hidden /><span>저장</span></div>
      <p className={styles.heroHint}>60분 · 방향키로 이동 · 상단에서 전체화면</p>
    </Slide>

    <Slide index={1} lead="모임 메모와 현황표를 사용해 준비표와 안내문 초안을 만듭니다.">
      <div className={styles.twoColumns}>
        <section className={styles.outcome}><Table2 size={32} aria-hidden /><h2>준비표</h2><p>할 일, 담당자, 기한 정리</p><div className={styles.miniTable} aria-label="준비표 형식 예시"><div><span>할 일</span><span>담당</span><span>기한</span></div><div><span>장비 확인</span><span>송민준</span><span>11/11</span></div><div><span>자료 취합</span><span>서하늘</span><span>11/12</span></div></div></section>
        <section className={styles.outcome}><MessageSquare size={32} aria-hidden /><h2>안내문 초안</h2><p>모임 일정과 확정된 준비 사항 안내</p><blockquote className={styles.notice}>모임은 11월 14일 오후 2시, 배움방 B에서 진행합니다.</blockquote></section>
      </div>
      <p className={styles.caption}>가상 자료로 만든 형식 예시입니다. 실제 AI 실행 화면이나 실제 모임 공지가 아닙니다.</p>
    </Slide>

    <Slide index={2} lead="사용 중인 화면에서 아래 기능의 위치를 확인합니다.">
      <ol className={styles.steps}><li>새 대화 시작하기</li><li>요청 입력하고 보내기</li><li>파일 첨부하고 이름 확인하기</li><li>같은 대화에서 이어서 요청하기</li></ol>
      <p className={styles.caption}>버튼 위치는 앱과 계정에 따라 다를 수 있어요. 지금 사용하는 화면에서 함께 찾습니다.</p>
    </Slide>

    <Slide index={3} lead="할 일, 참고 자료, 출력 형식, 주의할 점을 알려줍니다.">
      <div className={styles.fourGrid}>
        <div className={styles.criterion}><ListChecks size={28} aria-hidden /><b>할 일</b><p>모임 준비표를 만들어줘.</p></div>
        <div className={styles.criterion}><Paperclip size={28} aria-hidden /><b>참고 자료</b><p>첨부한 메모와 현황표를 사용해줘.</p></div>
        <div className={styles.criterion}><Table2 size={28} aria-hidden /><b>출력 형식</b><p>담당자와 기한을 표로 정리해줘.</p></div>
        <div className={styles.criterion}><ShieldCheck size={28} aria-hidden /><b>주의할 점</b><p>모르는 내용은 추측하지 마.</p></div>
      </div>
      <p className={styles.caption}>네 가지를 항상 모두 채워야 하는 공식은 아닙니다. 결과에 필요한 것만 알려주세요.</p>
    </Slide>

    <Slide index={4} lead="가상 모임의 메모와 현황표입니다. 두 파일을 내려받으세요.">
      <div className={styles.twoColumns}>
        <section className={styles.file}><FileText size={38} aria-hidden /><h2>모임 메모</h2><p>모임 준비 회의에서 작성한 메모입니다.</p><a className={styles.action} href={`${materials}/meeting-notes.txt`} download="모임메모.txt"><Download size={18} aria-hidden />메모 내려받기</a></section>
        <section className={styles.file}><Table2 size={38} aria-hidden /><h2>준비 현황표</h2><p>담당자, 기한, 진행 상태를 정리한 표입니다.</p><a className={styles.action} href={`${materials}/task-status.csv`} download="준비현황.csv"><Download size={18} aria-hidden />현황표 내려받기</a></section>
      </div>
      <div className={styles.resourceLinks}><a href={`${materials}/student-kit.zip`} download="1주차-수강생자료.zip">수강생 자료 한 번에 받기</a><a href={`${materials}/paste-materials.txt`} download="붙여넣기용자료.txt">첨부가 어려울 때: 텍스트 사본</a></div>
      <p className={styles.caption}>모든 이름과 일정은 가상 실습 자료입니다. 실제 강의 일정이 아닙니다.</p>
    </Slide>

    <Slide index={5}>
      <blockquote className={styles.promptExcerpt}>두 자료를 보고 모임 준비표를 만들어줘.{"\n"}할 일, 담당자, 기한, 상태, 근거를 표로 정리해줘.{"\n"}자료에 없는 내용은 ‘확인 필요’로 적어줘.{"\n"}두 자료가 다르면 차이를 알려줘.</blockquote>
      <CopyLessonPrompt text={lessonPrompts.first} />
      <p className={styles.caption}>화면은 핵심 문장입니다. 실습에는 전체 요청문을 복사해 사용하세요.</p>
    </Slide>

    <Slide index={6}>
      <div className={styles.exercise}>
        <div><p className={styles.exerciseBadge}><Clock3 size={25} aria-hidden />12분 실습</p><ol className={styles.steps}><li>새 대화를 엽니다.</li><li>파일 두 개를 첨부합니다.</li><li>첫 요청문을 보냅니다.</li></ol></div>
        <section className={styles.outcome}><h2>추가로 해볼 것</h2><p>표의 담당자와 기한을 원문에서 찾아보세요.</p><a href={`${materials}/student-kit.zip`} download="1주차-수강생자료.zip" className={styles.subtleLink}>실습지와 자료 내려받기</a></section>
      </div>
    </Slide>

    <Slide index={7} lead="모임 메모에는 24명, 현황표에는 20명으로 적혀 있습니다.">
      <div className={styles.comparison}><div><strong>24<small>명</small></strong><p>모임 메모</p></div><ArrowLeftRight size={40} aria-hidden /><div><strong>20<small>명</small></strong><p>준비 현황표</p></div></div>
      <p className={styles.lead}>AI가 적은 인원수와 근거를 원문에서 확인해 보세요.</p>
    </Slide>

    <Slide index={8}>
      <div className={styles.threeColumns}>
        <section className={styles.finding}><h2>내용이 다른 항목</h2><p>인원: <b>20명 / 24명</b><br />안내문 담당: <b>박지우 / 서하늘</b></p></section>
        <section className={styles.finding}><h2>정보가 없는 항목</h2><p>다과 담당자와 기한은 <b>정하지 않았습니다.</b></p></section>
        <section className={styles.finding}><h2>확정되지 않은 항목</h2><p>좌석 배치도를 이지안에게 부탁하자는 의견만 나왔고, <b>배정은 확정되지 않았습니다.</b></p></section>
      </div>
      <p className={styles.lead}>자료가 서로 다르거나 정보가 없으면 ‘확인 필요’로 표시합니다.</p>
    </Slide>

    <Slide index={9}>
      <div className={styles.newFacts}><strong>24명</strong><span>최종 참가 인원</span><strong>박지우</strong><span>안내문 초안 · 11/11까지</span></div>
      <blockquote className={styles.promptExcerpt}>참가 인원과 안내문 담당을 반영해 준비표를 수정해줘.{"\n"}다과와 좌석 담당은 ‘확인 필요’로 남겨줘.{"\n"}확정된 내용으로 안내문 초안을 작성해줘.</blockquote>
      <CopyLessonPrompt text={lessonPrompts.revise} />
      <p className={styles.caption}>지금 새로 제공하는 실습용 확정 정보입니다. 처음부터 원문에 있던 정답이 아닙니다.</p>
    </Slide>

    <Slide index={10}>
      <div className={styles.twoColumns}>
        <ul className={styles.checkList}><li><Check size={28} aria-hidden />인원 24명, 담당 박지우가 반영됐나요?</li><li><Check size={28} aria-hidden />다과와 좌석 담당을 지어내지 않았나요?</li><li><Check size={28} aria-hidden />안내문은 공백·줄바꿈 포함 300자 이내인가요?</li></ul>
        <div><blockquote className={styles.notice}>{lessonNotice}</blockquote><p className={styles.caption}>검토용 안내문 예시 · 164자 · 실제 발송하지 않은 초안</p></div>
      </div>
    </Slide>

    <Slide index={11}>
      <ol className={styles.steps}><li>준비표와 안내문을 각각 저장</li><li>저장한 폴더 열기</li><li>파일 두 개를 다시 열어 확인</li></ol>
      <CopyLessonPrompt text={lessonPrompts.save} />
      <p className={styles.caption}><FolderOpen size={16} aria-hidden style={{ display: "inline", marginRight: 6 }} />파일 생성이 안 되면 내용을 복사해 텍스트 문서로 저장하세요. 대화 이름 변경은 파일 저장을 대신하지 않습니다.</p>
    </Slide>

    <Slide index={12}>
      <div className={styles.twoColumns}><ul className={styles.checkList}><li><Check size={28} aria-hidden />파일 첨부하기</li><li><Check size={28} aria-hidden />작업 요청하기</li><li><Check size={28} aria-hidden />원문과 비교하고 수정하기</li><li><Check size={28} aria-hidden />저장한 결과 다시 열기</li></ul><section className={styles.outcome}><h2>과제 · 약 20분</h2><p>본인 메모 하나로 오늘 실습을 반복하고, 요청·수정·확인한 내용을 기록해 오세요.</p><p className={styles.lead}>2주차: 프로젝트와 지침 설정</p><a href={`${materials}/student-kit.zip`} download="1주차-수강생자료.zip" className={styles.subtleLink}>실습 기록지와 수강생 자료 받기</a></section></div>
    </Slide>
  </LessonDeck>;
}
