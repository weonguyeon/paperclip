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
