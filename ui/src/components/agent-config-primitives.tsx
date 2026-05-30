import { useState, useRef, useEffect, useCallback } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";

/* ---- Help text for (?) tooltips ---- */
export const help: Record<string, string> = {
  name: "이 에이전트의 표시 이름.",
  title: "조직도에 표시되는 직함.",
  role: "조직 역할. 위치와 권한을 결정합니다.",
  reportsTo: "조직 계층에서 이 에이전트가 보고하는 상위 에이전트.",
  capabilities: "이 에이전트가 할 수 있는 일을 설명합니다. 조직도에 표시되며 작업 라우팅에 활용됩니다.",
  adapterType: "에이전트 실행 방식: 로컬 CLI(Claude/Codex/OpenCode), OpenClaw 게이트웨이, 스폰 프로세스, 일반 HTTP 웹훅 중 선택.",
  cwd: "로컬 어댑터용 레거시 작업 디렉터리 폴백(지원 중단). 기존 에이전트에 값이 남아 있을 수 있으나, 새 설정에서는 프로젝트 워크스페이스를 사용하세요.",
  promptTemplate: "매 하트비트마다 전송됩니다. 간결하고 동적으로 유지하세요. 대용량 정적 지시문 대신 현재 작업 컨텍스트 설정에 사용하세요. {{ agent.id }}, {{ agent.name }}, {{ agent.role }} 등 템플릿 변수를 지원합니다.",
  model: "어댑터가 사용하는 기본 모델을 재정의합니다.",
  thinkingEffort: "모델 추론 깊이를 제어합니다. 지원 값은 어댑터/모델마다 다릅니다.",
  chrome: "--chrome 플래그를 전달하여 Claude의 Chrome 연동을 활성화합니다.",
  dangerouslySkipPermissions: "지원되는 경우 어댑터 권한 요청을 자동 승인하여 무인 실행합니다.",
  dangerouslyBypassSandbox: "샌드박스 제한 없이 Codex를 실행합니다. 파일시스템/네트워크 접근에 필요합니다.",
  search: "실행 중 Codex 웹 검색 기능을 활성화합니다.",
  fastMode: "Codex Fast 모드를 활성화합니다. 크레딧/토큰 소모가 훨씬 빠르며 현재 GPT-5.4 전용입니다.",
  workspaceStrategy: "Paperclip이 이 에이전트의 실행 워크스페이스를 구성하는 방식. 일반 cwd 실행은 project_primary, 이슈별 격리 체크아웃은 git_worktree를 사용하세요.",
  workspaceBaseRef: "워크트리 브랜치 생성 시 사용하는 기본 git 참조. 비워두면 해석된 워크스페이스 ref 또는 HEAD를 사용합니다.",
  workspaceBranchTemplate: "파생 브랜치 이름 템플릿. {{issue.identifier}}, {{issue.title}}, {{agent.name}}, {{project.id}}, {{workspace.repoRef}}, {{slug}}를 지원합니다.",
  worktreeParentDir: "파생 워크트리가 생성될 디렉터리. 절대 경로, ~ 접두사 경로, 저장소 상대 경로를 지원합니다.",
  runtimeServicesJson: "선택적 워크스페이스 런타임 서비스 정의. 워크스페이스에 연결된 공유 앱 서버, 워커 등 장기 실행 보조 프로세스에 사용합니다.",
  maxTurnsPerRun: "하트비트 실행당 최대 에이전트 턴(도구 호출) 수.",
  command: "실행할 명령어(예: node, python).",
  localCommand: "어댑터가 호출할 CLI 명령어 경로를 재정의합니다(예: /usr/local/bin/claude, codex, opencode).",
  args: "명령줄 인수, 쉼표로 구분.",
  extraArgs: "로컬 어댑터용 추가 CLI 인수, 쉼표로 구분.",
  envVars: "어댑터 프로세스에 주입할 환경 변수. 일반 값 또는 시크릿 참조를 사용하세요.",
  bootstrapPrompt: "Paperclip이 새 세션을 시작할 때만 전송됩니다. 매 하트비트마다 반복할 필요 없는 안정적인 설정 안내에 사용하세요.",
  payloadTemplateJson: "Paperclip이 표준 wake 및 워크스페이스 필드를 추가하기 전에 원격 어댑터 요청 페이로드에 병합할 선택적 JSON.",
  webhookUrl: "에이전트 호출 시 POST 요청을 수신할 URL.",
  heartbeatInterval: "타이머로 이 에이전트를 자동 실행합니다. 새 작업 확인 등 주기적 작업에 유용합니다.",
  intervalSec: "자동 하트비트 호출 간격(초).",
  timeoutSec: "실행이 강제 종료되기까지의 최대 시간(초). 0은 제한 없음.",
  graceSec: "인터럽트 전송 후 강제 종료 전 대기 시간(초).",
  wakeOnDemand: "할당, API 호출, UI 동작 또는 자동화 시스템에 의해 이 에이전트를 깨울 수 있도록 허용합니다.",
  cooldownSec: "연속 하트비트 실행 사이의 최소 간격(초).",
  maxConcurrentRuns: "이 에이전트에서 동시에 실행할 수 있는 최대 하트비트 실행 수.",
  budgetMonthlyCents: "월별 지출 한도(센트). 0은 제한 없음.",
};

import { getAdapterLabels } from "../adapters/adapter-display-registry";

export const adapterLabels = getAdapterLabels();

export const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

/* ---- Primitive components ---- */

export function HintIcon({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground/50 hover:text-muted-foreground transition-colors">
          <HelpCircle className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      {children}
    </div>
  );
}

export function ToggleField({
  label,
  hint,
  checked,
  onChange,
  toggleTestId,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  toggleTestId?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        {hint && <HintIcon text={hint} />}
      </div>
      <ToggleSwitch
        checked={checked}
        onCheckedChange={onChange}
        data-testid={toggleTestId}
      />
    </div>
  );
}

export function ToggleWithNumber({
  label,
  hint,
  checked,
  onCheckedChange,
  number,
  onNumberChange,
  numberLabel,
  numberHint,
  numberPrefix,
  showNumber,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  number: number;
  onNumberChange: (v: number) => void;
  numberLabel: string;
  numberHint?: string;
  numberPrefix?: string;
  showNumber: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          {hint && <HintIcon text={hint} />}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </div>
      {showNumber && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {numberPrefix && <span>{numberPrefix}</span>}
          <input
            type="number"
            className="w-16 rounded-md border border-border px-2 py-0.5 bg-transparent outline-none text-xs font-mono text-center"
            value={number}
            onChange={(e) => onNumberChange(Number(e.target.value))}
          />
          <span>{numberLabel}</span>
          {numberHint && <HintIcon text={numberHint} />}
        </div>
      )}
    </div>
  );
}

export function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  bordered,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(bordered && "border-t border-border")}>
      <button
        className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
        onClick={onToggle}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {icon}
        {title}
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

export function AutoExpandTextarea({
  value,
  onChange,
  onBlur,
  placeholder,
  minRows,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [value, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      style={{ minHeight }}
    />
  );
}

/**
 * Text input that manages internal draft state.
 * Calls `onCommit` on blur (and optionally on every change if `immediate` is set).
 */
export function DraftInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <input
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      {...props}
    />
  );
}

/**
 * Auto-expanding textarea with draft state and blur-commit.
 */
export function DraftTextarea({
  value,
  onCommit,
  immediate,
  placeholder,
  minRows,
}: {
  value: string;
  onCommit: (v: string) => void;
  immediate?: boolean;
  placeholder?: string;
  minRows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rows = minRows ?? 3;
  const lineHeight = 20;
  const minHeight = rows * lineHeight;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  }, [minHeight]);

  useEffect(() => { adjustHeight(); }, [draft, adjustHeight]);

  return (
    <textarea
      ref={textareaRef}
      className="w-full rounded-md border border-border px-2.5 py-1.5 bg-transparent outline-none text-sm font-mono placeholder:text-muted-foreground/40 resize-none overflow-hidden"
      placeholder={placeholder}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(e.target.value);
      }}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      style={{ minHeight }}
    />
  );
}

/**
 * Number input with draft state and blur-commit.
 */
export function DraftNumberInput({
  value,
  onCommit,
  immediate,
  className,
  ...props
}: {
  value: number;
  onCommit: (v: number) => void;
  immediate?: boolean;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className" | "type">) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  return (
    <input
      type="number"
      className={className}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        if (immediate) onCommit(Number(e.target.value) || 0);
      }}
      onBlur={() => {
        const num = Number(draft) || 0;
        if (num !== value) onCommit(num);
      }}
      {...props}
    />
  );
}

/**
 * "Choose" button that opens a dialog explaining the user must manually
 * type the path due to browser security limitations.
 */
export function ChoosePathButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0"
        onClick={() => setOpen(true)}
      >
        선택
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>경로 직접 입력</DialogTitle>
            <DialogDescription>
              브라우저 보안 정책으로 인해 파일 선택기로 전체 로컬 경로를 읽을 수 없습니다.
              절대 경로를 복사하여 입력란에 붙여넣으세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <section className="space-y-1.5">
              <p className="font-medium">macOS (Finder)</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Finder에서 폴더를 찾습니다.</li>
                <li><kbd>Option</kbd>을 누른 채로 폴더를 우클릭합니다.</li>
                <li>"&lt;폴더 이름&gt;의 경로 이름 복사"를 클릭합니다.</li>
                <li>복사한 결과를 경로 입력란에 붙여넣습니다.</li>
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                /Users/yourname/Documents/project
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">Windows (파일 탐색기)</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>파일 탐색기에서 폴더를 찾습니다.</li>
                <li><kbd>Shift</kbd>를 누른 채로 폴더를 우클릭합니다.</li>
                <li>"경로로 복사"를 클릭합니다.</li>
                <li>복사한 결과를 경로 입력란에 붙여넣습니다.</li>
              </ol>
              <p className="rounded-md bg-muted px-2 py-1 font-mono text-xs">
                C:\Users\yourname\Documents\project
              </p>
            </section>
            <section className="space-y-1.5">
              <p className="font-medium">터미널 사용 (macOS/Linux)</p>
              <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                <li><code>cd /path/to/folder</code>을 실행합니다.</li>
                <li><code>pwd</code>를 실행합니다.</li>
                <li>출력된 결과를 복사하여 경로 입력란에 붙여넣습니다.</li>
              </ol>
            </section>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Label + input rendered on the same line (inline layout for compact fields).
 */
export function InlineField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 shrink-0">
        <label className="text-xs text-muted-foreground">{label}</label>
        {hint && <HintIcon text={hint} />}
      </div>
      <div className="w-24 ml-auto">{children}</div>
    </div>
  );
}
