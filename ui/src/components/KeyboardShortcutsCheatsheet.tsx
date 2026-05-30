import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ShortcutEntry {
  keys: string[];
  label: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    title: "받은 편지함",
    shortcuts: [
      { keys: ["j"], label: "아래로 이동" },
      { keys: ["k"], label: "위로 이동" },
      { keys: ["Enter"], label: "선택 항목 열기" },
      { keys: ["a"], label: "항목 보관" },
      { keys: ["y"], label: "항목 보관" },
      { keys: ["r"], label: "읽음으로 표시" },
      { keys: ["U"], label: "읽지 않음으로 표시" },
    ],
  },
  {
    title: "이슈 상세",
    shortcuts: [
      { keys: ["y"], label: "받은 편지함으로 빠른 보관" },
      { keys: ["g", "i"], label: "받은 편지함으로 이동" },
      { keys: ["g", "c"], label: "댓글 작성 영역에 포커스" },
    ],
  },
  {
    title: "전체",
    shortcuts: [
      { keys: ["/"], label: "현재 페이지 검색 또는 빠른 검색" },
      { keys: ["c"], label: "새 이슈" },
      { keys: ["["], label: "사이드바 토글" },
      { keys: ["]"], label: "패널 토글" },
      { keys: ["?"], label: "키보드 단축키 표시" },
    ],
  },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-[0_1px_0_1px_hsl(var(--border))]">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">키보드 단축키</DialogTitle>
        </DialogHeader>
        <div className="divide-y divide-border border-t border-border">
          {sections.map((section) => (
            <div key={section.title} className="px-5 py-3">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <div className="space-y-1.5">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.label + shortcut.keys.join()}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-foreground/90">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={key} className="flex items-center gap-1">
                          {i > 0 && <span className="text-xs text-muted-foreground">→</span>}
                          <KeyCap>{key}</KeyCap>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-5 py-3">
          <p className="text-xs text-muted-foreground">
            <KeyCap>Esc</KeyCap> 키로 닫기 &middot; 텍스트 입력 중에는 단축키가 비활성화됩니다
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
