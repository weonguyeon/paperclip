import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ExecutionWorkspace, Issue, Project, ProjectWorkspace } from "@paperclipai/shared";
import { ArrowLeft, Copy, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs } from "@/components/ui/tabs";
import { CopyText } from "../components/CopyText";
import { ExecutionWorkspaceCloseDialog } from "../components/ExecutionWorkspaceCloseDialog";
import { agentsApi } from "../api/agents";
import { executionWorkspacesApi } from "../api/execution-workspaces";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { IssuesList } from "../components/IssuesList";
import { PageTabBar } from "../components/PageTabBar";
import {
  buildWorkspaceRuntimeControlSections,
  WorkspaceRuntimeControls,
  type WorkspaceRuntimeControlRequest,
} from "../components/WorkspaceRuntimeControls";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatDateTime, issueUrl, projectRouteRef, projectWorkspaceUrl } from "../lib/utils";

type WorkspaceFormState = {
  name: string;
  cwd: string;
  repoUrl: string;
  baseRef: string;
  branchName: string;
  providerRef: string;
  provisionCommand: string;
  teardownCommand: string;
  cleanupCommand: string;
  inheritRuntime: boolean;
  workspaceRuntime: string;
};

type ExecutionWorkspaceTab = "configuration" | "runtime_logs" | "issues";

function resolveExecutionWorkspaceTab(pathname: string, workspaceId: string): ExecutionWorkspaceTab | null {
  const segments = pathname.split("/").filter(Boolean);
  const executionWorkspacesIndex = segments.indexOf("execution-workspaces");
  if (executionWorkspacesIndex === -1 || segments[executionWorkspacesIndex + 1] !== workspaceId) return null;
  const tab = segments[executionWorkspacesIndex + 2];
  if (tab === "issues") return "issues";
  if (tab === "runtime-logs") return "runtime_logs";
  if (tab === "configuration") return "configuration";
  return null;
}

function executionWorkspaceTabPath(workspaceId: string, tab: ExecutionWorkspaceTab) {
  const segment = tab === "runtime_logs" ? "runtime-logs" : tab;
  return `/execution-workspaces/${workspaceId}/${segment}`;
}

function isSafeExternalUrl(value: string | null | undefined) {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readText(value: string | null | undefined) {
  return value ?? "";
}

function formatJson(value: Record<string, unknown> | null | undefined) {
  if (!value || Object.keys(value).length === 0) return "";
  return JSON.stringify(value, null, 2);
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseWorkspaceRuntimeJson(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true as const, value: null as Record<string, unknown> | null };

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false as const,
        error: "워크스페이스 명령 JSON은 JSON 객체여야 합니다.",
      };
    }
    return { ok: true as const, value: parsed as Record<string, unknown> };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "잘못된 JSON 형식입니다.",
    };
  }
}

function formStateFromWorkspace(workspace: ExecutionWorkspace): WorkspaceFormState {
  return {
    name: workspace.name,
    cwd: readText(workspace.cwd),
    repoUrl: readText(workspace.repoUrl),
    baseRef: readText(workspace.baseRef),
    branchName: readText(workspace.branchName),
    providerRef: readText(workspace.providerRef),
    provisionCommand: readText(workspace.config?.provisionCommand),
    teardownCommand: readText(workspace.config?.teardownCommand),
    cleanupCommand: readText(workspace.config?.cleanupCommand),
    inheritRuntime: !workspace.config?.workspaceRuntime,
    workspaceRuntime: formatJson(workspace.config?.workspaceRuntime),
  };
}

function buildWorkspacePatch(initialState: WorkspaceFormState, nextState: WorkspaceFormState) {
  const patch: Record<string, unknown> = {};
  const configPatch: Record<string, unknown> = {};

  const maybeAssign = (
    key: keyof Pick<WorkspaceFormState, "name" | "cwd" | "repoUrl" | "baseRef" | "branchName" | "providerRef">,
  ) => {
    if (initialState[key] === nextState[key]) return;
    patch[key] = key === "name" ? (normalizeText(nextState[key]) ?? initialState.name) : normalizeText(nextState[key]);
  };

  maybeAssign("name");
  maybeAssign("cwd");
  maybeAssign("repoUrl");
  maybeAssign("baseRef");
  maybeAssign("branchName");
  maybeAssign("providerRef");

  const maybeAssignConfigText = (key: keyof Pick<WorkspaceFormState, "provisionCommand" | "teardownCommand" | "cleanupCommand">) => {
    if (initialState[key] === nextState[key]) return;
    configPatch[key] = normalizeText(nextState[key]);
  };

  maybeAssignConfigText("provisionCommand");
  maybeAssignConfigText("teardownCommand");
  maybeAssignConfigText("cleanupCommand");

  if (initialState.inheritRuntime !== nextState.inheritRuntime || initialState.workspaceRuntime !== nextState.workspaceRuntime) {
    const parsed = parseWorkspaceRuntimeJson(nextState.workspaceRuntime);
    if (!parsed.ok) throw new Error(parsed.error);
    configPatch.workspaceRuntime = nextState.inheritRuntime ? null : parsed.value;
  }

  if (Object.keys(configPatch).length > 0) {
    patch.config = configPatch;
  }

  return patch;
}

function validateForm(form: WorkspaceFormState) {
  const repoUrl = normalizeText(form.repoUrl);
  if (repoUrl) {
    try {
      new URL(repoUrl);
    } catch {
      return "저장소 URL은 유효한 URL이어야 합니다.";
    }
  }

  if (!form.inheritRuntime) {
    const runtimeJson = parseWorkspaceRuntimeJson(form.workspaceRuntime);
    if (!runtimeJson.ok) {
      return runtimeJson.error;
    }
  }

  return null;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1.5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        {hint ? <span className="text-[11px] leading-relaxed text-muted-foreground sm:text-right">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-1.5 sm:flex-row sm:items-start sm:gap-3">
      <div className="shrink-0 text-xs text-muted-foreground sm:w-32">{label}</div>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
    </div>
  );
}

function StatusPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground", className)}>
      {children}
    </div>
  );
}

function MonoValue({ value, copy }: { value: string; copy?: boolean }) {
  return (
    <div className="inline-flex max-w-full items-start gap-2">
      <span className="break-all font-mono text-xs">{value}</span>
      {copy ? (
        <CopyText text={value} className="shrink-0 text-muted-foreground hover:text-foreground" copiedLabel="복사됨">
          <Copy className="h-3.5 w-3.5" />
        </CopyText>
      ) : null}
    </div>
  );
}

function WorkspaceLink({
  project,
  workspace,
}: {
  project: Project;
  workspace: ProjectWorkspace;
}) {
  return <Link to={projectWorkspaceUrl(project, workspace.id)} className="hover:underline">{workspace.name}</Link>;
}

function ExecutionWorkspaceIssuesList({
  companyId,
  workspaceId,
  issues,
  isLoading,
  error,
  project,
}: {
  companyId: string;
  workspaceId: string;
  issues: Issue[];
  isLoading: boolean;
  error: Error | null;
  project: Project | null;
}) {
  const queryClient = useQueryClient();

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(companyId),
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId),
    enabled: !!companyId,
    refetchInterval: 5000,
  });

  const liveIssueIds = useMemo(() => {
    const ids = new Set<string>();
    for (const run of liveRuns ?? []) {
      if (run.issueId) ids.add(run.issueId);
    }
    return ids;
  }, [liveRuns]);

  const updateIssue = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => issuesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.listByExecutionWorkspace(companyId, workspaceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) });
      if (project?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.listByProject(companyId, project.id) });
      }
    },
  });

  const projectOptions = useMemo(
    () => (project ? [{ id: project.id, name: project.name, workspaces: project.workspaces ?? [] }] : undefined),
    [project],
  );

  return (
    <IssuesList
      issues={issues}
      isLoading={isLoading}
      error={error}
      agents={agents}
      projects={projectOptions}
      liveIssueIds={liveIssueIds}
      projectId={project?.id}
      viewStateKey="paperclip:execution-workspace-issues-view"
      onUpdateIssue={(id, data) => updateIssue.mutate({ id, data })}
    />
  );
}

export function ExecutionWorkspaceDetail() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const [form, setForm] = useState<WorkspaceFormState | null>(null);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runtimeActionErrorMessage, setRuntimeActionErrorMessage] = useState<string | null>(null);
  const [runtimeActionMessage, setRuntimeActionMessage] = useState<string | null>(null);
  const activeTab = workspaceId ? resolveExecutionWorkspaceTab(location.pathname, workspaceId) : null;

  const workspaceQuery = useQuery({
    queryKey: queryKeys.executionWorkspaces.detail(workspaceId!),
    queryFn: () => executionWorkspacesApi.get(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const workspace = workspaceQuery.data ?? null;

  const projectQuery = useQuery({
    queryKey: workspace ? [...queryKeys.projects.detail(workspace.projectId), workspace.companyId] : ["projects", "detail", "__pending__"],
    queryFn: () => projectsApi.get(workspace!.projectId, workspace!.companyId),
    enabled: Boolean(workspace?.projectId),
  });
  const project = projectQuery.data ?? null;

  const sourceIssueQuery = useQuery({
    queryKey: workspace?.sourceIssueId ? queryKeys.issues.detail(workspace.sourceIssueId) : ["issues", "detail", "__none__"],
    queryFn: () => issuesApi.get(workspace!.sourceIssueId!),
    enabled: Boolean(workspace?.sourceIssueId),
  });
  const sourceIssue = sourceIssueQuery.data ?? null;

  const derivedWorkspaceQuery = useQuery({
    queryKey: workspace?.derivedFromExecutionWorkspaceId
      ? queryKeys.executionWorkspaces.detail(workspace.derivedFromExecutionWorkspaceId)
      : ["execution-workspaces", "detail", "__none__"],
    queryFn: () => executionWorkspacesApi.get(workspace!.derivedFromExecutionWorkspaceId!),
    enabled: Boolean(workspace?.derivedFromExecutionWorkspaceId),
  });
  const derivedWorkspace = derivedWorkspaceQuery.data ?? null;
  const linkedIssuesQuery = useQuery({
    queryKey: workspace
      ? queryKeys.issues.listByExecutionWorkspace(workspace.companyId, workspace.id)
      : ["issues", "__execution-workspace__", "__none__"],
    queryFn: () => issuesApi.list(workspace!.companyId, { executionWorkspaceId: workspace!.id }),
    enabled: Boolean(workspace?.companyId),
  });
  const linkedIssues = linkedIssuesQuery.data ?? [];

  const linkedProjectWorkspace = useMemo(
    () => project?.workspaces.find((item) => item.id === workspace?.projectWorkspaceId) ?? null,
    [project, workspace?.projectWorkspaceId],
  );
  const inheritedRuntimeConfig = linkedProjectWorkspace?.runtimeConfig?.workspaceRuntime ?? null;
  const effectiveRuntimeConfig = workspace?.config?.workspaceRuntime ?? inheritedRuntimeConfig;
  const runtimeConfigSource =
    workspace?.config?.workspaceRuntime
      ? "execution_workspace"
      : inheritedRuntimeConfig
        ? "project_workspace"
        : "none";

  const initialState = useMemo(() => (workspace ? formStateFromWorkspace(workspace) : null), [workspace]);
  const isDirty = Boolean(form && initialState && JSON.stringify(form) !== JSON.stringify(initialState));
  const projectRef = project ? projectRouteRef(project) : workspace?.projectId ?? "";

  useEffect(() => {
    if (!workspace?.companyId || workspace.companyId === selectedCompanyId) return;
    setSelectedCompanyId(workspace.companyId, { source: "route_sync" });
  }, [workspace?.companyId, selectedCompanyId, setSelectedCompanyId]);

  useEffect(() => {
    if (!workspace) return;
    setForm(formStateFromWorkspace(workspace));
    setErrorMessage(null);
    setRuntimeActionErrorMessage(null);
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;
    const crumbs = [
      { label: "프로젝트", href: "/projects" },
      ...(project ? [{ label: project.name, href: `/projects/${projectRef}` }] : []),
      ...(project ? [{ label: "워크스페이스", href: `/projects/${projectRef}/workspaces` }] : []),
      { label: workspace.name },
    ];
    setBreadcrumbs(crumbs);
  }, [setBreadcrumbs, workspace, project, projectRef]);

  const updateWorkspace = useMutation({
    mutationFn: (patch: Record<string, unknown>) => executionWorkspacesApi.update(workspace!.id, patch),
    onSuccess: (nextWorkspace) => {
      queryClient.setQueryData(queryKeys.executionWorkspaces.detail(nextWorkspace.id), nextWorkspace);
      queryClient.invalidateQueries({ queryKey: queryKeys.executionWorkspaces.closeReadiness(nextWorkspace.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.executionWorkspaces.workspaceOperations(nextWorkspace.id) });
      if (project) {
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.urlKey) });
      }
      if (sourceIssue) {
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(sourceIssue.id) });
      }
      setErrorMessage(null);
    },
    onError: (error) => {
      setErrorMessage(error instanceof Error ? error.message : "실행 워크스페이스 저장에 실패했습니다.");
    },
  });
  const workspaceOperationsQuery = useQuery({
    queryKey: queryKeys.executionWorkspaces.workspaceOperations(workspaceId!),
    queryFn: () => executionWorkspacesApi.listWorkspaceOperations(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const controlRuntimeServices = useMutation({
    mutationFn: (request: WorkspaceRuntimeControlRequest) =>
      executionWorkspacesApi.controlRuntimeCommands(workspace!.id, request.action, request),
    onSuccess: (result, request) => {
      queryClient.setQueryData(queryKeys.executionWorkspaces.detail(result.workspace.id), result.workspace);
      queryClient.invalidateQueries({ queryKey: queryKeys.executionWorkspaces.workspaceOperations(result.workspace.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(result.workspace.projectId) });
      setRuntimeActionErrorMessage(null);
      setRuntimeActionMessage(
        request.action === "run"
          ? "워크스페이스 작업이 완료됐습니다."
          : request.action === "stop"
            ? "워크스페이스 서비스가 중지됐습니다."
            : request.action === "restart"
              ? "워크스페이스 서비스가 재시작됐습니다."
              : "워크스페이스 서비스가 시작됐습니다.",
      );
    },
    onError: (error) => {
      setRuntimeActionMessage(null);
      setRuntimeActionErrorMessage(error instanceof Error ? error.message : "워크스페이스 명령 제어에 실패했습니다.");
    },
  });

  if (workspaceQuery.isLoading) return <p className="text-sm text-muted-foreground">워크스페이스 로딩 중…</p>;
  if (workspaceQuery.error) {
    return (
      <p className="text-sm text-destructive">
        {workspaceQuery.error instanceof Error ? workspaceQuery.error.message : "워크스페이스를 불러오지 못했습니다"}
      </p>
    );
  }
  if (!workspace || !form || !initialState) return null;

  const canRunWorkspaceCommands = Boolean(workspace.cwd);
  const canStartRuntimeServices = Boolean(effectiveRuntimeConfig) && canRunWorkspaceCommands;
  const runtimeControlSections = buildWorkspaceRuntimeControlSections({
    runtimeConfig: effectiveRuntimeConfig,
    runtimeServices: workspace.runtimeServices ?? [],
    canStartServices: canStartRuntimeServices,
    canRunJobs: canRunWorkspaceCommands,
  });
  const pendingRuntimeAction = controlRuntimeServices.isPending ? controlRuntimeServices.variables ?? null : null;

  if (workspaceId && activeTab === null) {
    let cachedTab: ExecutionWorkspaceTab = "configuration";
    try {
      const storedTab = localStorage.getItem(`paperclip:execution-workspace-tab:${workspaceId}`);
      if (storedTab === "issues" || storedTab === "configuration" || storedTab === "runtime_logs") {
        cachedTab = storedTab;
      }
    } catch {}
    return <Navigate to={executionWorkspaceTabPath(workspaceId, cachedTab)} replace />;
  }

  const handleTabChange = (tab: ExecutionWorkspaceTab) => {
    try {
      localStorage.setItem(`paperclip:execution-workspace-tab:${workspace.id}`, tab);
    } catch {}
    navigate(executionWorkspaceTabPath(workspace.id, tab));
  };

  const saveChanges = () => {
    const validationError = validateForm(form);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    let patch: Record<string, unknown>;
    try {
      patch = buildWorkspacePatch(initialState, form);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "워크스페이스 업데이트 생성에 실패했습니다.");
      return;
    }

    if (Object.keys(patch).length === 0) return;
    updateWorkspace.mutate(patch);
  };

  return (
    <>
      <div className="space-y-4 overflow-hidden sm:space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to={project ? `/projects/${projectRef}/workspaces` : "/projects"}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              모든 워크스페이스로 돌아가기
            </Link>
          </Button>
          <StatusPill>{workspace.mode}</StatusPill>
          <StatusPill>{workspace.providerType}</StatusPill>
          <StatusPill className={workspace.status === "active" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : undefined}>
            {workspace.status}
          </StatusPill>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            실행 워크스페이스
          </div>
          <h1 className="truncate text-xl font-semibold sm:text-2xl">{workspace.name}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Paperclip이 이 이슈 플로우에서 재사용할 구체적인 런타임 워크스페이스를 구성합니다.
            <span className="hidden sm:inline"> 이 설정은 실행 워크스페이스에 연결되어, 향후 실행 시 로컬 경로·저장소 참조·프로비저닝·정리·런타임 서비스 동작이 실제 재사용 중인 워크스페이스와 동기화된 상태를 유지합니다.</span>
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">워크스페이스 명령</div>
              <h2 className="text-lg font-semibold">서비스 및 작업</h2>
              <p className="text-sm text-muted-foreground">
                출처: {runtimeConfigSource === "execution_workspace"
                  ? "실행 워크스페이스 재정의"
                  : runtimeConfigSource === "project_workspace"
                    ? "프로젝트 워크스페이스 기본값"
                    : "없음"}
              </p>
            </div>
          </div>
          <WorkspaceRuntimeControls
            className="mt-4"
            sections={runtimeControlSections}
            isPending={controlRuntimeServices.isPending}
            pendingRequest={pendingRuntimeAction}
            serviceEmptyMessage={
              effectiveRuntimeConfig
                ? "이 실행 워크스페이스에서 아직 시작된 서비스가 없습니다."
                : "이 실행 워크스페이스에 정의된 워크스페이스 명령 설정이 없습니다."
            }
            jobEmptyMessage="이 실행 워크스페이스에 구성된 단발성 작업이 없습니다."
            disabledHint={
              canStartRuntimeServices
                ? null
                : "실행 워크스페이스는 로컬 명령을 실행하기 전에 작업 디렉토리가 필요하며, 서비스는 런타임 설정도 필요합니다."
            }
            onAction={(request) => controlRuntimeServices.mutate(request)}
          />
          {runtimeActionErrorMessage ? <p className="mt-4 text-sm text-destructive">{runtimeActionErrorMessage}</p> : null}
          {!runtimeActionErrorMessage && runtimeActionMessage ? <p className="mt-4 text-sm text-muted-foreground">{runtimeActionMessage}</p> : null}
        </div>

        <Tabs value={activeTab ?? "configuration"} onValueChange={(value) => handleTabChange(value as ExecutionWorkspaceTab)}>
          <PageTabBar
            items={[
              { value: "configuration", label: "설정" },
              { value: "runtime_logs", label: "런타임 로그" },
              { value: "issues", label: "이슈" },
            ]}
            align="start"
            value={activeTab ?? "configuration"}
            onValueChange={(value) => handleTabChange(value as ExecutionWorkspaceTab)}
          />
        </Tabs>

        {activeTab === "configuration" ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    설정
                  </div>
                  <h2 className="text-lg font-semibold">워크스페이스 설정</h2>
                  <p className="text-sm text-muted-foreground">
                    이 실행 워크스페이스에 연결된 경로, 저장소, 브랜치, 프로비저닝, 정리, 런타임 재정의를 수정합니다.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setCloseDialogOpen(true)}
                  disabled={workspace.status === "archived"}
                >
                  {workspace.status === "cleanup_failed" ? "닫기 재시도" : "워크스페이스 닫기"}
                </Button>
              </div>

              <Separator className="my-5" />

              <div className="space-y-4">
                <Field label="워크스페이스 이름">
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                    value={form.name}
                    onChange={(event) => setForm((current) => current ? { ...current, name: event.target.value } : current)}
                    placeholder="실행 워크스페이스 이름"
                  />
                </Field>

                <Field label="브랜치 이름" hint="격리된 worktree에 유용합니다">
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.branchName}
                    onChange={(event) => setForm((current) => current ? { ...current, branchName: event.target.value } : current)}
                    placeholder="PAP-946-workspace"
                  />
                </Field>

                <Field label="작업 디렉토리">
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.cwd}
                    onChange={(event) => setForm((current) => current ? { ...current, cwd: event.target.value } : current)}
                    placeholder="/absolute/path/to/workspace"
                  />
                </Field>

                <Field label="공급자 경로 / 참조">
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.providerRef}
                    onChange={(event) => setForm((current) => current ? { ...current, providerRef: event.target.value } : current)}
                    placeholder="/path/to/worktree or provider ref"
                  />
                </Field>

                <Field label="저장소 URL">
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none"
                    value={form.repoUrl}
                    onChange={(event) => setForm((current) => current ? { ...current, repoUrl: event.target.value } : current)}
                    placeholder="https://github.com/org/repo"
                  />
                </Field>

                <Field label="베이스 참조">
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none"
                    value={form.baseRef}
                    onChange={(event) => setForm((current) => current ? { ...current, baseRef: event.target.value } : current)}
                    placeholder="origin/main"
                  />
                </Field>

                <Field label="프로비저닝 명령" hint="Paperclip이 이 실행 워크스페이스를 준비할 때 실행됩니다">
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none sm:min-h-28"
                    value={form.provisionCommand}
                    onChange={(event) => setForm((current) => current ? { ...current, provisionCommand: event.target.value } : current)}
                    placeholder="bash ./scripts/provision-worktree.sh"
                  />
                </Field>

                <Field label="정리(teardown) 명령" hint="실행 워크스페이스가 보관되거나 정리될 때 실행됩니다">
                  <textarea
                    className="min-h-20 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none sm:min-h-28"
                    value={form.teardownCommand}
                    onChange={(event) => setForm((current) => current ? { ...current, teardownCommand: event.target.value } : current)}
                    placeholder="bash ./scripts/teardown-worktree.sh"
                  />
                </Field>

                <Field label="클린업 명령" hint="teardown 전 워크스페이스별 정리">
                  <textarea
                    className="min-h-16 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none sm:min-h-24"
                    value={form.cleanupCommand}
                    onChange={(event) => setForm((current) => current ? { ...current, cleanupCommand: event.target.value } : current)}
                    placeholder="pkill -f vite || true"
                  />
                </Field>

                <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        런타임 설정 출처
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {runtimeConfigSource === "execution_workspace"
                          ? "이 실행 워크스페이스가 현재 프로젝트 워크스페이스 런타임 설정을 재정의하고 있습니다."
                          : runtimeConfigSource === "project_workspace"
                            ? "이 실행 워크스페이스가 프로젝트 워크스페이스 런타임 설정을 상속받고 있습니다."
                            : "이 실행 워크스페이스 또는 프로젝트 워크스페이스에 정의된 런타임 설정이 없습니다."}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      size="sm"
                      disabled={!linkedProjectWorkspace?.runtimeConfig?.workspaceRuntime}
                      onClick={() =>
                        setForm((current) => current ? {
                          ...current,
                          inheritRuntime: true,
                          workspaceRuntime: "",
                        } : current)
                      }
                    >
                      상속으로 초기화
                    </Button>
                  </div>
                </div>

                <details className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-3 py-3">
                  <summary className="cursor-pointer text-sm font-medium">고급 런타임 JSON</summary>
                  <p className="mt-2 text-sm text-muted-foreground">
                    이 실행 워크스페이스에 실제로 다른 서비스 또는 작업 동작이 필요한 경우에만 상속된 워크스페이스 명령 모델을 재정의하세요.
                  </p>
                  <div className="mt-3">
                    <Field label="워크스페이스 명령 JSON" hint="기존 `services` 배열도 동작하지만, `commands`는 서비스와 작업 모두 지원합니다.">
                      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <input
                          id="inherit-runtime-config"
                          type="checkbox"
                          checked={form.inheritRuntime}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setForm((current) => {
                              if (!current) return current;
                              if (!checked && !current.workspaceRuntime.trim() && inheritedRuntimeConfig) {
                                return { ...current, inheritRuntime: checked, workspaceRuntime: formatJson(inheritedRuntimeConfig) };
                              }
                              return { ...current, inheritRuntime: checked };
                            });
                          }}
                        />
                        <label htmlFor="inherit-runtime-config">프로젝트 워크스페이스 런타임 설정 상속</label>
                      </div>
                      <textarea
                        className="min-h-64 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-96"
                        value={form.workspaceRuntime}
                        onChange={(event) => setForm((current) => current ? { ...current, workspaceRuntime: event.target.value } : current)}
                        disabled={form.inheritRuntime}
                        placeholder={'{\n  "commands": [\n    {\n      "id": "web",\n      "name": "web",\n      "kind": "service",\n      "command": "pnpm dev",\n      "cwd": ".",\n      "port": { "type": "auto" }\n    },\n    {\n      "id": "db-migrate",\n      "name": "db:migrate",\n      "kind": "job",\n      "command": "pnpm db:migrate",\n      "cwd": "."\n    }\n  ]\n}'}
                      />
                    </Field>
                  </div>
                </details>
              </div>

              <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button className="w-full sm:w-auto" disabled={!isDirty || updateWorkspace.isPending} onClick={saveChanges}>
                  {updateWorkspace.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  변경사항 저장
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!isDirty || updateWorkspace.isPending}
                  onClick={() => {
                    setForm(initialState);
                    setErrorMessage(null);
                    setRuntimeActionErrorMessage(null);
                    setRuntimeActionMessage(null);
                  }}
                >
                  초기화
                </Button>
                {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
                {!errorMessage && !isDirty ? <p className="text-sm text-muted-foreground">저장되지 않은 변경사항이 없습니다.</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">연결된 객체</div>
                <h2 className="text-lg font-semibold">워크스페이스 컨텍스트</h2>
              </div>
              <Separator className="my-4" />
              <DetailRow label="프로젝트">
                {project ? <Link to={`/projects/${projectRef}`} className="hover:underline">{project.name}</Link> : <MonoValue value={workspace.projectId} />}
              </DetailRow>
              <DetailRow label="프로젝트 워크스페이스">
                {project && linkedProjectWorkspace ? (
                  <WorkspaceLink project={project} workspace={linkedProjectWorkspace} />
                ) : workspace.projectWorkspaceId ? (
                  <MonoValue value={workspace.projectWorkspaceId} />
                ) : (
                  "없음"
                )}
              </DetailRow>
              <DetailRow label="소스 이슈">
                {sourceIssue ? (
                  <Link to={issueUrl(sourceIssue)} className="hover:underline">
                    {sourceIssue.identifier ?? sourceIssue.id} · {sourceIssue.title}
                  </Link>
                ) : workspace.sourceIssueId ? (
                  <MonoValue value={workspace.sourceIssueId} />
                ) : (
                  "없음"
                )}
              </DetailRow>
              <DetailRow label="파생 출처">
                {derivedWorkspace ? (
                  <Link to={executionWorkspaceTabPath(derivedWorkspace.id, "configuration")} className="hover:underline">
                    {derivedWorkspace.name}
                  </Link>
                ) : workspace.derivedFromExecutionWorkspaceId ? (
                  <MonoValue value={workspace.derivedFromExecutionWorkspaceId} />
                ) : (
                  "없음"
                )}
              </DetailRow>
              <DetailRow label="워크스페이스 ID">
                <MonoValue value={workspace.id} />
              </DetailRow>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="space-y-1">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">경로 및 참조</div>
                <h2 className="text-lg font-semibold">실제 위치</h2>
              </div>
              <Separator className="my-4" />
              <DetailRow label="작업 디렉토리">
                {workspace.cwd ? <MonoValue value={workspace.cwd} copy /> : "없음"}
              </DetailRow>
              <DetailRow label="공급자 참조">
                {workspace.providerRef ? <MonoValue value={workspace.providerRef} copy /> : "없음"}
              </DetailRow>
              <DetailRow label="저장소 URL">
                {workspace.repoUrl && isSafeExternalUrl(workspace.repoUrl) ? (
                  <div className="inline-flex max-w-full items-start gap-2">
                    <a href={workspace.repoUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 break-all hover:underline">
                      {workspace.repoUrl}
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                    <CopyText text={workspace.repoUrl} className="shrink-0 text-muted-foreground hover:text-foreground" copiedLabel="복사됨">
                      <Copy className="h-3.5 w-3.5" />
                    </CopyText>
                  </div>
                ) : workspace.repoUrl ? (
                  <MonoValue value={workspace.repoUrl} copy />
                ) : (
                  "없음"
                )}
              </DetailRow>
              <DetailRow label="베이스 참조">
                {workspace.baseRef ? <MonoValue value={workspace.baseRef} copy /> : "없음"}
              </DetailRow>
              <DetailRow label="브랜치">
                {workspace.branchName ? <MonoValue value={workspace.branchName} copy /> : "없음"}
              </DetailRow>
              <DetailRow label="열린 시각">{formatDateTime(workspace.openedAt)}</DetailRow>
              <DetailRow label="마지막 사용">{formatDateTime(workspace.lastUsedAt)}</DetailRow>
              <DetailRow label="정리 일정">
                {workspace.cleanupEligibleAt
                  ? `${formatDateTime(workspace.cleanupEligibleAt)}${workspace.cleanupReason ? ` · ${workspace.cleanupReason}` : ""}`
                  : "예정 없음"}
              </DetailRow>
            </div>
          </div>
        ) : activeTab === "runtime_logs" ? (
          <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className="space-y-1">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">최근 작업</div>
              <h2 className="text-lg font-semibold">런타임 및 정리 로그</h2>
            </div>
            <Separator className="my-4" />
            {workspaceOperationsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">워크스페이스 작업 로딩 중…</p>
            ) : workspaceOperationsQuery.error ? (
              <p className="text-sm text-destructive">
                {workspaceOperationsQuery.error instanceof Error
                  ? workspaceOperationsQuery.error.message
                  : "워크스페이스 작업을 불러오지 못했습니다."}
              </p>
            ) : workspaceOperationsQuery.data && workspaceOperationsQuery.data.length > 0 ? (
              <div className="space-y-3">
                {workspaceOperationsQuery.data.map((operation) => (
                  <div key={operation.id} className="rounded-xl border border-border/80 bg-background px-3 py-2">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{operation.command ?? operation.phase}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateTime(operation.startedAt)}
                          {operation.finishedAt ? ` → ${formatDateTime(operation.finishedAt)}` : ""}
                        </div>
                        {operation.stderrExcerpt ? (
                          <div className="whitespace-pre-wrap break-words text-xs text-destructive">{operation.stderrExcerpt}</div>
                        ) : operation.stdoutExcerpt ? (
                          <div className="whitespace-pre-wrap break-words text-xs text-muted-foreground">{operation.stdoutExcerpt}</div>
                        ) : null}
                      </div>
                      <StatusPill className="self-start">{operation.status}</StatusPill>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">아직 기록된 워크스페이스 작업이 없습니다.</p>
            )}
          </div>
        ) : (
          <ExecutionWorkspaceIssuesList
            companyId={workspace.companyId}
            workspaceId={workspace.id}
            issues={linkedIssues}
            isLoading={linkedIssuesQuery.isLoading}
            error={linkedIssuesQuery.error as Error | null}
            project={project}
          />
        )}
      </div>
      <ExecutionWorkspaceCloseDialog
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        currentStatus={workspace.status}
        open={closeDialogOpen}
        onOpenChange={setCloseDialogOpen}
        onClosed={(nextWorkspace) => {
          queryClient.setQueryData(queryKeys.executionWorkspaces.detail(nextWorkspace.id), nextWorkspace);
          queryClient.invalidateQueries({ queryKey: queryKeys.executionWorkspaces.closeReadiness(nextWorkspace.id) });
          queryClient.invalidateQueries({ queryKey: queryKeys.executionWorkspaces.workspaceOperations(nextWorkspace.id) });
          if (project) {
            queryClient.invalidateQueries({ queryKey: queryKeys.projects.detail(project.id) });
            queryClient.invalidateQueries({ queryKey: queryKeys.executionWorkspaces.list(project.companyId, { projectId: project.id }) });
          }
          if (sourceIssue) {
            queryClient.invalidateQueries({ queryKey: queryKeys.issues.detail(sourceIssue.id) });
          }
        }}
      />
    </>
  );
}
