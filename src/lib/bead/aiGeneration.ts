export const AI_GENERATION_BUCKET = "bead-ai-images";

export const AI_GENERATION_STATUS_ORDER = [
  "UPLOADING_SOURCE",
  "PENDING",
  "RUNNING",
  "SAVING_RESULT",
  "SUCCEEDED",
  "FAILED",
] as const;

export type AIGenerationStatus =
  (typeof AI_GENERATION_STATUS_ORDER)[number];

export type AIGenerationImageKind = "source" | "ai";

export interface AIGenerationHistoryRow {
  id: string;
  user_id: string;
  style_id: string;
  style_name: string;
  prompt: string;
  status: AIGenerationStatus;
  progress_percent: number;
  source_image_path: string;
  ai_image_path: string | null;
  dashscope_task_id: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AIGenerationHistoryItem {
  id: string;
  styleId: string;
  styleName: string;
  prompt: string;
  status: AIGenerationStatus;
  statusLabel: string;
  progressPercent: number;
  sourceImageUrl: string;
  sourceImageProxyUrl: string;
  sourceThumbnailUrl: string;
  aiImageUrl: string | null;
  aiImageProxyUrl: string | null;
  aiThumbnailUrl: string | null;
  historyThumbnailUrl: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export const AI_GENERATION_PROGRESS: Record<AIGenerationStatus, number> = {
  UPLOADING_SOURCE: 10,
  PENDING: 30,
  RUNNING: 70,
  SAVING_RESULT: 90,
  SUCCEEDED: 100,
  FAILED: 100,
};

export const AI_GENERATION_STATUS_LABELS: Record<
  AIGenerationStatus,
  string
> = {
  UPLOADING_SOURCE: "上传原图",
  PENDING: "排队中",
  RUNNING: "生成中",
  SAVING_RESULT: "保存结果",
  SUCCEEDED: "已完成",
  FAILED: "失败",
};

export const AI_GENERATION_ACTIVE_STATUSES: AIGenerationStatus[] = [
  "UPLOADING_SOURCE",
  "PENDING",
  "RUNNING",
  "SAVING_RESULT",
];

export const AI_GENERATION_TERMINAL_STATUSES: AIGenerationStatus[] = [
  "SUCCEEDED",
  "FAILED",
];

export function isAIGenerationActive(
  status: AIGenerationStatus
): boolean {
  return AI_GENERATION_ACTIVE_STATUSES.includes(status);
}

export function isAIGenerationTerminal(
  status: AIGenerationStatus
): boolean {
  return AI_GENERATION_TERMINAL_STATUSES.includes(status);
}

export function buildAIGenerationImageUrl(
  generationId: string,
  kind: AIGenerationImageKind
): string {
  return `/api/ai-generate/history/${generationId}/image?kind=${kind}`;
}

export function toAIGenerationHistoryItem(
  row: AIGenerationHistoryRow
): AIGenerationHistoryItem {
  const sourceImageProxyUrl = buildAIGenerationImageUrl(row.id, "source");
  const aiImageProxyUrl = row.ai_image_path
    ? buildAIGenerationImageUrl(row.id, "ai")
    : null;
  const aiImageUrl = aiImageProxyUrl;
  const aiThumbnailUrl = aiImageProxyUrl;
  const sourceImageUrl = sourceImageProxyUrl;
  const sourceThumbnailUrl = sourceImageProxyUrl;

  return {
    id: row.id,
    styleId: row.style_id,
    styleName: row.style_name,
    prompt: row.prompt,
    status: row.status,
    statusLabel: AI_GENERATION_STATUS_LABELS[row.status],
    progressPercent: row.progress_percent,
    sourceImageUrl,
    sourceImageProxyUrl,
    sourceThumbnailUrl,
    aiImageUrl,
    aiImageProxyUrl,
    aiThumbnailUrl,
    historyThumbnailUrl: aiThumbnailUrl || sourceThumbnailUrl,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}
