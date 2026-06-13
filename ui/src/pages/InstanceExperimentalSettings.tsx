import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { HelpHint } from "../components/HelpHint";

export function InstanceExperimentalSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: "인스턴스 설정" },
      { label: "실험적 기능" },
    ]);
  }, [setBreadcrumbs]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const toggleMutation = useMutation({
    mutationFn: async (patch: { enableIsolatedWorkspaces?: boolean; autoRestartDevServerWhenIdle?: boolean }) =>
      instanceSettingsApi.updateExperimental(patch),
    onSuccess: async () => {
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.health }),
      ]);
    },
    onError: (error) => {
      setActionError(error instanceof Error ? error.message : "실험적 설정 업데이트에 실패했습니다.");
    },
  });

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">실험적 설정 로딩 중...</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {experimentalQuery.error instanceof Error
          ? experimentalQuery.error.message
          : "실험적 설정을 불러오지 못했습니다."}
      </div>
    );
  }

  const enableIsolatedWorkspaces = experimentalQuery.data?.enableIsolatedWorkspaces === true;
  const autoRestartDevServerWhenIdle = experimentalQuery.data?.autoRestartDevServerWhenIdle === true;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">실험적 기능</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          기본 동작으로 확정되기 전 평가 중인 기능을 선택적으로 활성화합니다.
        </p>
        <HelpHint>이 화면은 아직 정식 출시 전인 실험적 기능을 켜고 끄는 인스턴스 설정 화면입니다.</HelpHint>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">격리된 워크스페이스 활성화</h2>
            <HelpHint>이 섹션은 이슈 실행 시 각 작업을 별도의 격리된 워크스페이스에서 실행하도록 허용하는 실험적 옵션입니다.</HelpHint>
            <p className="max-w-2xl text-sm text-muted-foreground">
              프로젝트 설정에서 실행 워크스페이스 제어 항목을 표시하고, 신규 및 기존 이슈 실행 시 격리된 워크스페이스 동작을 허용합니다.
            </p>
          </div>
          <ToggleSwitch
            checked={enableIsolatedWorkspaces}
            onCheckedChange={() => toggleMutation.mutate({ enableIsolatedWorkspaces: !enableIsolatedWorkspaces })}
            disabled={toggleMutation.isPending}
            aria-label="격리된 워크스페이스 실험적 설정 토글"
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-semibold">유휴 시 개발 서버 자동 재시작</h2>
            <HelpHint>이 섹션은 에이전트 작업이 모두 끝난 뒤 서버 변경이 감지되면 자동으로 재시작하는 실험적 옵션입니다.</HelpHint>
            <p className="max-w-2xl text-sm text-muted-foreground">
              `pnpm dev:once` 실행 시 대기 중이거나 실행 중인 로컬 에이전트 작업이 모두 완료될 때까지 기다린 후, 백엔드 변경 또는 마이그레이션으로 현재 부팅이 오래된 경우 서버를 자동으로 재시작합니다.
            </p>
          </div>
          <ToggleSwitch
            checked={autoRestartDevServerWhenIdle}
            onCheckedChange={() => toggleMutation.mutate({ autoRestartDevServerWhenIdle: !autoRestartDevServerWhenIdle })}
            disabled={toggleMutation.isPending}
            aria-label="개발 서버 자동 재시작 토글"
          />
        </div>
      </section>
    </div>
  );
}
