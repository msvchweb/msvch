/**
 * 소모임 게시판 — DTO + 입력 페이로드.
 * 마이그레이션 025 와 1:1 대응. camelCase 만 사용 (snake_case 누출 금지).
 *
 * 모든 필드는 platform-neutral — 웹/모바일이 동일하게 소비.
 */

export interface Board {
  id: string;
  title: string;
  description: string | null;
  isVisible: boolean;
  /** 멤버 수 (서버 합성) */
  memberCount: number;
  /** 글 수 (서버 합성) */
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardMember {
  profileId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  addedAt: string;
}

export interface BoardPost {
  id: string;
  boardId: string;
  authorId: string | null;
  /** 작성 시점 닉네임 스냅샷 — 작성자 탈퇴/닉네임 변경 후에도 유지 */
  authorName: string;
  title: string;
  content: string;
  /** Supabase Storage public URL 배열 */
  images: string[];
  commentCount: number;
  /** 서버 계산: admin/master OR 본인 — 모바일도 그대로 사용 */
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BoardComment {
  id: string;
  postId: string;
  authorId: string | null;
  authorName: string;
  content: string;
  canDelete: boolean;
  createdAt: string;
}

/** 페이지네이션 응답 — 모든 목록 엔드포인트 공용 */
export interface CursorPage<T> {
  items: T[];
  /** 다음 페이지 cursor — null 이면 끝 */
  nextCursor: string | null;
}

/** 입력 페이로드 (web + mobile 공용) */
export interface BoardCreateInput {
  title: string;
  description?: string;
  initialMemberIds?: string[];
}

export interface BoardUpdateInput {
  title?: string;
  description?: string;
  isVisible?: boolean;
}

export interface BoardPostInput {
  title: string;
  content: string;
  images?: string[];
}

export interface BoardCommentInput {
  content: string;
}
