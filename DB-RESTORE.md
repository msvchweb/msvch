# DB 복구 절차

> Supabase 무료 플랜에는 **자동 백업이 없습니다.** `.github/workflows/db-backup.yml` 이
> 주 1회 뜨는 덤프가 유일한 백업입니다.
> 백업 위치: Cloudflare R2 **`msvch-backups`** 버킷 (비공개)

---

## 0. 먼저 확인할 것

**정말 복구가 필요한 상황인가?** 복구는 현재 DB를 백업 시점으로 되돌립니다.
백업 이후에 들어온 데이터(새 공지·주보·게시글·새가족 등록)는 **사라집니다.**

- 특정 테이블 몇 행만 잘못됐다면 → 복구 대신 그 행만 수동 수정
- 실수로 지운 게 하나뿐이라면 → 백업에서 해당 부분만 찾아 INSERT
- 전체가 망가졌거나 프로젝트를 잃었다면 → 아래 전체 복구 진행

---

## 1. 백업 파일 받기

R2 대시보드 → `msvch-backups` → `db/weekly/YYYY-MM-DD/` 에서 3개 파일을 받습니다.

| 파일 | 내용 |
|---|---|
| `roles.sql.gz` | DB 역할 |
| `schema.sql.gz` | 테이블·인덱스·RLS 정책 |
| `data.sql.gz` | 실제 데이터 |

매월 1일자 백업은 `db/monthly/` 에도 있으며 수명주기 삭제 대상이 아닙니다.

명령줄로 받으려면 (R2 백업용 키 필요):

```bash
DAY=2026-08-03
EP="https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com"
for f in roles schema data; do
  curl -sS -f --aws-sigv4 "aws:amz:auto:s3" --user "<KEY_ID>:<SECRET>" \
    "$EP/msvch-backups/db/weekly/$DAY/$f.sql.gz" -o "$f.sql.gz"
done
```

## 2. 압축 해제 (+ 복호화)

`BACKUP_GPG_PASSPHRASE` 를 설정해 두었다면 파일이 `.gz.gpg` 입니다.

```bash
# 암호화된 경우에만
for f in *.gpg; do gpg --batch --yes --decrypt --output "${f%.gpg}" "$f"; done

gunzip roles.sql.gz schema.sql.gz data.sql.gz
```

## 3. 접속 문자열 준비

Supabase 대시보드 → **Connect** → **Session pooler** 문자열을 복사합니다.

```
postgres://postgres.<ref>:<비밀번호>@aws-<region>.pooler.supabase.com:5432/postgres
```

> ⚠️ **Direct connection(`db.<ref>.supabase.co`)을 쓰지 마세요.**
> 무료 플랜에서는 IPv6 전용이라 대부분의 환경에서 연결되지 않습니다.
> Transaction pooler(포트 **6543**)도 `psql` 복구에 맞지 않습니다. **반드시 5432 세션 풀러**입니다.

## 4. 복구 실행 — 순서가 중요합니다

```bash
DB_URL="postgres://postgres.<ref>:<비밀번호>@aws-<region>.pooler.supabase.com:5432/postgres"

psql "$DB_URL" -f roles.sql     # 1) 역할
psql "$DB_URL" -f schema.sql    # 2) 테이블·RLS
psql "$DB_URL" -f data.sql      # 3) 데이터
```

역할 → 스키마 → 데이터 순서를 지켜야 합니다. 데이터를 먼저 넣으면 테이블이 없어 전부 실패합니다.

## 5. 복구 확인

행 수를 대조합니다. 백업 시점 기준이라 최신 수치와 다를 수 있지만, **0 이거나 자릿수가 다르면 실패**입니다.

```sql
select 'gallery_images' t, count(*) from gallery_images
union all select 'gallery_albums', count(*) from gallery_albums
union all select 'sermon_videos',  count(*) from sermon_videos
union all select 'weeklies',       count(*) from weeklies
union all select 'notices',        count(*) from notices
union all select 'profiles',       count(*) from profiles;
```

2026-08-01 기준 참고값: `gallery_images` 1852, `gallery_albums` 104,
`sermon_videos` 181, `weeklies` 16, `notices` 10, `profiles` 22.

이미지가 보이는지도 확인하세요. 이미지 파일 자체는 **R2 `msvch-storage`** 에 따로 있으므로
DB 복구만으로 함께 복구됩니다 (DB 에는 URL 만 저장됩니다).

---

## 새 Supabase 프로젝트로 옮기는 경우

프로젝트를 잃어버려 새로 만들 때는 위 절차에 더해:

1. **환경변수 교체** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` 를 Vercel·GitHub Secrets 양쪽에서 새 값으로.
2. **OAuth 재설정** — Google·Kakao 로그인 리디렉션 URL 을 새 프로젝트 기준으로 다시 등록.
   이걸 놓치면 로그인만 안 됩니다.
3. **`storage.objects` 관련 오류는 무시해도 됩니다** — 이미지가 R2 로 이전된 뒤라
   Storage 스키마는 쓰지 않습니다.
4. 복구 후 `SUPABASE_DB_URL` 시크릿도 새 세션 풀러 문자열로 갱신.

---

## 백업이 도는지 확인하는 법

- GitHub → Actions → **DB backup** 에서 주 1회 성공 기록
- R2 `msvch-backups/db/weekly/` 에 최근 날짜 폴더
- 실패 시 `msvch01@naver.com` 으로 알림 메일

**복구를 한 번도 해보지 않은 백업은 백업이 아닙니다.** 최소 1회는 임시 프로젝트에
실제로 복구해 보고, 그때 겪은 문제를 이 문서에 추가하세요.
