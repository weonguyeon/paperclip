# Paperclip 로컬 개발 가이드

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
- 에이전트 wake payload `attachments[]`로 텍스트 주입 (이슈당 12개·항목당 8KB·총 32KB 한도)
- 이미지 추출은 **Vision passthrough 마커**만, OCR 안 함
