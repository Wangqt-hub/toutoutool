import {
  buildWorkspaceProgress,
  normalizeCompletedColorIndexes,
  type BeadWorkspaceColorUsage,
  type BeadWorkspaceOverview,
  type BeadWorkspacePatternData,
  type BeadWorkspaceRecord,
  type BeadWorkspaceSourceType,
  type BeadWorkspaceSummary,
} from "@/lib/bead/workspaces";

export type BeadWorkspaceRow = {
  id: string;
  user_id: string;
  name: string;
  source_type: BeadWorkspaceSourceType;
  brand: string;
  pattern_data?: BeadWorkspacePatternData;
  width: number;
  height: number;
  used_color_codes: BeadWorkspaceColorUsage[] | null;
  completed_color_indexes: number[] | null;
  selected_color_index: number | null;
  thumbnail_path: string | null;
  thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
};

export type BeadWorkspaceOverviewPayload = {
  currentWorkspaceId: string | null;
  rows: BeadWorkspaceRow[];
};

function buildWorkspaceThumbnailUrl(row: BeadWorkspaceRow): string | null {
  if (row.thumbnail_path) {
    return `/api/bead-workspaces/${row.id}/thumbnail`;
  }

  return row.thumbnail_url ?? null;
}

export function toWorkspaceSummary(
  row: BeadWorkspaceRow,
  currentWorkspaceId: string | null
): BeadWorkspaceSummary {
  const completedColorIndexes = normalizeCompletedColorIndexes(
    row.completed_color_indexes ?? []
  );
  const usedColorCodes = row.used_color_codes ?? [];

  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    brand: row.brand,
    width: row.width,
    height: row.height,
    usedColorCodes,
    completedColorIndexes,
    selectedColorIndex:
      typeof row.selected_color_index === "number" ? row.selected_color_index : null,
    thumbnailUrl: buildWorkspaceThumbnailUrl(row),
    thumbnailPath: row.thumbnail_path ?? null,
    isCurrent: row.id === currentWorkspaceId,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at ?? null,
    progress: buildWorkspaceProgress(usedColorCodes, completedColorIndexes),
  };
}

export function toWorkspaceRecord(
  row: BeadWorkspaceRow,
  currentWorkspaceId: string | null
): BeadWorkspaceRecord {
  if (!row.pattern_data) {
    throw new Error("Workspace pattern data is missing.");
  }

  return {
    ...toWorkspaceSummary(row, currentWorkspaceId),
    patternData: row.pattern_data,
  };
}

export function toWorkspaceOverview(
  payload: BeadWorkspaceOverviewPayload
): BeadWorkspaceOverview {
  const summaries = payload.rows.map((row) =>
    toWorkspaceSummary(row, payload.currentWorkspaceId)
  );

  return {
    current: summaries.find((item) => item.isCurrent) ?? null,
    history: summaries.filter((item) => !item.isCurrent),
  };
}
