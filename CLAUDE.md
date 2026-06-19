# Paperclip 로컬 개발 가이드

Paperclip AI 에이전트 플랫폼의 로컬 개발 구현 (Claude CLI MAX 토큰 전용).

## 프로젝트 정보

- **스택**: TypeScript + Node.js + Express + 임베디드 PostgreSQL + pnpm
- **포트**: 3100 (서버), 54329 (임베디드 PG)
- **URL**: http://127.0.0.1:3100
- **인증**: `local_trusted` 모드 — API 키 사용 금지 (Claude MAX 토큰 전용 원칙)

## ★ 필수: 개발 서버 기동 방법

**1순위 (정상 케이스)**:
```bash
cd /c/Users/AIkuk/projects/paperclip
pnpm dev:full
```
`run_in_background: true`로 실행. `Server listening on 127.0.0.1:3100` 보일 때까지 헬스 폴링.

**2순위 (1순위가 출력 없이 즉시 종료될 때)**:
```bash
cd /c/Users/AIkuk/projects/paperclip/server
pnpm exec tsx src/index.ts
```
`pnpm dev:full` 래퍼는 한 번 죽인 뒤 같은 환경에서 재기동 시 child spawn이 stdout 못 잡고 즉시 종료되는 경우가 있다. 직접 tsx 실행하면 우회된다.

### 실패 패턴 (하지 말 것)
- `pnpm exec tsx src/index.ts | head -N` — 파이프가 닫히면 SIGPIPE로 서버 죽음
- `cmd.exe /c "pnpm dev:full > log"` — Start-Process 후 cmd 셸 빠지면 자식 node 동반 종료
- 한 번 죽인 뒤 다시 띄울 땐 같은 bash 세션 안에서 pnpm 명령이 cwd를 잃을 수 있음 → **반드시 절대경로 `cd` 부터** 시작

### 정상 동작 확인
- 부팅 로그에 `Server listening on 127.0.0.1:3100` 나오면 성공
- `curl http://127.0.0.1:3100/api/health` → JSON 응답
- 임베디드 PostgreSQL은 `:54329`, 데이터 디렉토리 `~/.paperclip/instances/default/db/`

### 종료
- 포트로 PID 찾아서 `taskkill /F /PID <pid>` (`netstat -ano | grep :3100`)
- 임베디드 PG도 같이 죽음 (54329 lock 자동 정리됨)

## 인증 모드
- 기본 `local_trusted` → 임시 사용자 `local-board`로 자동 세션 부여
- API 키 사용 금지 (Claude MAX 토큰 전용 원칙)

## 첨부파일 자동 추출
- `assets.extracted_text/extraction_status/extraction_meta` 컬럼 + 0057 마이그레이션
- `server/src/services/file-extractor/`: PDF/DOCX/XLSX/PPTX/HWPX/HWP/이미지/일반 어댑터
- 업로드 직후 비동기 추출 → `extractionStatus`로 진행 표시
- **추출 완료(`done`) 시 담당 에이전트 자동 re-wake** (`queueIssueAssignmentWakeup`): 추출이 비동기라 첫 wake 때 `extractedText`가 아직 null일 수 있으므로, 텍스트가 준비되면 다시 깨워 실제로 읽게 함 (`routes/issues.ts runFileExtraction`)
- 에이전트 wake payload `attachments[]`로 텍스트 주입 (이슈당 12개·항목당 8KB·총 32KB 한도). 각 항목에 `contentPath`(`/api/attachments/:id/content`) 포함
- 이미지 추출은 **Vision passthrough 마커**만, OCR 안 함. wake payload에서 이미지 첨부는 `extractedText`에 "contentPath로 GET해서 확인" 마커를 실어 에이전트가 존재·경로 인지 (완전 Vision 바이트 전달은 미구현 — 후속 과제)

## 인코딩 원칙 (한글 깨짐 방지)

- **JSON 본문은 `express.json()`이 이미 UTF-8로 정상 디코딩한다** (RFC 8259). 한글·CJK는 그대로 들어온다. 검증 완료: Node fetch로 `한글 café Müller 🚀` POST→DB→GET 전 구간 정확히 일치.
- **요청 본문에 `latin1→utf8` 휴리스틱 재디코딩 미들웨어를 절대 추가하지 말 것.** 정상 UTF-8을 다시 디코딩하면 악센트 라틴 문자(`Müller`, `café`)·이름 데이터를 오히려 깨뜨린다. (과거 `normalizeUtf8` 미들웨어가 이 문제 + `charset` 옵션 타입에러로 빌드 차단 → 제거함)
- **실제 mojibake가 나는 유일한 지점은 multipart 파일명**(multer가 RFC 7578대로 latin1 디코딩). → `server/src/encoding-utils.ts`의 `fixMulterFilename`로만 처리. U+FFFD 가드로 진짜 latin1 파일명은 보존.
- 터미널에서 `curl`로 한글 POST 테스트 시 깨져 보이는 건 **Windows 콘솔 CP949 아티팩트**이지 서버 문제가 아니다. 검증은 Node `fetch`(보장된 UTF-8 바이트)로 할 것.
