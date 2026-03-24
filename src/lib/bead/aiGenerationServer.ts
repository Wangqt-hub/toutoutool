import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PIXEL_STYLES } from "@/lib/bead/pixelStyles";
import {
  AI_GENERATION_ACTIVE_STATUSES,
  AI_GENERATION_BUCKET,
  AI_GENERATION_PROGRESS,
  AI_GENERATION_STATUS_LABELS,
  buildAIGenerationImageUrl,
  type AIGenerationHistoryItem,
  type AIGenerationHistoryRow,
  type AIGenerationStatus,
} from "@/lib/bead/aiGeneration";

const DASHSCOPE_ASYNC_GENERATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation";
const DASHSCOPE_TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks";
const DASHSCOPE_MODEL = "wan2.6-image";
const HISTORY_IMAGE_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const HISTORY_PREVIEW_MAX_EDGE = 1200;
const HISTORY_THUMBNAIL_EDGE = 160;
const OPTIMIZED_IMAGE_CONTENT_TYPE = "image/webp";

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;
type GenerationImageKind = "source" | "ai";

type DashScopeTaskResponse = {
  output?: {
    task_id?: string;
    task_status?: string;
    choices?: Array<{
      message?: {
        content?: Array<{
          type?: string;
          image?: string;
        }>;
      };
    }>;
    message?: string;
    code?: string;
  };
  code?: string;
  message?: string;
};

function getDashScopeApiKey(): string {
  const apiKey = process.env.DASHSCOPE_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured.");
  }

  return apiKey;
}

function getImageExtension(file: File): string {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".png")) {
    return "png";
  }

  if (fileName.endsWith(".webp")) {
    return "webp";
  }

  if (fileName.endsWith(".bmp")) {
    return "bmp";
  }

  if (fileName.endsWith(".jpeg") || fileName.endsWith(".jpg")) {
    return "jpg";
  }

  const mimeType = file.type.toLowerCase();

  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  if (mimeType === "image/bmp") {
    return "bmp";
  }

  return "jpg";
}

async function readDashScopeResponse(
  response: Response
): Promise<DashScopeTaskResponse> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as DashScopeTaskResponse;
  } catch {
    return {
      message: text,
    };
  }
}

export function getStyleSelection(
  styleId: string,
  customPrompt: string
): {
  prompt: string;
  styleName: string;
} {
  const selectedStyle = PIXEL_STYLES.find((style) => style.id === styleId);

  return {
    prompt:
      customPrompt.trim() || selectedStyle?.prompt || "pixel art style",
    styleName: selectedStyle?.name || "Custom",
  };
}

export function buildSourceImagePath(
  userId: string,
  generationId: string,
  file: File
): string {
  return `${userId}/${generationId}/source.${getImageExtension(file)}`;
}

export function buildAIImagePath(
  userId: string,
  generationId: string
): string {
  return `${userId}/${generationId}/ai.png`;
}

function buildGenerationDisplayImagePath(
  userId: string,
  generationId: string,
  kind: GenerationImageKind
): string {
  return `${userId}/${generationId}/${kind}-display.webp`;
}

function buildGenerationThumbnailImagePath(
  userId: string,
  generationId: string,
  kind: GenerationImageKind
): string {
  return `${userId}/${generationId}/${kind}-thumb.webp`;
}

async function createOptimizedImageBuffers(
  sourceBuffer: Uint8Array
): Promise<{ display: Uint8Array; thumbnail: Uint8Array }> {
  const sharpModule = await import("sharp");
  const sharp = sharpModule.default;

  const [display, thumbnail] = await Promise.all([
    sharp(sourceBuffer)
      .rotate()
      .resize({
        width: HISTORY_PREVIEW_MAX_EDGE,
        height: HISTORY_PREVIEW_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer(),
    sharp(sourceBuffer)
      .rotate()
      .resize({
        width: HISTORY_THUMBNAIL_EDGE,
        height: HISTORY_THUMBNAIL_EDGE,
        fit: "cover",
        withoutEnlargement: true,
      })
      .webp({ quality: 70 })
      .toBuffer(),
  ]);

  return {
    display: new Uint8Array(display),
    thumbnail: new Uint8Array(thumbnail),
  };
}

export function mapDashScopeTaskStatus(
  taskStatus?: string | null
): AIGenerationStatus {
  switch (taskStatus) {
    case "PENDING":
      return "PENDING";
    case "RUNNING":
      return "RUNNING";
    case "SUCCEEDED":
      return "SUCCEEDED";
    case "FAILED":
      return "FAILED";
    default:
      return "FAILED";
  }
}

export function getProgressForStatus(
  status: AIGenerationStatus
): number {
  return AI_GENERATION_PROGRESS[status];
}

export function getDashScopeErrorMessage(
  payload: DashScopeTaskResponse,
  fallback: string
): string {
  return (
    payload.output?.message ||
    payload.message ||
    payload.output?.code ||
    payload.code ||
    fallback
  );
}

export async function createDashScopeAsyncTask(options: {
  imageInput: string;
  prompt: string;
}): Promise<{ taskId: string; status: AIGenerationStatus }> {
  const response = await fetch(DASHSCOPE_ASYNC_GENERATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getDashScopeApiKey()}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: DASHSCOPE_MODEL,
      input: {
        messages: [
          {
            role: "user",
            content: [
              { text: options.prompt },
              { image: options.imageInput },
            ],
          },
        ],
      },
      parameters: {
        size: "1K",
        watermark: false,
        prompt_extend: true,
        n: 1,
      },
    }),
  });

  const payload = await readDashScopeResponse(response);

  if (!response.ok) {
    throw new Error(
      getDashScopeErrorMessage(payload, "Failed to create DashScope task.")
    );
  }

  const taskId = payload.output?.task_id;

  if (!taskId) {
    throw new Error("DashScope did not return a task id.");
  }

  return {
    taskId,
    status: mapDashScopeTaskStatus(payload.output?.task_status || "PENDING"),
  };
}

export async function fetchDashScopeTask(
  taskId: string
): Promise<DashScopeTaskResponse> {
  const response = await fetch(`${DASHSCOPE_TASK_URL}/${taskId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${getDashScopeApiKey()}`,
    },
    cache: "no-store",
  });

  const payload = await readDashScopeResponse(response);

  if (!response.ok) {
    throw new Error(
      getDashScopeErrorMessage(payload, "Failed to fetch DashScope task.")
    );
  }

  return payload;
}

export function getDashScopeResultImageUrl(
  payload: DashScopeTaskResponse
): string | null {
  const firstChoice = payload.output?.choices?.[0];
  const firstImage = firstChoice?.message?.content?.find(
    (item) => item.type === "image" && Boolean(item.image)
  );

  return firstImage?.image || null;
}

export async function uploadStorageObject(options: {
  supabaseAdmin: SupabaseAdminClient;
  path: string;
  body: File | Blob | ArrayBuffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  const { error } = await options.supabaseAdmin.storage
    .from(AI_GENERATION_BUCKET)
    .upload(options.path, options.body, {
      cacheControl: "3600",
      contentType: options.contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function uploadGenerationImageVariants(options: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  generationId: string;
  kind: GenerationImageKind;
  sourceBuffer: Uint8Array;
}): Promise<void> {
  const { display, thumbnail } = await createOptimizedImageBuffers(
    options.sourceBuffer
  );

  await Promise.all([
    uploadStorageObject({
      supabaseAdmin: options.supabaseAdmin,
      path: buildGenerationDisplayImagePath(
        options.userId,
        options.generationId,
        options.kind
      ),
      body: display,
      contentType: OPTIMIZED_IMAGE_CONTENT_TYPE,
    }),
    uploadStorageObject({
      supabaseAdmin: options.supabaseAdmin,
      path: buildGenerationThumbnailImagePath(
        options.userId,
        options.generationId,
        options.kind
      ),
      body: thumbnail,
      contentType: OPTIMIZED_IMAGE_CONTENT_TYPE,
    }),
  ]);
}

export async function createSignedStorageUrl(options: {
  supabaseAdmin: SupabaseAdminClient;
  path: string;
  expiresIn?: number;
  transform?: {
    width?: number;
    height?: number;
    resize?: "cover" | "contain" | "fill";
    quality?: number;
    format?: "origin";
  };
}): Promise<string> {
  const { data, error } = await options.supabaseAdmin.storage
    .from(AI_GENERATION_BUCKET)
    .createSignedUrl(options.path, options.expiresIn ?? 60 * 30, {
      transform: options.transform,
    });

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Failed to create signed image url.");
  }

  return data.signedUrl;
}

async function createHistoryImageUrl(options: {
  supabaseAdmin: SupabaseAdminClient;
  primaryPath: string;
  fallbackPath: string;
  fallbackUrl: string;
}): Promise<string> {
  try {
    return await createSignedStorageUrl({
      supabaseAdmin: options.supabaseAdmin,
      path: options.primaryPath,
      expiresIn: HISTORY_IMAGE_URL_TTL_SECONDS,
    });
  } catch {
    try {
      return await createSignedStorageUrl({
        supabaseAdmin: options.supabaseAdmin,
        path: options.fallbackPath,
        expiresIn: HISTORY_IMAGE_URL_TTL_SECONDS,
      });
    } catch {
      return options.fallbackUrl;
    }
  }
}

export async function buildAIGenerationHistoryItem(options: {
  supabaseAdmin: SupabaseAdminClient;
  row: AIGenerationHistoryRow;
}): Promise<AIGenerationHistoryItem> {
  const sourceImageProxyUrl = buildAIGenerationImageUrl(options.row.id, "source");
  const aiImageProxyUrl = options.row.ai_image_path
    ? buildAIGenerationImageUrl(options.row.id, "ai")
    : null;
  const [sourceImageUrl, sourceThumbnailUrl, aiImageUrl, aiThumbnailUrl] =
    await Promise.all([
      createHistoryImageUrl({
        supabaseAdmin: options.supabaseAdmin,
        primaryPath: buildGenerationDisplayImagePath(
          options.row.user_id,
          options.row.id,
          "source"
        ),
        fallbackPath: options.row.source_image_path,
        fallbackUrl: sourceImageProxyUrl,
      }),
      createHistoryImageUrl({
        supabaseAdmin: options.supabaseAdmin,
        primaryPath: buildGenerationThumbnailImagePath(
          options.row.user_id,
          options.row.id,
          "source"
        ),
        fallbackPath: options.row.source_image_path,
        fallbackUrl: sourceImageProxyUrl,
      }),
      options.row.ai_image_path
        ? createHistoryImageUrl({
            supabaseAdmin: options.supabaseAdmin,
            primaryPath: buildGenerationDisplayImagePath(
              options.row.user_id,
              options.row.id,
              "ai"
            ),
            fallbackPath: options.row.ai_image_path,
            fallbackUrl: aiImageProxyUrl!,
          })
        : Promise.resolve(null),
      options.row.ai_image_path
        ? createHistoryImageUrl({
            supabaseAdmin: options.supabaseAdmin,
            primaryPath: buildGenerationThumbnailImagePath(
              options.row.user_id,
              options.row.id,
              "ai"
            ),
            fallbackPath: options.row.ai_image_path,
            fallbackUrl: aiImageProxyUrl!,
          })
        : Promise.resolve(null),
    ]);

  return {
    id: options.row.id,
    styleId: options.row.style_id,
    styleName: options.row.style_name,
    prompt: options.row.prompt,
    status: options.row.status,
    statusLabel: AI_GENERATION_STATUS_LABELS[options.row.status],
    progressPercent: options.row.progress_percent,
    sourceImageUrl,
    sourceImageProxyUrl,
    sourceThumbnailUrl,
    aiImageUrl,
    aiImageProxyUrl,
    aiThumbnailUrl,
    historyThumbnailUrl: aiThumbnailUrl || sourceThumbnailUrl,
    errorMessage: options.row.error_message,
    createdAt: options.row.created_at,
    updatedAt: options.row.updated_at,
    completedAt: options.row.completed_at,
  };
}

export async function uploadAIResultFromUrl(options: {
  supabaseAdmin: SupabaseAdminClient;
  imageUrl: string;
  userId: string;
  generationId: string;
}): Promise<string> {
  const response = await fetch(options.imageUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to download AI image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const sourceBuffer = new Uint8Array(await response.arrayBuffer());
  const path = buildAIImagePath(options.userId, options.generationId);

  await uploadStorageObject({
    supabaseAdmin: options.supabaseAdmin,
    path,
    body: sourceBuffer,
    contentType,
  });

  try {
    await uploadGenerationImageVariants({
      supabaseAdmin: options.supabaseAdmin,
      userId: options.userId,
      generationId: options.generationId,
      kind: "ai",
      sourceBuffer,
    });
  } catch {
    // Variant uploads are best-effort and should not fail the main task.
  }

  return path;
}

export async function getGenerationById(options: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  generationId: string;
}): Promise<AIGenerationHistoryRow | null> {
  const { data, error } = await options.supabaseAdmin
    .from("bead_ai_generations")
    .select("*")
    .eq("id", options.generationId)
    .eq("user_id", options.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AIGenerationHistoryRow | null) || null;
}

export async function getLatestGenerations(options: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
  limit?: number;
}): Promise<AIGenerationHistoryRow[]> {
  const { data, error } = await options.supabaseAdmin
    .from("bead_ai_generations")
    .select("*")
    .eq("user_id", options.userId)
    .order("created_at", { ascending: false })
    .limit(options.limit ?? 10);

  if (error) {
    throw new Error(error.message);
  }

  return (data as AIGenerationHistoryRow[]) || [];
}

export async function getActiveGeneration(options: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
}): Promise<AIGenerationHistoryRow | null> {
  const { data, error } = await options.supabaseAdmin
    .from("bead_ai_generations")
    .select("*")
    .eq("user_id", options.userId)
    .in("status", [...AI_GENERATION_ACTIVE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as AIGenerationHistoryRow[]) || [];
  return rows[0] || null;
}

export async function insertGeneration(options: {
  supabaseAdmin: SupabaseAdminClient;
  row: Partial<AIGenerationHistoryRow> & {
    id: string;
    user_id: string;
    style_id: string;
    style_name: string;
    prompt: string;
    status: AIGenerationStatus;
    progress_percent: number;
    source_image_path: string;
  };
}): Promise<AIGenerationHistoryRow> {
  const { data, error } = await options.supabaseAdmin
    .from("bead_ai_generations")
    .insert(options.row)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to insert generation.");
  }

  return data as AIGenerationHistoryRow;
}

export async function updateGeneration(options: {
  supabaseAdmin: SupabaseAdminClient;
  generationId: string;
  userId: string;
  updates: Record<string, unknown>;
}): Promise<AIGenerationHistoryRow> {
  const { data, error } = await options.supabaseAdmin
    .from("bead_ai_generations")
    .update(options.updates)
    .eq("id", options.generationId)
    .eq("user_id", options.userId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update generation.");
  }

  return data as AIGenerationHistoryRow;
}

export async function pruneOldGenerations(options: {
  supabaseAdmin: SupabaseAdminClient;
  userId: string;
}): Promise<void> {
  const { data, error } = await options.supabaseAdmin
    .from("bead_ai_generations")
    .select("id, source_image_path, ai_image_path")
    .eq("user_id", options.userId)
    .order("created_at", { ascending: false })
    .range(10, 999);

  if (error) {
    throw new Error(error.message);
  }

  const rows =
    (data as Array<{
      id: string;
      source_image_path: string;
      ai_image_path: string | null;
    }>) || [];

  if (rows.length === 0) {
    return;
  }

  const paths = rows.flatMap((row) =>
    [
      row.source_image_path,
      buildGenerationDisplayImagePath(options.userId, row.id, "source"),
      buildGenerationThumbnailImagePath(options.userId, row.id, "source"),
      row.ai_image_path,
      row.ai_image_path
        ? buildGenerationDisplayImagePath(options.userId, row.id, "ai")
        : null,
      row.ai_image_path
        ? buildGenerationThumbnailImagePath(options.userId, row.id, "ai")
        : null,
    ].filter((value): value is string => Boolean(value))
  );

  if (paths.length > 0) {
    const { error: storageError } = await options.supabaseAdmin.storage
      .from(AI_GENERATION_BUCKET)
      .remove(paths);

    if (storageError) {
      throw new Error(storageError.message);
    }
  }

  const { error: deleteError } = await options.supabaseAdmin
    .from("bead_ai_generations")
    .delete()
    .in(
      "id",
      rows.map((row) => row.id)
    );

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

export async function downloadGenerationImage(options: {
  supabaseAdmin: SupabaseAdminClient;
  path: string;
}): Promise<Blob> {
  const { data, error } = await options.supabaseAdmin.storage
    .from(AI_GENERATION_BUCKET)
    .download(options.path);

  if (error || !data) {
    throw new Error(error?.message || "Failed to download generation image.");
  }

  return data;
}
