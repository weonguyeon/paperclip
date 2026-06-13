# 도움말 모드 (파란 설명 토글) — 설계 스펙

작성일: 2026-06-14

## 배경 / 목표
Paperclip 기능이 많고 진입장벽이 높다. 각 화면이 "무엇을 하는 곳인지"를 **켜고 끌 수 있는 작은 파란 글씨**로 설명해, 처음 쓰는 사람도 화면 역할을 바로 이해하게 한다.

## 결정 사항 (사용자 확정)
- **단위**: 페이지/섹션 헤더 단위 (개별 버튼·필드까지는 안 함)
- **표시**: 토글 버튼으로 ON/OFF, 상태 영속화. 기본 OFF
- **범위**: 46개 페이지 전부
- **방식(A안)**: 중앙 도움말 모드 + 재사용 `<HelpHint>` 컴포넌트, 설명문은 각 페이지 JSX에 co-locate

## 아키텍처

### 1. `HelpModeContext` — `ui/src/context/HelpModeContext.tsx`
- `ThemeContext` 패턴 미러링. `{ enabled, setEnabled, toggle }`
- localStorage 키 `paperclip.helpMode`, 기본 `false`(OFF). 초기값은 저장값 읽어 복원
- `useHelpMode()` 훅 + provider 가드(없으면 throw)
- `main.tsx` 프로바이더 트리에 `ThemeProvider` 인접 마운트

### 2. `HelpHint` — `ui/src/components/HelpHint.tsx`
- props: `children: ReactNode`(한글 설명), optional `className`
- `useHelpMode().enabled === false` → `null` 렌더 (화면 깨끗)
- ON → 작은 파란 글씨: `mt-1 flex items-start gap-1 text-xs leading-snug text-blue-600 dark:text-blue-400`, 앞에 `Lightbulb` 14px 아이콘, `role="note"`
- light/dark 둘 다 가독성(blue-600 / blue-400)

### 3. 토글 버튼 — `ui/src/components/Layout.tsx`
- 테마 토글(`useTheme().toggleTheme`) 옆 상단 아이콘 줄에 `Lightbulb` 버튼 추가
- ON이면 파란 활성색, `title`/tooltip "기능 설명 켜기/끄기", `aria-label`
- 기존 icon 버튼 스타일(`variant="ghost" size="icon-sm"`) 따름

## 롤아웃
- **Phase 1 — 인프라**: 1~3 구현 + 마운트 → `HelpHint` 단위 테스트 + typecheck + build → 커밋
- **Phase 2 — 설명 삽입**: 46개 페이지에 페이지 제목 아래 1줄 + 헤더 있는 주요 섹션/카드 아래 1줄. 배치로 나눠 진행(병렬 가능). 각 배치마다 typecheck

## 설명문 작성 원칙
- 각 페이지 코드(제목·렌더 내용·호출 API)를 읽고 **초심자 눈높이 한 줄**로 작성
- 사실 기반, 과장 금지. "이 화면은 ~하는 곳입니다" / "이 버튼은 ~합니다" 톤
- 불확실하면 기능명 그대로 서술, 추측 금지

## 비-목표
- 개별 버튼·입력 필드 단위 설명 (페이지/섹션 단위로 한정)
- 다국어(i18n) 전환 — 현재 하드코딩 한글 유지
- 인터랙티브 튜토리얼/온보딩 투어

## 검증
- `HelpHint` 단위 테스트: OFF→`null`, ON→파란 텍스트 렌더
- `pnpm --filter @paperclipai/ui typecheck` + build 통과
- 브라우저에서 토글 동작 + 대표 페이지 스팟체크

---

## 진행 현황 (2026-06-14 기준)
- ✅ 인프라(HelpModeContext + HelpHint + 상단 💡 토글 + 단위테스트) 완료
- ✅ Dashboard 예시 + 37개 기능 페이지 적용(약 97개 설명). typecheck + production build 통과
- 커밋: `386fb7cd`(스펙) · `09a9038c`(인프라) · `b1fa289f`(Dashboard) · `e8dec9af`(37p) · `6a6de932`(.gitignore .omc)

## 남은 작업 (TODO)
1. **브라우저 실물 확인 미완** — `pnpm dev:full` 띄워 💡 토글 ON 시 파란 글씨 실제 모양/간격/가독성(light·dark) 눈으로 스팟체크. 어색하면 `HelpHint` 스타일(크기·색·여백) 미세조정.
2. **설명 미적용 8개 페이지** — 의도적 제외분 중 필요 시 추가:
   - 제외 유지 권장(내부/특수): `DesignGuide`, `IssueChatUxLab`, `RunTranscriptUxLab`(개발용 랩), `NotFound`(404)
   - 검토 후 추가 가능: 나머지(현재 `ui/src/pages` 중 HelpHint 미적용 페이지) — 필요하면 동일 패턴으로 1줄씩.
3. **문구 톤 2차 다듬기** — 사용자가 실제로 보고 어려운 표현/오해 소지 있는 설명 발견 시 해당 페이지 HelpHint 텍스트만 수정(로직 무관).
4. (별개 트랙) 첨부 이미지 **Vision 완전 전달(B안)** — `.omc/plans/checklist-attachment-fixes.md` 참조. 에이전트 하니스/CLI 계층 + 라이브 런 검증 필요.
