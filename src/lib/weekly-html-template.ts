import type { Weekly } from "@/types/notice";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(str: string | null | undefined): string {
  if (!str) return "";
  return esc(str).replace(/\n/g, "<br>");
}

function dot(left: string, right: string): string {
  return `<tr>
    <td class="dot-left">${esc(left)}</td>
    <td class="dot-cell"></td>
    <td class="dot-right">${esc(right)}</td>
  </tr>`;
}

function buildFrontPage(w: Weekly): string {
  const sp = w.special_praise ?? { part1: { song: "", choir: "" }, part2: { song: "", choir: "" } };
  const om = w.offering_members ?? { p1: "", p2: "", p3: "" };

  const dateStr = w.date
    ? (() => {
        const d = new Date(w.date + "T00:00:00");
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
      })()
    : "";

  const servants = w.servants_text
    ? w.servants_text
        .split("\n")
        .map((line) => {
          const [label, ...rest] = line.split(":");
          if (rest.length) {
            return `<tr><td class="sv-label">${esc(label.trim())}</td><td class="sv-val">${esc(rest.join(":").trim())}</td></tr>`;
          }
          return `<tr><td colspan="2">${esc(line)}</td></tr>`;
        })
        .join("")
    : "";

  return `
<div class="page front-page">
  <!-- 헤더 -->
  <div class="header">
    <div class="header-left">
      <div class="church-vision">우리 교회 5대 비전</div>
      <div class="vision-content">
        <div class="vision-line">▶ 말씀과 기도의 교회</div>
        <div class="vision-line">▶ 찬양과 경배의 교회</div>
        <div class="vision-line">▶ 전도와 선교의 교회</div>
        <div class="vision-line">▶ 봉사와 섬김의 교회</div>
        <div class="vision-line">▶ 교육과 훈련의 교회</div>
      </div>
    </div>
    <div class="header-center">
      <div class="edition">${w.volume ?? ""}권 ${w.issue ?? ""}호 • ${dateStr}</div>
      <div class="church-name-kr">명성비전교회</div>
      <div class="church-name-en">MYUNGSUNG VISION CHURCH</div>
      <div class="church-address">서울특별시 구역번호 • 전화: (02) 534-0691 • msvch.org</div>
      <div class="service-times">
        <span>1부 오전 8시</span>
        <span class="divider">/</span>
        <span>2부 오전 10시</span>
        <span class="divider">/</span>
        <span>3부 낮 12시</span>
      </div>
    </div>
  </div>

  <!-- 본문 2단 -->
  <div class="body-columns">
    <!-- 좌측: 주일예배 순서 -->
    <div class="col-left">
      <div class="section-title">주일예배</div>
      <div class="worship-subtitle">인도: 1부 • 이 전도사 / 2·3부 이장재 목사</div>

      <table class="dot-table">
        ${dot("예배의 부름", "다 함 께")}
        ${dot("주기도문 창화", "다 함 께")}
        ${dot("감사와 찬양", "다 함 께")}
        ${dot("기 도", "다 함 께")}
        ${dot("신 앙 고 백", "사도신경")}
        ${dot("찬 송", esc(w.hymn_number ?? "") + "번")}
        ${dot("고백과 감사의 기도", "다 함 께")}
        ${dot("봉 헌 및 기 도", "헌금은 입구 헌금함에 드리시기 바랍니다")}
        ${dot("성 경 봉 독", esc(w.scripture ?? ""))}
      </table>

      ${sp.part1.song ? `<table class="dot-table"><tr><td class="dot-left">특 별 찬 양</td><td class="dot-cell"></td><td class="dot-right">1부 ${esc(sp.part1.song)}, ${esc(sp.part1.choir)}</td></tr></table>` : ""}
      ${sp.part2.song ? `<table class="dot-table"><tr><td class="dot-left"></td><td class="dot-cell"></td><td class="dot-right">2부 ${esc(sp.part2.song)}, ${esc(sp.part2.choir)}</td></tr></table>` : ""}

      <div class="sermon-box">
        <table class="dot-table">
          ${dot("말 씀", `"${esc(w.sermon_title ?? "")}"  ${esc(w.sermon_pastor ?? "")} 목사`)}
          ${dot("결단의 찬송", (w.closing_hymn ?? "") + "장")}
          ${dot("교 회 소 식", "다 함 께")}
          ${dot("성도의 교제", "다 함 께")}
          ${dot("축 도", "")}
          ${dot("후 주", "")}
        </table>
      </div>

      ${w.weekly_verse ? `
      <div class="verse-box">
        <div class="verse-label">※ 금주 입술말씀</div>
        <div class="verse-text">${nl2br(w.weekly_verse)}</div>
      </div>` : ""}

      <!-- 헌금위원 -->
      <div class="offering-section">
        <div class="offering-title">다음 주 기도 (헌금위원)</div>
        <table class="offering-table">
          <tr>
            <td class="offering-part">1부</td>
            <td>${esc(om.p1)}</td>
          </tr>
          <tr>
            <td class="offering-part">2부</td>
            <td>${esc(om.p2)}</td>
          </tr>
          <tr>
            <td class="offering-part">3부</td>
            <td>${esc(om.p3)}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- 우측: 섬기는 분들 + 후원하는 분들 -->
    <div class="col-right">
      ${servants ? `
      <div class="section-title">섬기는 분들</div>
      <table class="servants-table">${servants}</table>
      ` : ""}

      <div class="section-title supporters-title">우리가 후원하는 분들</div>
      <div class="supporters-note">（해외선교사 / 국내선교사）</div>
    </div>
  </div>
</div>`;
}

function buildBackPage(w: Weekly): string {
  const af = w.afternoon_service ?? { scripture: "", title: "", pastor: "" };
  const wed = w.wednesday_service ?? { scripture: "", title: "" };
  const om = w.offering_members ?? { p1: "", p2: "", p3: "" };
  const dawn = w.dawn_readings ?? [];
  const prayers = w.prayer_items ?? [];

  // Dawn readings: 2 entries per row (4 columns)
  const dawnRows: string[] = [];
  for (let i = 0; i < dawn.length; i += 2) {
    const a = dawn[i];
    const b = dawn[i + 1];
    dawnRows.push(`<tr>
      <td class="dn-d">${esc(a.date)}</td>
      <td class="dn-p">${esc(a.passage)}</td>
      ${b ? `<td class="dn-d">${esc(b.date)}</td><td class="dn-p">${esc(b.passage)}</td>` : "<td></td><td></td>"}
    </tr>`);
  }

  // Prayer items: split into 2 columns
  const half = Math.ceil(prayers.length / 2);
  const leftPrayers = prayers
    .slice(0, half)
    .map((p, i) => `<div class="pr-item"><b>${i + 1}.</b> ${nl2br(p.text)}</div>`)
    .join("");
  const rightPrayers = prayers
    .slice(half)
    .map((p, i) => `<div class="pr-item"><b>${i + half + 1}.</b> ${nl2br(p.text)}</div>`)
    .join("");

  return `
<div class="page back-page">
  <div class="back-grid">

    <!-- ── 왼쪽 컬럼 ── -->
    <div class="back-left">

      <div class="b-section">
        <div class="b-title">주일오후 찬양예배</div>
        <div class="b-sub">오후 2시30분 / 인도: 이장재 목사</div>
        <table class="dot-table">
          <tr><td class="dot-left">기 도</td><td class="dot-cell"></td><td class="dot-right">다 함께</td></tr>
          ${dot("성경봉독", af.scripture)}
          ${dot("말 씀", `"${esc(af.title)}"  ${esc(af.pastor)} 목사`)}
          <tr><td class="dot-left">찬 송</td><td class="dot-cell"></td><td class="dot-right">다 함께</td></tr>
          <tr><td class="dot-left">광 고</td><td class="dot-cell"></td><td class="dot-right">인도자</td></tr>
        </table>
      </div>

      <div class="b-section">
        <div class="b-title">수요예배</div>
        <div class="b-sub">저녁 7시30분 / 인도: 이장재 목사</div>
        <table class="dot-table">
          ${dot("성경봉독", wed.scripture)}
          ${dot("특 강", `"${esc(wed.title)}"`)}
          <tr><td class="dot-left">찬 송</td><td class="dot-cell"></td><td class="dot-right">다 함께</td></tr>
          <tr><td class="dot-left">광 고</td><td class="dot-cell"></td><td class="dot-right">인도자</td></tr>
        </table>
      </div>

      <div class="b-section">
        <div class="b-title">다음 주 기도 / 헌금위원</div>
        <table class="oh-table">
          <thead><tr><th>부서</th><th>헌금위원</th></tr></thead>
          <tbody>
            <tr><td class="oh-part">1부</td><td>${esc(om.p1)}</td></tr>
            <tr><td class="oh-part">2부</td><td>${esc(om.p2)}</td></tr>
            <tr><td class="oh-part">3부</td><td>${esc(om.p3)}</td></tr>
          </tbody>
        </table>
      </div>

      ${dawn.length > 0 ? `
      <div class="b-section">
        <div class="b-title">새벽예배（신앙일기）</div>
        <table class="dawn2">
          ${dawnRows.join("")}
        </table>
      </div>` : ""}

      ${prayers.length > 0 ? `
      <div class="b-section">
        <div class="b-title">교회공동체 기도제목</div>
        <div class="pr-cols">
          <div class="pr-col">${leftPrayers}</div>
          <div class="pr-col">${rightPrayers}</div>
        </div>
      </div>` : ""}

      <div class="b-section">
        <div class="b-title">예배모임 안내</div>
        <table class="ws-table">
          <tr><td>주일 1부</td><td>오전 8시</td><td>본 당</td><td></td><td></td><td></td></tr>
          <tr><td>주일 2부</td><td>오전 10시</td><td>이 동 부</td><td>교육관 2층</td><td></td><td></td></tr>
          <tr><td>주일 3부</td><td>낮 12시</td><td>본 당</td><td></td><td></td><td></td></tr>
          <tr><td>주일오후 찬양</td><td>오후 2시30분</td><td>본 당</td><td>청년부</td><td>토요일</td><td>7시30분</td></tr>
          <tr><td>금요기도회</td><td>저녁 8시30분</td><td>본 당</td><td></td><td></td><td></td></tr>
          <tr><td>새벽기도회</td><td colspan="5">오전 6시 (월~금,토) / 주일 7시30분</td></tr>
        </table>
        <div class="ws-note">※ 석강 결석시 교역자에게 연락하여 주십시오.</div>
      </div>

    </div>

    <!-- ── 중간 컬럼: 소그룹 목장 ── -->
    <div class="back-mid">
      <div class="b-title">소그룹 목장</div>
      ${w.sogroup_text
        ? `<div class="sogroup-text">${nl2br(w.sogroup_text)}</div>`
        : `<div class="sogroup-empty">（소그룹 목장 정보가 없습니다）</div>`}
    </div>

    <!-- ── 오른쪽 컬럼: 향기로운 예물 ── -->
    <div class="back-right">
      <div class="b-title">향기로운 예물</div>
      ${w.offering_list_text
        ? `<div class="offering-text">${nl2br(w.offering_list_text)}</div>`
        : ""}
    </div>

  </div>
</div>`;
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=block');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Noto Sans KR', sans-serif;
    font-size: 8.5pt;
    color: #111;
    background: white;
  }

  @page {
    size: A4;
    margin: 0;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 7mm 8mm;
    page-break-after: always;
    position: relative;
  }

  /* ── 앞면 헤더 ── */
  .header {
    display: flex;
    gap: 6mm;
    border-bottom: 2px solid #333;
    padding-bottom: 3mm;
    margin-bottom: 3mm;
  }
  .header-left {
    min-width: 42mm;
    border-right: 1px solid #aaa;
    padding-right: 4mm;
  }
  .church-vision {
    font-size: 7.5pt;
    font-weight: 700;
    margin-bottom: 1.5mm;
    color: #333;
  }
  .vision-line {
    font-size: 6.5pt;
    line-height: 1.6;
    color: #444;
  }
  .header-center {
    flex: 1;
    text-align: center;
  }
  .edition {
    font-size: 7pt;
    color: #555;
    margin-bottom: 1mm;
  }
  .church-name-kr {
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: 2px;
    color: #111;
  }
  .church-name-en {
    font-size: 7pt;
    letter-spacing: 1px;
    color: #555;
    margin-bottom: 1mm;
  }
  .church-address {
    font-size: 6.5pt;
    color: #666;
    margin-bottom: 1.5mm;
  }
  .service-times {
    font-size: 8pt;
    font-weight: 500;
  }
  .service-times .divider { margin: 0 2mm; color: #999; }

  /* ── 본문 2단 ── */
  .body-columns {
    display: flex;
    gap: 5mm;
  }
  .col-left {
    flex: 0 0 112mm;
  }
  .col-right {
    flex: 1;
    border-left: 1px solid #ccc;
    padding-left: 4mm;
  }

  /* ── 섹션 제목 ── */
  .section-title {
    font-size: 10pt;
    font-weight: 700;
    border-bottom: 2px solid #333;
    padding-bottom: 1mm;
    margin-bottom: 2mm;
    margin-top: 3mm;
  }
  .worship-subtitle {
    font-size: 6.5pt;
    color: #555;
    margin-bottom: 2mm;
  }

  /* ── 점선 테이블 ── */
  .dot-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1.5mm;
  }
  .dot-table .dot-left {
    white-space: nowrap;
    font-size: 8pt;
    padding: 0.8mm 1mm 0.8mm 0;
    vertical-align: middle;
    width: 30%;
  }
  .dot-table .dot-cell {
    border-bottom: 1px dotted #888;
    width: 100%;
  }
  .dot-table .dot-right {
    white-space: nowrap;
    font-size: 8pt;
    padding: 0.8mm 0 0.8mm 1mm;
    text-align: right;
    vertical-align: middle;
    width: 38%;
  }

  /* ── 설교 박스 ── */
  .sermon-box {
    border-top: 1px solid #999;
    margin-top: 1.5mm;
    padding-top: 1mm;
  }

  /* ── 입술말씀 ── */
  .verse-box {
    border: 1px solid #aaa;
    padding: 2mm 3mm;
    margin-top: 2mm;
    background: #fafafa;
  }
  .verse-label {
    font-size: 7pt;
    font-weight: 700;
    margin-bottom: 1mm;
  }
  .verse-text {
    font-size: 7.5pt;
    line-height: 1.5;
  }

  /* ── 헌금위원 ── */
  .offering-section {
    margin-top: 3mm;
    border-top: 1px solid #ccc;
    padding-top: 2mm;
  }
  .offering-title {
    font-size: 7.5pt;
    font-weight: 700;
    margin-bottom: 1.5mm;
  }
  .offering-table { border-collapse: collapse; width: 100%; }
  .offering-table td { font-size: 7.5pt; padding: 0.5mm 2mm; }
  .offering-part { font-weight: 500; width: 10mm; }

  /* ── 섬기는 분들 ── */
  .servants-table { border-collapse: collapse; width: 100%; }
  .servants-table td { font-size: 7.5pt; padding: 0.6mm 1mm; vertical-align: top; }
  .sv-label { font-weight: 500; white-space: nowrap; width: 20mm; color: #444; }
  .sv-val { }

  .supporters-title { margin-top: 4mm; }
  .supporters-note { font-size: 6.5pt; color: #666; margin-bottom: 2mm; }

  /* ── 뒷면 3단 그리드 ── */
  .back-grid {
    display: grid;
    grid-template-columns: 72mm 76mm 1fr;
    gap: 0 3.5mm;
    height: calc(297mm - 14mm);
  }
  .back-left {
    border-right: 1px solid #ccc;
    padding-right: 3mm;
    overflow: hidden;
  }
  .back-mid {
    border-right: 1px solid #ccc;
    padding: 0 3mm;
    overflow: hidden;
  }
  .back-right {
    padding-left: 0;
    overflow: hidden;
  }

  /* ── 뒷면 섹션 공통 ── */
  .b-section { margin-bottom: 2.5mm; }
  .b-title {
    font-size: 8.5pt;
    font-weight: 700;
    border-bottom: 1.5px solid #333;
    padding-bottom: 0.8mm;
    margin-bottom: 1.5mm;
  }
  .b-sub {
    font-size: 6.5pt;
    color: #555;
    margin-bottom: 1mm;
  }

  /* ── 헌금위원 테이블 ── */
  .oh-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 7pt;
  }
  .oh-table th {
    font-size: 6.5pt;
    font-weight: 600;
    border-bottom: 1px solid #bbb;
    padding: 0.5mm 1mm;
    text-align: left;
    color: #444;
  }
  .oh-table td { padding: 0.5mm 1mm; }
  .oh-part { font-weight: 600; width: 8mm; color: #333; }

  /* ── 새벽예배 2열 ── */
  .dawn2 { border-collapse: collapse; width: 100%; }
  .dawn2 td { font-size: 6.5pt; padding: 0.4mm 1mm; border-bottom: 1px solid #eee; }
  .dn-d { font-weight: 500; white-space: nowrap; width: 18mm; color: #333; }
  .dn-p { }

  /* ── 기도제목 2열 ── */
  .pr-cols { display: flex; gap: 3mm; }
  .pr-col { flex: 1; }
  .pr-item {
    font-size: 6.5pt;
    line-height: 1.45;
    margin-bottom: 1mm;
  }

  /* ── 예배모임 안내 ── */
  .ws-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 6.5pt;
  }
  .ws-table td {
    padding: 0.5mm 1mm;
    border: 1px solid #ddd;
    white-space: nowrap;
  }
  .ws-note {
    font-size: 6pt;
    color: #666;
    margin-top: 1mm;
  }

  /* ── 소그룹 목장 ── */
  .sogroup-text {
    font-size: 6pt;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-all;
  }
  .sogroup-empty {
    font-size: 7pt;
    color: #aaa;
    margin-top: 2mm;
  }

  /* ── 향기로운 예물 ── */
  .offering-text {
    font-size: 6.5pt;
    line-height: 1.55;
    word-break: break-all;
  }
`;

export function buildWeeklyHtml(w: Weekly): string {
  const front = buildFrontPage(w);
  const back = buildBackPage(w);

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${CSS}</style>
</head>
<body>
  ${front}
  ${back}
</body>
</html>`;
}
