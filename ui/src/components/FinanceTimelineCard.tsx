import type { FinanceEvent } from "@paperclipai/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  financeDirectionDisplayName,
  financeEventKindDisplayName,
  formatCents,
  formatDateTime,
  providerDisplayName,
} from "@/lib/utils";

interface FinanceTimelineCardProps {
  rows: FinanceEvent[];
  emptyMessage?: string;
}

export function FinanceTimelineCard({
  rows,
  emptyMessage = "이 기간에 금융 이벤트가 없습니다.",
}: FinanceTimelineCardProps) {
  return (
    <Card>
      <CardHeader className="px-4 pt-4 pb-1">
        <CardTitle className="text-base">최근 금융 이벤트</CardTitle>
        <CardDescription>충전, 수수료, 크레딧, 약정 및 기타 비요청 청구 항목.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 pt-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="border border-border p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{financeEventKindDisplayName(row.eventKind)}</Badge>
                    <Badge variant={row.direction === "credit" ? "outline" : "secondary"}>
                      {financeDirectionDisplayName(row.direction)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDateTime(row.occurredAt)}</span>
                  </div>
                  <div className="text-sm font-medium">
                    {providerDisplayName(row.biller)}
                    {row.provider ? ` -> ${providerDisplayName(row.provider)}` : ""}
                    {row.model ? <span className="ml-1 font-mono text-xs text-muted-foreground">{row.model}</span> : null}
                  </div>
                  {(row.description || row.externalInvoiceId || row.region || row.pricingTier) && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {row.description ? <div>{row.description}</div> : null}
                      {row.externalInvoiceId ? <div>인보이스 {row.externalInvoiceId}</div> : null}
                      {row.region ? <div>리전 {row.region}</div> : null}
                      {row.pricingTier ? <div>티어 {row.pricingTier}</div> : null}
                    </div>
                  )}
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-sm font-semibold">{formatCents(row.amountCents)}</div>
                  <div className="text-xs text-muted-foreground">{row.currency}</div>
                  {row.estimated ? <div className="text-[11px] uppercase tracking-[0.12em] text-amber-600">추정</div> : null}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
