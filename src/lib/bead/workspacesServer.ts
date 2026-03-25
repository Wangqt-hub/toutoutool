import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  MAX_BEAD_WORKSPACES,
  WORKSPACE_LIMIT_ERROR_CODE,
  buildWorkspaceColorUsage,
  buildWorkspaceProgress,
  createWorkspaceName,
  getWorkspaceDimensions,
  normalizeCompletedColorIndexes,
  type BeadWorkspaceColorUsage,
  type BeadWorkspaceLimitData,
  type BeadWorkspaceOverview,
  type BeadWorkspacePatternData,
  type BeadWorkspaceRecord,
  type BeadWorkspaceSourceType,
  type BeadWorkspaceSummary,
  type CreateBeadWorkspaceInput,
  type UpdateBeadWorkspaceStateInput,
} from "@/lib/bead/workspaces";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

type WorkspaceRow = {
  id: string;
  user_id: string;
  name: string;
  source_type: BeadWorkspaceSourceType;
  brand: string;
  pattern_data?: BeadWorkspacePatternData;
  width: number;
  height: number;
  used_color_codes: BeadWorkspaceColorUsage[];
  completed_color_indexes: number[];
  selected_color_index: number | null;
  thumbnail_path: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
};

type BucketInfo = {
  id: string;
  public?: boolean | null;
};

const WORKSPACE_BUCKET = "bead-patterns";
const WORKSPACE_BUCKET_FILE_SIZE_LIMIT = 2 * 1024 * 1024;
const WORKSPACE_BUCKET_ALLOWED_MIME_TYPES = ["image/png"];

export class BeadWorkspaceLimitError extends Error {
  code = WORKSPACE_LIMIT_ERROR_CODE;
  status = 409;
  data: BeadWorkspaceLimitData;

  constructor(data: BeadWorkspaceLimitData) {
    super(
      `当前草稿和历史图纸最多保留 ${data.maxWorkspaces} 条，请先删除 ${
        data.requiredDeletionCount
      } 条记录。`
    );
    this.name = "BeadWorkspaceLimitError";
    this.data = data;
  }
}

function getOverviewSelect() {
  return [
    "id",
    "user_id",
    "name",
    "source_type",
    "brand",
    "width",
    "height",
    "used_color_codes",
    "completed_color_indexes",
    "selected_color_index",
    "thumbnail_path",
    "is_current",
    "created_at",
    "updated_at",
    "last_opened_at",
  ].join(",");
}

function getDetailSelect() {
  return `${getOverviewSelect()},pattern_data`;
}

function toSummary(row: WorkspaceRow, thumbnailUrl: string | null): BeadWorkspaceSummary {
  const completedColorIndexes = normalizeCompletedColorIndexes(
    row.completed_color_indexes ?? []
  );

  return {
    id: row.id,
    name: row.name,
    sourceType: row.source_type,
    brand: row.brand,
    width: row.width,
    height: row.height,
    usedColorCodes: row.used_color_codes ?? [],
    completedColorIndexes,
    selectedColorIndex:
      typeof row.selected_color_index === "number" ? row.selected_color_index : null,
    thumbnailUrl,
    thumbnailPath: row.thumbnail_path ?? null,
    isCurrent: row.is_current,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastOpenedAt: row.last_opened_at ?? null,
    progress: buildWorkspaceProgress(row.used_color_codes ?? [], completedColorIndexes),
  };
}

function toRecord(row: WorkspaceRow, thumbnailUrl: string | null): BeadWorkspaceRecord {
  if (!row.pattern_data) {
    throw new Error("Workspace pattern data is missing.");
  }

  return {
    ...toSummary(row, thumbnailUrl),
    patternData: row.pattern_data,
  };
}

async function ensureWorkspaceBucket(supabaseAdmin: SupabaseAdminClient) {
  const { data, error } = await supabaseAdmin.storage.listBuckets();

  if (error) {
    throw new Error(error.message);
  }

  const bucket = (data?.find((item) => item.id === WORKSPACE_BUCKET) ??
    null) as BucketInfo | null;

  if (!bucket) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(
      WORKSPACE_BUCKET,
      {
        public: true,
        fileSizeLimit: WORKSPACE_BUCKET_FILE_SIZE_LIMIT,
        allowedMimeTypes: WORKSPACE_BUCKET_ALLOWED_MIME_TYPES,
      }
    );

    if (createError && !createError.message.toLowerCase().includes("already exists")) {
      throw new Error(createError.message);
    }

    return;
  }

  if (bucket.public) {
    return;
  }

  const { error: updateError } = await supabaseAdmin.storage.updateBucket(
    WORKSPACE_BUCKET,
    {
      public: true,
      fileSizeLimit: WORKSPACE_BUCKET_FILE_SIZE_LIMIT,
      allowedMimeTypes: WORKSPACE_BUCKET_ALLOWED_MIME_TYPES,
    }
  );

  if (updateError) {
    throw new Error(updateError.message);
  }
}

function parseDataUrl(dataUrl: string): { contentType: string; bytes: Buffer } {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);

  if (!match) {
    throw new Error("Invalid thumbnail payload.");
  }

  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

async function maybeUploadThumbnail(options: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  workspaceId: string;
  thumbnailDataUrl?: string | null;
}): Promise<string | null> {
  if (!options.thumbnailDataUrl) {
    return null;
  }

  await ensureWorkspaceBucket(options.supabaseAdmin);

  const { contentType, bytes } = parseDataUrl(options.thumbnailDataUrl);
  const path = `${options.userId}/workspaces/${options.workspaceId}/thumbnail.png`;
  const { error } = await options.supabaseAdmin.storage
    .from(WORKSPACE_BUCKET)
    .upload(path, bytes, {
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

function createPublicThumbnailUrl(
  supabaseAdmin: SupabaseAdminClient,
  thumbnailPath: string | null
): string | null {
  if (!thumbnailPath) {
    return null;
  }

  const { data } = supabaseAdmin.storage
    .from(WORKSPACE_BUCKET)
    .getPublicUrl(thumbnailPath);

  return data.publicUrl;
}

async function listWorkspaceRows(options: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  select: string;
}): Promise<WorkspaceRow[]> {
  const { data, error } = await options.supabaseAdmin
    .from("bead_workspaces")
    .select(options.select)
    .eq("user_id", options.userId)
    .order("is_current", { ascending: false })
    .order("last_opened_at", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(25);

  if (error) {
    throw new Error(error.message);
  }

  return ((data as unknown) as WorkspaceRow[]) ?? [];
}

function buildOverviewFromRows(
  supabaseAdmin: SupabaseAdminClient,
  rows: WorkspaceRow[]
): BeadWorkspaceOverview {
  const summaries = rows.map((row) =>
    toSummary(row, createPublicThumbnailUrl(supabaseAdmin, row.thumbnail_path ?? null))
  );

  return {
    current: summaries.find((item) => item.isCurrent) ?? null,
    history: summaries.filter((item) => !item.isCurrent),
  };
}

function normalizeDeleteWorkspaceIds(deleteWorkspaceIds?: string[] | null): string[] {
  if (!deleteWorkspaceIds?.length) {
    return [];
  }

  return Array.from(
    new Set(
      deleteWorkspaceIds.filter(
        (value): value is string => typeof value === "string" && value.trim().length > 0
      )
    )
  );
}

function getRequiredDeletionCount(totalCount: number): number {
  return Math.max(0, totalCount - MAX_BEAD_WORKSPACES + 1);
}

async function deleteWorkspaceRows(options: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  rows: WorkspaceRow[];
}) {
  if (!options.rows.length) {
    return;
  }

  const thumbnailPaths = options.rows
    .map((row) => row.thumbnail_path)
    .filter((path): path is string => Boolean(path));

  if (thumbnailPaths.length) {
    const { error } = await options.supabaseAdmin.storage
      .from(WORKSPACE_BUCKET)
      .remove(thumbnailPaths);

    if (error && !error.message.toLowerCase().includes("not found")) {
      throw new Error(error.message);
    }
  }

  const { error: deleteError } = await options.supabaseAdmin
    .from("bead_workspaces")
    .delete()
    .eq("user_id", options.userId)
    .in(
      "id",
      options.rows.map((row) => row.id)
    );

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

export async function listBeadWorkspaceOverview(options: {
  supabaseAdmin?: SupabaseAdminClient;
  userId: string;
}): Promise<BeadWorkspaceOverview> {
  const supabaseAdmin = options.supabaseAdmin ?? createSupabaseAdminClient();
  const rows = await listWorkspaceRows({
    supabaseAdmin,
    userId: options.userId,
    select: getOverviewSelect(),
  });

  return buildOverviewFromRows(supabaseAdmin, rows);
}

export async function createBeadWorkspace(options: {
  supabaseAdmin?: SupabaseAdminClient;
  userId: string;
  input: CreateBeadWorkspaceInput;
}): Promise<BeadWorkspaceSummary> {
  const supabaseAdmin = options.supabaseAdmin ?? createSupabaseAdminClient();
  const dimensions = getWorkspaceDimensions(options.input.patternData);
  const usedColorCodes = buildWorkspaceColorUsage({
    patternData: options.input.patternData,
    brand: options.input.brand,
  });
  const completedColorIndexes = normalizeCompletedColorIndexes(
    options.input.completedColorIndexes ?? []
  );
  const deleteWorkspaceIds = normalizeDeleteWorkspaceIds(
    options.input.deleteWorkspaceIds
  );
  const name = createWorkspaceName(options.input.sourceType, options.input.name);
  const now = new Date().toISOString();

  const existingRows = await listWorkspaceRows({
    supabaseAdmin,
    userId: options.userId,
    select: getOverviewSelect(),
  });
  const requiredDeletionCount = getRequiredDeletionCount(existingRows.length);

  if (requiredDeletionCount > 0 && deleteWorkspaceIds.length < requiredDeletionCount) {
    throw new BeadWorkspaceLimitError({
      overview: buildOverviewFromRows(supabaseAdmin, existingRows),
      requiredDeletionCount,
      maxWorkspaces: MAX_BEAD_WORKSPACES,
    });
  }

  if (deleteWorkspaceIds.length) {
    const rowsToDelete = existingRows.filter((row) =>
      deleteWorkspaceIds.includes(row.id)
    );

    if (rowsToDelete.length !== deleteWorkspaceIds.length) {
      throw new Error("One or more selected workspaces could not be found.");
    }

    await deleteWorkspaceRows({
      supabaseAdmin,
      userId: options.userId,
      rows: rowsToDelete,
    });
  }

  const { error: demoteError } = await supabaseAdmin
    .from("bead_workspaces")
    .update({
      is_current: false,
    })
    .eq("user_id", options.userId)
    .eq("is_current", true);

  if (demoteError) {
    throw new Error(demoteError.message);
  }

  const insertPayload = {
    user_id: options.userId,
    name,
    source_type: options.input.sourceType,
    brand: options.input.brand,
    pattern_data: options.input.patternData,
    width: dimensions.width,
    height: dimensions.height,
    used_color_codes: usedColorCodes,
    completed_color_indexes: completedColorIndexes,
    selected_color_index:
      typeof options.input.selectedColorIndex === "number"
        ? options.input.selectedColorIndex
        : null,
    is_current: true,
    last_opened_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from("bead_workspaces")
    .insert(insertPayload)
    .select(getOverviewSelect())
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Create workspace failed.");
  }

  let row = (data as unknown) as WorkspaceRow;
  const thumbnailPath = await maybeUploadThumbnail({
    supabaseAdmin,
    userId: options.userId,
    workspaceId: row.id,
    thumbnailDataUrl: options.input.thumbnailDataUrl,
  });

  if (thumbnailPath) {
    const { data: updatedRow, error: updateError } = await supabaseAdmin
      .from("bead_workspaces")
      .update({
        thumbnail_path: thumbnailPath,
      })
      .eq("id", row.id)
      .eq("user_id", options.userId)
      .select(getOverviewSelect())
      .single();

    if (updateError || !updatedRow) {
      throw new Error(updateError?.message || "Update thumbnail failed.");
    }

    row = (updatedRow as unknown) as WorkspaceRow;
  }

  return toSummary(
    row,
    createPublicThumbnailUrl(supabaseAdmin, row.thumbnail_path ?? null)
  );
}

export async function getBeadWorkspaceById(options: {
  supabaseAdmin?: SupabaseAdminClient;
  userId: string;
  workspaceId: string;
}): Promise<BeadWorkspaceRecord | null> {
  const supabaseAdmin = options.supabaseAdmin ?? createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("bead_workspaces")
    .select(getDetailSelect())
    .eq("id", options.workspaceId)
    .eq("user_id", options.userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(error.message);
  }

  const row = (data as unknown) as WorkspaceRow;
  const now = new Date().toISOString();
  const { data: touchedRow, error: touchError } = await supabaseAdmin
    .from("bead_workspaces")
    .update({
      last_opened_at: now,
    })
    .eq("id", options.workspaceId)
    .eq("user_id", options.userId)
    .select(getDetailSelect())
    .single();

  if (touchError || !touchedRow) {
    return toRecord(
      row,
      createPublicThumbnailUrl(supabaseAdmin, row.thumbnail_path ?? null)
    );
  }

  const nextRow = (touchedRow as unknown) as WorkspaceRow;

  return toRecord(
    nextRow,
    createPublicThumbnailUrl(supabaseAdmin, nextRow.thumbnail_path ?? null)
  );
}

export async function activateBeadWorkspace(options: {
  supabaseAdmin?: SupabaseAdminClient;
  userId: string;
  workspaceId: string;
}): Promise<BeadWorkspaceSummary | null> {
  const supabaseAdmin = options.supabaseAdmin ?? createSupabaseAdminClient();

  const { error: demoteError } = await supabaseAdmin
    .from("bead_workspaces")
    .update({
      is_current: false,
    })
    .eq("user_id", options.userId)
    .eq("is_current", true);

  if (demoteError) {
    throw new Error(demoteError.message);
  }

  const { data, error } = await supabaseAdmin
    .from("bead_workspaces")
    .update({
      is_current: true,
      last_opened_at: new Date().toISOString(),
    })
    .eq("id", options.workspaceId)
    .eq("user_id", options.userId)
    .select(getOverviewSelect())
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(error.message);
  }

  const row = (data as unknown) as WorkspaceRow;

  return toSummary(
    row,
    createPublicThumbnailUrl(supabaseAdmin, row.thumbnail_path ?? null)
  );
}

export async function updateBeadWorkspaceState(options: {
  supabaseAdmin?: SupabaseAdminClient;
  userId: string;
  workspaceId: string;
  input: UpdateBeadWorkspaceStateInput;
}): Promise<Pick<BeadWorkspaceRecord, "updatedAt" | "lastOpenedAt"> | null> {
  const supabaseAdmin = options.supabaseAdmin ?? createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("bead_workspaces")
    .update({
      completed_color_indexes: normalizeCompletedColorIndexes(
        options.input.completedColorIndexes
      ),
      selected_color_index:
        typeof options.input.selectedColorIndex === "number"
          ? options.input.selectedColorIndex
          : null,
      last_opened_at: new Date().toISOString(),
    })
    .eq("id", options.workspaceId)
    .eq("user_id", options.userId)
    .select("updated_at,last_opened_at")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw new Error(error.message);
  }

  return {
    updatedAt: data.updated_at,
    lastOpenedAt: data.last_opened_at,
  };
}
