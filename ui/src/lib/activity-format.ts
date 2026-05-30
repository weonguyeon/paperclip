import type { Agent } from "@paperclipai/shared";

type ActivityDetails = Record<string, unknown> | null | undefined;

type ActivityParticipant = {
  type: "agent" | "user";
  agentId?: string | null;
  userId?: string | null;
};

type ActivityIssueReference = {
  id?: string | null;
  identifier?: string | null;
  title?: string | null;
};

interface ActivityFormatOptions {
  agentMap?: Map<string, Agent>;
  currentUserId?: string | null;
}

// 활동 피드 행에서 쓰는 동사. ActivityRow는 "{행위자} {대상} {동사}" 순서로
// 렌더링하므로(한국어 어순), 동사는 대상 뒤에 오는 개조식 술어("~함")로 둔다.
const ACTIVITY_ROW_VERBS: Record<string, string> = {
  "issue.created": "생성함",
  "issue.updated": "수정함",
  "issue.checked_out": "체크아웃함",
  "issue.released": "반납함",
  "issue.comment_added": "댓글 작성함",
  "issue.comment_cancelled": "대기 중인 댓글 취소함",
  "issue.attachment_added": "첨부파일 추가함",
  "issue.attachment_removed": "첨부파일 제거함",
  "issue.document_created": "문서 생성함",
  "issue.document_updated": "문서 수정함",
  "issue.document_deleted": "문서 삭제함",
  "issue.commented": "댓글 작성함",
  "issue.deleted": "삭제함",
  "agent.created": "생성함",
  "agent.updated": "수정함",
  "agent.paused": "일시정지함",
  "agent.resumed": "재개함",
  "agent.terminated": "종료함",
  "agent.key_created": "API 키 생성함",
  "agent.budget_updated": "예산 변경함",
  "agent.runtime_session_reset": "세션 초기화함",
  "heartbeat.invoked": "하트비트 실행함",
  "heartbeat.cancelled": "하트비트 취소함",
  "approval.created": "승인 요청함",
  "approval.approved": "승인함",
  "approval.rejected": "반려함",
  "project.created": "생성함",
  "project.updated": "수정함",
  "project.deleted": "삭제함",
  "goal.created": "생성함",
  "goal.updated": "수정함",
  "goal.deleted": "삭제함",
  "cost.reported": "비용 보고함",
  "cost.recorded": "비용 기록함",
  "company.created": "회사 생성함",
  "company.updated": "회사 정보 수정함",
  "company.archived": "보관함",
  "company.budget_updated": "예산 변경함",
};

// 이슈 상세의 활동 목록에서 쓰는 완결 술어. "{행위자} {술어}" 순서로 렌더링된다.
const ISSUE_ACTIVITY_LABELS: Record<string, string> = {
  "issue.created": "이슈를 생성함",
  "issue.updated": "이슈를 수정함",
  "issue.checked_out": "이슈를 체크아웃함",
  "issue.released": "이슈를 반납함",
  "issue.comment_added": "댓글을 작성함",
  "issue.comment_cancelled": "대기 중인 댓글을 취소함",
  "issue.feedback_vote_saved": "AI 출력에 피드백을 저장함",
  "issue.attachment_added": "첨부파일을 추가함",
  "issue.attachment_removed": "첨부파일을 제거함",
  "issue.document_created": "문서를 생성함",
  "issue.document_updated": "문서를 수정함",
  "issue.document_deleted": "문서를 삭제함",
  "issue.deleted": "이슈를 삭제함",
  "agent.created": "에이전트를 생성함",
  "agent.updated": "에이전트를 수정함",
  "agent.paused": "에이전트를 일시정지함",
  "agent.resumed": "에이전트를 재개함",
  "agent.terminated": "에이전트를 종료함",
  "heartbeat.invoked": "하트비트를 실행함",
  "heartbeat.cancelled": "하트비트를 취소함",
  "approval.created": "승인을 요청함",
  "approval.approved": "승인함",
  "approval.rejected": "반려함",
};

// 상태/우선순위 값의 한글 표기.
const STATUS_VALUE_LABELS: Record<string, string> = {
  todo: "할 일",
  in_progress: "진행 중",
  in_review: "리뷰 중",
  done: "완료",
  blocked: "차단됨",
  cancelled: "취소됨",
  backlog: "백로그",
  open: "열림",
  closed: "닫힘",
};

const PRIORITY_VALUE_LABELS: Record<string, string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
  none: "없음",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function localizeStatus(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "없음");
  return STATUS_VALUE_LABELS[value] ?? value.replace(/_/g, " ");
}

function localizePriority(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "없음");
  return PRIORITY_VALUE_LABELS[value] ?? value.replace(/_/g, " ");
}

function isActivityParticipant(value: unknown): value is ActivityParticipant {
  const record = asRecord(value);
  if (!record) return false;
  return record.type === "agent" || record.type === "user";
}

function isActivityIssueReference(value: unknown): value is ActivityIssueReference {
  return asRecord(value) !== null;
}

function readParticipants(details: ActivityDetails, key: string): ActivityParticipant[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityParticipant);
}

function readIssueReferences(details: ActivityDetails, key: string): ActivityIssueReference[] {
  const value = details?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter(isActivityIssueReference);
}

function formatUserLabel(userId: string | null | undefined, currentUserId?: string | null): string {
  if (!userId || userId === "local-board") return "보드";
  if (currentUserId && userId === currentUserId) return "나";
  return `사용자 ${userId.slice(0, 5)}`;
}

function formatParticipantLabel(participant: ActivityParticipant, options: ActivityFormatOptions): string {
  if (participant.type === "agent") {
    const agentId = participant.agentId ?? "";
    return options.agentMap?.get(agentId)?.name ?? "에이전트";
  }
  return formatUserLabel(participant.userId, options.currentUserId);
}

function formatIssueReferenceLabel(reference: ActivityIssueReference): string {
  if (reference.identifier) return reference.identifier;
  if (reference.title) return reference.title;
  if (reference.id) return reference.id.slice(0, 8);
  return "이슈";
}

// 단수/복수 구분이 없는 한국어에 맞춰 "{명사} {대상}" 또는 "{명사} N개"로 표기한다.
function formatChangedEntityLabel(noun: string, labels: string[]): string {
  if (labels.length <= 0) return noun;
  if (labels.length === 1) return `${noun} ${labels[0]}`;
  return `${noun} ${labels.length}개`;
}

function formatIssueUpdatedVerb(details: ActivityDetails): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  if (details.status !== undefined) {
    const from = previous.status;
    return from
      ? `상태: ${localizeStatus(from)} → ${localizeStatus(details.status)}`
      : `상태: ${localizeStatus(details.status)}`;
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    return from
      ? `우선순위: ${localizePriority(from)} → ${localizePriority(details.priority)}`
      : `우선순위: ${localizePriority(details.priority)}`;
  }
  return null;
}

function formatIssueUpdatedAction(details: ActivityDetails): string | null {
  if (!details) return null;
  const previous = asRecord(details._previous) ?? {};
  const parts: string[] = [];

  if (details.status !== undefined) {
    const from = previous.status;
    parts.push(
      from
        ? `상태 변경: ${localizeStatus(from)} → ${localizeStatus(details.status)}`
        : `상태 변경: ${localizeStatus(details.status)}`,
    );
  }
  if (details.priority !== undefined) {
    const from = previous.priority;
    parts.push(
      from
        ? `우선순위 변경: ${localizePriority(from)} → ${localizePriority(details.priority)}`
        : `우선순위 변경: ${localizePriority(details.priority)}`,
    );
  }
  if (details.assigneeAgentId !== undefined || details.assigneeUserId !== undefined) {
    parts.push(details.assigneeAgentId || details.assigneeUserId ? "담당자 지정" : "담당자 해제");
  }
  if (details.title !== undefined) parts.push("제목 수정");
  if (details.description !== undefined) parts.push("설명 수정");

  return parts.length > 0 ? parts.join(", ") : null;
}

function formatStructuredIssueChange(input: {
  action: string;
  details: ActivityDetails;
  options: ActivityFormatOptions;
  forIssueDetail: boolean;
}): string | null {
  const details = input.details;
  if (!details) return null;

  if (input.action === "issue.blockers_updated") {
    const added = readIssueReferences(details, "addedBlockedByIssues").map(formatIssueReferenceLabel);
    const removed = readIssueReferences(details, "removedBlockedByIssues").map(formatIssueReferenceLabel);
    if (added.length > 0 && removed.length === 0) {
      return `${formatChangedEntityLabel("차단 이슈", added)} 추가함`;
    }
    if (removed.length > 0 && added.length === 0) {
      return `${formatChangedEntityLabel("차단 이슈", removed)} 제거함`;
    }
    return "차단 이슈 수정함";
  }

  if (input.action === "issue.reviewers_updated" || input.action === "issue.approvers_updated") {
    const added = readParticipants(details, "addedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const removed = readParticipants(details, "removedParticipants").map((participant) => formatParticipantLabel(participant, input.options));
    const noun = input.action === "issue.reviewers_updated" ? "리뷰어" : "승인자";
    if (added.length > 0 && removed.length === 0) {
      return `${formatChangedEntityLabel(noun, added)} 추가함`;
    }
    if (removed.length > 0 && added.length === 0) {
      return `${formatChangedEntityLabel(noun, removed)} 제거함`;
    }
    return `${noun} 수정함`;
  }

  return null;
}

export function formatActivityVerb(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueUpdatedVerb = formatIssueUpdatedVerb(details);
    if (issueUpdatedVerb) return issueUpdatedVerb;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: false,
  });
  if (structuredChange) return structuredChange;

  return ACTIVITY_ROW_VERBS[action] ?? action.replace(/[._]/g, " ");
}

export function formatIssueActivityAction(
  action: string,
  details?: Record<string, unknown> | null,
  options: ActivityFormatOptions = {},
): string {
  if (action === "issue.updated") {
    const issueUpdatedAction = formatIssueUpdatedAction(details);
    if (issueUpdatedAction) return issueUpdatedAction;
  }

  const structuredChange = formatStructuredIssueChange({
    action,
    details,
    options,
    forIssueDetail: true,
  });
  if (structuredChange) return structuredChange;

  if (
    (action === "issue.document_created" || action === "issue.document_updated" || action === "issue.document_deleted") &&
    details
  ) {
    const key = typeof details.key === "string" ? details.key : "문서";
    const title = typeof details.title === "string" && details.title ? ` (${details.title})` : "";
    return `${ISSUE_ACTIVITY_LABELS[action] ?? action} ${key}${title}`;
  }

  return ISSUE_ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, " ");
}
