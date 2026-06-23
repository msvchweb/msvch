# PLAN — 관리자 포스터 도구: 그림체 샘플 + GPT 이미지 생성/수정 플로우

> 작성: 2026-06-23  
> 상태: 계획 문서. 아직 구현 전.  
> 범위: `/admin/posters` 포스터 도구의 그림체 선택, 샘플 이미지 참조, GPT 이미지 생성/수정 UX, footer 마무리, 공지사항 등록 플로우 개선.

---

## 0. 결정 요약

| 항목 | 결정 |
|---|---|
| 그림체 선택지 | 8개 고정: 수채화, 플랫 일러스트, 손그림 라인아트, 종이공예, 사실적 사진, 3D 미니어처, 픽셀아트, 공익광고풍 |
| 샘플 이미지 | `public/images/1Watercolor.jpg`부터 `8public.jpg`까지 사용 |
| 샘플 노출 | 그림체 선택 카드에 이미지 썸네일을 함께 표시 |
| Gemini 프롬프트 생성 | 선택된 그림체 샘플을 참고 이미지로 넣어 영문 프롬프트 생성 품질을 높임 |
| GPT 이미지 생성 | 현재 `dall-e-3` 단순 generation 대신, 참조 이미지/수정 루프가 가능한 GPT Image 계열 workflow로 전환 검토 |
| 수정 UX | 생성 결과가 마음에 들지 않을 때 자연어 수정 명령과 빠른 수정 칩 제공 |
| 마무리 단계 | 제목/본문 텍스트 입력 제거. footer 삽입/미리보기/다운로드/공지 등록만 남김 |
| 공지 등록 | 기존 `NoticeDraftModal` 흐름 유지하되, 최종 footer 합성 이미지를 공지 이미지로 등록 |

---

## 1. 현재 코드 기준

### 1.1 주요 파일

| 파일 | 현재 역할 |
|---|---|
| `src/app/admin/posters/page.tsx` | 관리자 포스터 도구 페이지 |
| `src/app/admin/posters/PostersTabs.tsx` | 프롬프트 생성 탭 / 이미지 마무리 탭 전환 |
| `src/app/admin/posters/PromptBuilder.tsx` | 입력 폼, Gemini 프롬프트 생성, OpenAI 이미지 생성 버튼, 마무리 단계로 전달 |
| `src/app/admin/posters/Finalizer.tsx` | AI 이미지 업로드/URL 로드, 제목/본문 텍스트 합성, footer 합성, PNG 다운로드, 공지 등록 모달 호출 |
| `src/app/admin/posters/NoticeDraftModal/index.tsx` | Gemini로 공지 초안 생성, 최종 이미지 2종 생성, Supabase Storage 업로드, `notices` insert |
| `src/app/api/posters/build-prompt/route.ts` | Gemini 멀티모달로 영문 이미지 프롬프트 생성 |
| `src/app/api/posters/generate-image/route.ts` | 현재 OpenAI `/v1/images/generations` + `dall-e-3` 호출 |
| `src/lib/poster-prompts.ts` | 포스터 입력 타입, 그림체/색감/분위기 등 선택지, Gemini 메타 프롬프트 |
| `src/lib/poster-footer.ts` | Canvas 기반 최종 포스터 렌더링 및 교회 footer 합성 |

### 1.2 이미 갖춰진 기반

- `build-prompt` API는 이미 `request.formData()`로 `payload`와 `reference` 이미지를 받는다.
- 참고 이미지는 서버에서 `sharp`로 768px JPEG로 압축한 뒤 `callGeminiWithFallbackMultimodal()`에 전달한다.
- 따라서 “선택한 그림체 샘플을 Gemini가 보고 프롬프트를 만들게 하는 것”은 기존 참고 이미지 경로를 재사용하면 된다.
- `public/images` 정적 파일은 Next.js에서 `/images/...` 경로로 바로 참조 가능하다.

### 1.3 바꿔야 하는 핵심

- 현재 `generate-image` API는 텍스트 프롬프트만 보내는 `dall-e-3` generation 방식이다.
- 샘플 이미지를 OpenAI 이미지 생성 단계에도 직접 참고시키려면 GPT Image 계열의 image edit/reference workflow가 필요하다.
- 공식 문서 기준으로 OpenAI Image API의 edit endpoint는 “기존 이미지 편집”, “다른 이미지를 참고한 새 이미지 생성”, “mask 기반 부분 편집”을 지원한다.
- 참고: https://platform.openai.com/docs/guides/image-generation#edit-images

---

## 2. 목표 UX

기존 2탭 구조를 단계형 흐름으로 재정리한다.

```
1. 정보 입력
   제목, 일정, 장소, 대상, 부가정보, 비율, 색감, 그림체 샘플, 분위기, 모티프
        ↓
2. 프롬프트 생성
   Gemini API가 선택한 샘플 이미지까지 참고해 영문 이미지 프롬프트 생성
        ↓
3. 이미지 생성
   GPT API가 영문 프롬프트 + 그림체 샘플을 참고해 이미지 생성
        ↓
4. 이미지 다듬기
   마음에 안 들면 수정 명령 또는 빠른 수정 칩으로 재생성/편집
        ↓
5. footer 마무리
   텍스트 입력 없이 교회 footer만 합성
        ↓
6. 공지사항 등록
   공지 초안 생성 → 이미지 업로드 → 비공개 공지 등록
```

### 2.1 단계별 버튼

| 단계 | 주요 버튼 |
|---|---|
| 정보 입력 | `프롬프트 생성` |
| 프롬프트 생성 결과 | `이미지 만들기`, `프롬프트 복사`, `다시 만들기` |
| 이미지 생성 결과 | `수정 요청`, `같은 조건으로 다시 생성`, `이 이미지로 확정` |
| 이미지 다듬기 | `수정해서 다시 만들기`, `이전 결과 보기`, `확정` |
| footer 마무리 | `PNG 다운로드`, `공지사항으로 등록` |
| 공지 등록 | `공지사항 등록`, `취소` |

---

## 3. 그림체 샘플 설계

### 3.1 새 그림체 정의

`src/lib/poster-prompts.ts`

```ts
export const ART_STYLES = [
  "watercolor",
  "flatIllustration",
  "lineArt",
  "paperCraft",
  "photoRealistic",
  "miniature3d",
  "pixelArt",
  "publicCampaign",
] as const;
```

### 3.2 라벨/프롬프트/샘플 매핑

| key | 라벨 | 샘플 파일 | 프롬프트 설명 |
|---|---|---|---|
| `watercolor` | 수채화 | `/images/1Watercolor.jpg` | soft watercolor painting, gentle pigment bleed, paper texture |
| `flatIllustration` | 플랫 일러스트 | `/images/2flat.jpg` | clean flat illustration, simple geometric forms, modern editorial layout |
| `lineArt` | 손그림 라인아트 | `/images/3line.jpg` | delicate hand-drawn line art, sparse detail, warm handmade feel |
| `paperCraft` | 종이공예 | `/images/4paper.jpg` | layered paper craft, cut paper shapes, soft shadows and tactile depth |
| `photoRealistic` | 사실적 사진 | `/images/5photo.jpg` | realistic photography, natural lighting, documentary church event feel |
| `miniature3d` | 3D 미니어처 | `/images/6miniature.jpg` | cute 3D miniature diorama, soft global illumination, toy-like scale |
| `pixelArt` | 픽셀아트 | `/images/7pixel.jpg` | pixel art poster style, crisp grid pixels, retro but clean |
| `publicCampaign` | 공익광고풍 | `/images/8public.jpg` | Korean public campaign poster style, clear symbolic visual, civic message tone |

주의:
- 실제 파일명은 `1Watercolor.jpg`로 대문자 `W`를 포함한다.
- Linux/Vercel 배포 환경은 파일명 대소문자를 구분한다.

### 3.3 UI

그림체 칩을 텍스트 버튼에서 이미지 카드형 선택지로 변경한다.

요구 상태:
- 선택됨: primary border/ring, 체크 아이콘 또는 명확한 active state
- hover: 이미지 살짝 강조, 카드 border 변화
- 모바일: 2열
- 데스크톱: 4열 또는 2열, 주변 레이아웃에 맞춰 조정
- 카드 안 텍스트는 짧게 유지하고 줄바꿈 허용

---

## 4. Gemini 프롬프트 생성 변경

### 4.1 목적

사용자가 별도로 참고 이미지를 업로드하지 않아도, 선택한 그림체의 샘플 이미지를 Gemini가 참고하게 한다.

### 4.2 구현 옵션

#### Option A — 클라이언트가 샘플 URL을 fetch해서 File로 첨부

- 장점: 기존 `reference` FormData 경로 거의 그대로 사용
- 단점: 클라이언트에서 정적 이미지를 fetch → blob 변환 필요. CORS는 same-origin이라 문제는 작음

#### Option B — 서버가 선택된 `artStyle`로 public 파일을 직접 읽음

- 장점: 클라이언트 로직 단순. 샘플 파일 변조 가능성 낮음
- 단점: route handler에서 `process.cwd()/public/images/...` 파일 접근 코드 추가 필요

권장: **Option B**

이유:
- 샘플 이미지는 사용자 입력이 아니라 서버에 포함된 고정 자산이다.
- `artStyle` enum 검증 후 매핑된 파일만 읽으면 안전하다.
- 기존 사용자가 업로드하는 참고 이미지와 “내장 그림체 샘플”을 구분할 수 있다.

### 4.3 메타 프롬프트 변경

`buildMetaPromptForGemini(input, hasReferenceImage)`는 현재 참고 이미지 1장만 전제한다. 다음 중 하나로 확장한다.

권장안:

```ts
buildMetaPromptForGemini(input, {
  hasUserReferenceImage: boolean;
  hasStyleSampleImage: boolean;
})
```

프롬프트에는 다음 취지를 추가한다.

- 내장 그림체 샘플은 구체적 콘텐츠 복제가 아니라 “스타일, 질감, 색 처리, 레이아웃 감각” 참고용이다.
- 샘플 이미지 안의 텍스트, 로고, 인물, 고유 사물은 복제하지 않는다.
- 선택한 행사 정보와 교회 포스터 목적이 우선이다.

---

## 5. GPT 이미지 생성 API 변경

### 5.1 현재 상태

`src/app/api/posters/generate-image/route.ts`

- 입력: `{ prompt, ratio }`
- 호출: `POST https://api.openai.com/v1/images/generations`
- 모델: `dall-e-3`
- 반환: `imageUrl`

### 5.2 문제

- 그림체 샘플 이미지를 직접 전달할 수 없다.
- 생성된 이미지를 기준으로 “구도 유지, 색감만 변경” 같은 수정 UX를 구현하기 어렵다.
- 결과 URL은 외부 임시 URL이므로 다음 단계에서 proxy 로드를 거쳐야 한다.

### 5.3 목표 API

`POST /api/posters/generate-image`

입력은 multipart 또는 JSON + 서버 샘플 참조 방식 중 택한다.

권장 입력:

```ts
{
  prompt: string;
  ratio: "1:1" | "9:16" | "a4";
  artStyle: ArtStyle;
  mode: "generate" | "revise";
  revisionInstruction?: string;
  sourceImageUrl?: string;
}
```

### 5.4 생성 모드

`mode: "generate"`

- 영문 프롬프트
- 선택된 그림체 샘플 이미지
- 비율
- footer 하단 여백 지시

위 정보를 이용해 새 이미지를 생성한다.

### 5.5 수정 모드

`mode: "revise"`

- 현재 선택된 이미지
- 그림체 샘플 이미지
- 원본 영문 프롬프트
- 사용자의 수정 명령

위 정보를 함께 사용해 “현재 이미지를 기반으로 수정된 새 이미지”를 만든다.

수정 프롬프트 원칙:
- Keep the same overall composition unless the user explicitly asks to change it.
- Preserve the reserved empty footer band.
- Do not add readable text, letters, numbers, logos, or watermarks.
- Apply only the requested change.

### 5.6 반환 형태

가급적 `imageUrl` 대신 base64를 받아 서버/클라이언트에서 Blob URL로 다룬다.

권장 반환:

```ts
{
  imageBase64: string;
  mimeType: "image/png";
  revisedPrompt?: string;
}
```

이유:
- 외부 URL 만료/CORS 이슈를 줄인다.
- Finalizer에 바로 넘길 수 있다.
- 공지 등록 시 Storage 업로드 전까지 중간 이미지를 클라이언트에서 안정적으로 유지할 수 있다.

---

## 6. 이미지 수정 UX

### 6.1 새 UI 블록: 이미지 다듬기

이미지가 생성된 뒤 결과 카드 아래에 표시한다.

구성:
- 현재 이미지 미리보기
- 수정 명령 textarea
- 빠른 수정 칩
- `수정해서 다시 만들기`
- `같은 조건으로 다시 생성`
- `이 이미지로 확정`
- 생성 히스토리 썸네일

### 6.2 빠른 수정 칩

기본 칩:

- 더 밝게
- 더 따뜻하게
- 더 단순하게
- 인물 제거
- 텍스트 제거
- 하단 footer 공간 더 비우기
- 교회 행사 느낌 강화
- 배경을 덜 복잡하게

각 칩은 textarea에 문장을 삽입하거나 바로 수정 요청을 실행한다.

예:

```ts
{
  label: "하단 footer 공간 더 비우기",
  instruction:
    "Reserve more clear empty space at the bottom for the church footer. Do not place any subject, text, face, or important detail in the bottom band."
}
```

### 6.3 히스토리

클라이언트 state로만 관리한다.

```ts
interface GeneratedPosterImage {
  id: string;
  imageUrl: string; // blob URL 또는 data URL
  source: "generate" | "revise";
  instruction?: string;
  createdAt: number;
}
```

Non-goal:
- 이번 작업에서는 생성 히스토리를 DB에 저장하지 않는다.
- 브라우저 새로고침 후 복원하지 않는다.

---

## 7. footer 마무리 단순화

### 7.1 제거 대상

`Finalizer.tsx`의 다음 UI를 제거한다.

- 제목 입력
- 부제목 입력
- 제목 위치
- 제목 크기
- 부제목 위치
- 부제목 크기
- 텍스트 색상
- 텍스트 그림자

### 7.2 유지 대상

- 비율 선택
- AI 이미지 입력 파일 업로드
- AI 이미지 입력 URL 붙여넣기
- footer 표시 여부
- PNG 다운로드
- 공지사항 등록
- 미리보기 canvas

### 7.3 렌더링 변경

`renderPoster()`는 현재 제목/본문 텍스트를 항상 받을 수 있는 구조다. footer만 삽입할 때는 다음 중 하나를 선택한다.

권장:
- `title: ""`
- `bodyText: ""`
- 기존 `wrapText()`가 빈 텍스트를 무시하므로 추가 변경 최소화

선택:
- `renderPoster()`에 `showTextOverlay?: boolean` 옵션 추가

권장안은 기존 함수 변경을 최소화한다.

---

## 8. 공지사항 등록 플로우

### 8.1 현재 상태

`NoticeDraftModal`은 다음 일을 한다.

1. `/api/admin/posters/draft-notice` 호출
2. Gemini로 공지 제목/본문/category JSON 생성
3. 메인 포스터 canvas 생성
4. 16:9 썸네일 canvas 생성
5. `blog-images` 버킷에 업로드
6. `notices` 테이블에 `is_public: false`로 insert
7. `/admin/notices`로 이동

### 8.2 변경 원칙

- 공지 초안 생성은 유지한다.
- 저장은 기존처럼 비공개 등록한다.
- 이미지 렌더링 시 제목/본문 텍스트는 합성하지 않는다.
- footer는 사용자가 켠 경우에만 합성한다.

### 8.3 주의

`NoticeDraftModal`의 미리보기는 현재 `sharedData.title`, `sharedData.bodyText`, `textSettings`를 사용한다. footer-only로 바꿀 때 다음을 맞춰야 한다.

- `textSettings` prop 제거 또는 무시
- `renderPoster()` 호출 시 `title: ""`, `bodyText: ""`
- 공지 제목/본문은 draft 데이터만 사용

---

## 9. 구현 단계

### Phase 1 — 그림체 샘플 UI

- [ ] `poster-prompts.ts`의 `ART_STYLES` 8개로 교체
- [ ] `ART_STYLE_DEFS`에 `sampleSrc` 또는 별도 `ART_STYLE_SAMPLE_DEFS` 추가
- [ ] `PromptBuilder.tsx` 그림체 선택 UI를 이미지 카드형으로 변경
- [ ] 샘플 이미지 alt 텍스트 정리
- [ ] 기본값은 `watercolor` 유지

검증:
- [ ] `/admin/posters`에서 8개 샘플이 모두 표시된다.
- [ ] `1Watercolor.jpg` 대소문자 경로가 맞다.
- [ ] 모바일에서 카드 텍스트가 넘치지 않는다.

### Phase 2 — Gemini가 내장 샘플 참고

- [ ] `build-prompt` payload에 `artStyle`은 이미 있으므로 서버에서 샘플 파일 매핑
- [ ] 서버에서 `public/images/...`를 읽어 base64 변환
- [ ] 사용자가 업로드한 reference가 있을 때 우선순위/결합 규칙 결정
- [ ] `buildMetaPromptForGemini()`에 내장 샘플 참고 지시 추가
- [ ] `buildKoreanSummary()`에 선택 그림체 라벨 유지

권장 결합 규칙:
- 내장 그림체 샘플: 항상 스타일 참고
- 사용자 reference: 사용자가 고른 referenceAspect에 따라 스타일/구도/둘 다 참고
- 둘 다 있을 때: 사용자 reference의 구도 요구가 내장 샘플보다 우선, 내장 샘플은 그림체 질감만 참고

검증:
- [ ] reference 없이도 Gemini 메타 프롬프트가 내장 샘플을 참고한다.
- [ ] reference 업로드 시 기존 기능이 깨지지 않는다.
- [ ] 파일 크기/타입 오류가 사용자에게 명확히 표시된다.

### Phase 3 — GPT 이미지 생성 API 전환

- [ ] OpenAI 이미지 생성 모델/endpoint 확정
- [ ] 현재 `dall-e-3` generation 호출 제거 또는 fallback으로 격리
- [ ] 선택 그림체 샘플을 OpenAI 이미지 입력으로 전달
- [ ] 반환을 base64 중심으로 정리
- [ ] `PromptBuilder.tsx`에서 생성 결과를 Blob URL로 표시
- [ ] 실패 시 API 오류 메시지 표시

검증:
- [ ] 샘플 그림체별로 결과 스타일이 달라진다.
- [ ] 하단 footer 공간 지시가 유지된다.
- [ ] 1:1, 9:16, A4에서 이미지가 심하게 잘리지 않는다.

### Phase 4 — 수정 명령 UX

- [ ] 생성 결과 영역에 수정 textarea 추가
- [ ] 빠른 수정 칩 추가
- [ ] `mode: "revise"` API 호출 추가
- [ ] 생성 히스토리 state 추가
- [ ] 이전 결과 선택 UI 추가
- [ ] `이 이미지로 확정` 시 `SharedPosterData`로 Finalizer에 전달

검증:
- [ ] “더 밝게” 수정 후 새 이미지가 생성된다.
- [ ] “하단 footer 공간 더 비우기” 수정 후 하단이 덜 복잡해진다.
- [ ] 이전 결과를 다시 선택할 수 있다.
- [ ] 수정 실패 시 기존 이미지는 유지된다.

### Phase 5 — footer-only Finalizer

- [ ] `Finalizer.tsx`에서 텍스트 카드 제거
- [ ] `renderPoster()` 호출 시 `title/bodyText`를 빈 값으로 전달
- [ ] footer 표시 토글 유지
- [ ] PNG 다운로드 유지
- [ ] 공지사항 등록 버튼 유지

검증:
- [ ] 최종 이미지에 제목/본문 텍스트가 합성되지 않는다.
- [ ] footer는 정확히 삽입된다.
- [ ] footer off 상태에서도 다운로드 가능하다.

### Phase 6 — 공지 등록 정리

- [ ] `NoticeDraftModal`에서 `textSettings` 의존 제거 또는 무시
- [ ] 메인/썸네일 모두 footer-only 이미지로 생성
- [ ] 공지 초안 생성 입력은 기존 `sharedData.fullInput` 사용
- [ ] 등록 완료 후 `/admin/notices` 이동 유지

검증:
- [ ] 공지 제목/본문 초안이 생성된다.
- [ ] Storage에 메인/썸네일 이미지가 업로드된다.
- [ ] `notices.images`에 두 이미지 URL이 들어간다.
- [ ] 기본 `is_public: false`가 유지된다.

---

## 10. 타입/데이터 변경

### 10.1 `SharedPosterData`

현재:

```ts
export interface SharedPosterData {
  ratio: PosterRatio;
  title: string;
  bodyText: string;
  imageUrl?: string;
  fullInput?: PromptBuilderInput;
}
```

변경 후보:

```ts
export interface SharedPosterData {
  ratio: PosterRatio;
  title: string;
  imageUrl?: string;
  imageDataUrl?: string;
  fullInput?: PromptBuilderInput;
}
```

`bodyText`는 공지 초안에는 필요할 수 있으나 footer-only 합성에는 필요 없다. 기존 draft-notice 입력은 `fullInput`이 있으므로 `bodyText` 제거 가능하다.

보수적 접근:
- 1차 구현에서는 `bodyText`를 유지하되 Finalizer에서 사용하지 않는다.
- 후속 정리에서 타입 축소.

### 10.2 `PromptBuilderInput`

`artStyle`은 이미 있으므로 새 필드는 필요 없다.

선택적으로 추가:

```ts
styleSampleSrc?: string;
```

하지만 서버가 `artStyle`로 매핑하면 클라이언트가 경로를 보낼 필요가 없다. 따라서 추가하지 않는 쪽 권장.

---

## 11. 보안/운영 고려

### 11.1 권한

- 기존 `requireAdmin(request)` 유지.
- `/admin/posters`는 현재 staff 접근 가능 구조이므로 API도 staff+ 정책과 일치해야 한다.

### 11.2 외부 URL

- 기존 `proxy-image` SSRF 방어 유지.
- 새 OpenAI 수정 모드가 `sourceImageUrl`을 받을 경우, 외부 URL을 직접 OpenAI로 넘기지 말고 서버가 먼저 proxy/검증/다운로드 후 전달한다.

### 11.3 비용

수정 루프가 생기면 사용량이 늘어난다.

초기 가드:
- 버튼 클릭 중복 방지
- 생성/수정 중 다른 실행 버튼 disabled
- 사용자에게 “수정할 때마다 새 이미지 생성 비용이 발생할 수 있음” 안내

추후 가드:
- 사용자별 일일 생성 횟수 제한
- 관리자 비용 로그
- 월간 제한

### 11.4 저작권/초상권

프롬프트에 다음 원칙 유지:

- 샘플 이미지의 로고/텍스트/고유 인물/고유 캐릭터 복제 금지
- 사람 얼굴 사실 묘사 기본 차단
- 특정 종교 인물 얼굴 묘사 금지

---

## 12. QA 체크리스트

### UI

- [ ] 그림체 샘플 8개가 모두 정상 로드된다.
- [ ] 선택 상태가 모바일/데스크톱 모두 명확하다.
- [ ] 긴 라벨이 카드 밖으로 넘치지 않는다.
- [ ] 단계 흐름에서 사용자가 현재 위치를 알 수 있다.

### 프롬프트

- [ ] Gemini 결과가 선택한 그림체를 반영한다.
- [ ] footer 하단 여백 지시가 프롬프트에 남아 있다.
- [ ] 텍스트 없음 또는 텍스트 처리 정책이 일관된다.

### 이미지 생성

- [ ] 그림체 샘플을 OpenAI 입력으로 전달한다.
- [ ] 생성 실패 시 사용자에게 오류가 보인다.
- [ ] 성공 시 이미지가 Finalizer로 전달된다.

### 수정 UX

- [ ] 자연어 수정 명령이 동작한다.
- [ ] 빠른 수정 칩이 동작한다.
- [ ] 이전 결과를 선택할 수 있다.
- [ ] 수정 실패 시 기존 결과가 사라지지 않는다.

### footer/공지

- [ ] footer만 합성된다.
- [ ] PNG 다운로드가 동작한다.
- [ ] 공지 등록 시 이미지가 업로드된다.
- [ ] 등록된 공지는 기본 비공개다.

### 빌드

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] 필요 시 `npm run build`

---

## 13. Non-Goals

이번 작업에서 하지 않는다.

- 포스터 생성 결과 DB 영구 저장
- 생성 히스토리 서버 저장
- 월간 비용 대시보드
- SNS 자동 게시
- 이벤트/소모임/공지 상세에서 포스터 도구로 deep-link prefill
- 기존 공지사항 관리 화면 레이아웃 변경
- 전체 관리자 레이아웃 리디자인

---

## 14. 구현 순서 제안

1. 그림체 샘플 UI부터 구현한다.
2. Gemini 프롬프트 생성에 내장 샘플 참조를 붙인다.
3. OpenAI 생성 API를 GPT Image reference workflow로 교체한다.
4. 생성 결과 화면에 수정 명령 UX를 추가한다.
5. Finalizer를 footer-only로 줄인다.
6. NoticeDraftModal을 footer-only 이미지 기준으로 맞춘다.
7. typecheck/lint/build로 검증한다.

이 순서가 안전한 이유:
- UI 샘플 노출과 Gemini 참고는 기존 구조를 거의 그대로 쓰므로 먼저 끝낼 수 있다.
- OpenAI API 전환은 외부 API 계약 리스크가 가장 크므로 독립 단계로 둔다.
- Finalizer 단순화는 생성/수정 루프가 안정된 뒤 적용해야 데이터 전달 형태를 한 번만 정리할 수 있다.

