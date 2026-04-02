const http = require("node:http");
const { randomUUID } = require("node:crypto");
const sharp = require("sharp");
const PIXEL_STYLES = require("./pixel-styles.json");

const PORT = Number(process.env.PORT || 3000);
const HISTORY_LIMIT = 10;
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || "";
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || "";
const ENV_ID = process.env.CLOUDBASE_ENV_ID || process.env.TCB_ENV || "";
const API_KEY = process.env.CLOUDBASE_SERVER_API_KEY || "";
const SQL_INSTANCE = process.env.CLOUDBASE_SQL_INSTANCE || "default";
const SQL_SCHEMA = process.env.CLOUDBASE_SQL_SCHEMA || ENV_ID;
const STORAGE_BUCKET = process.env.CLOUDBASE_STORAGE_BUCKET || "";
const API_BASE_URL = `https://${ENV_ID}.api.tcloudbasegateway.com`;
const DASHSCOPE_MULTIMODAL_GENERATE_URL =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const DASHSCOPE_SYNC_MODEL = "qwen-image-2.0";
const HISTORY_PREVIEW_MAX_EDGE = 1200;
const HISTORY_THUMBNAIL_EDGE = 160;

function assertConfig() {
  if (!INTERNAL_API_SECRET) {
    throw new Error("INTERNAL_API_SECRET is not configured.");
  }

  if (!DASHSCOPE_API_KEY) {
    throw new Error("DASHSCOPE_API_KEY is not configured.");
  }

  if (!ENV_ID || !API_KEY || !STORAGE_BUCKET) {
    throw new Error("CloudBase environment variables are incomplete.");
  }
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

async function readJson(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function buildRdbUrl(table, query) {
  const url = new URL(
    `${API_BASE_URL}/v1/rdb/rest/${SQL_INSTANCE}/${SQL_SCHEMA}/${table}`
  );

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url;
}

function eq(value) {
  return `eq.${value}`;
}

function orderBy(field, direction) {
  return `${field}.${direction}`;
}

function toSqlTimestamp(value = new Date()) {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

async function rdbRequest(method, table, options = {}) {
  const response = await fetch(buildRdbUrl(table, options.query), {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: options.accept || "application/json",
      "Content-Type": "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(
      payload?.message || payload?.error || `RDB request failed with ${response.status}`
    );
  }

  return readJson(response);
}

async function listRows(table, options = {}) {
  const rows = await rdbRequest("GET", table, {
    query: options.query,
  });

  return Array.isArray(rows) ? rows : [];
}

async function getFirstRow(table, options = {}) {
  const rows = await listRows(table, {
    query: {
      ...(options.query || {}),
      limit: 1,
    },
  });

  return rows[0] || null;
}

async function insertOne(table, body) {
  return rdbRequest("POST", table, {
    body,
    prefer: "return=representation",
    accept: "application/vnd.pgrst.object+json",
  });
}

async function patchOne(table, query, body) {
  const existing = await getFirstRow(table, { query });

  if (!existing) {
    return null;
  }

  const patched = await rdbRequest("PATCH", table, {
    query,
    body,
    prefer: "return=representation",
    accept: "application/vnd.pgrst.object+json",
  });

  return {
    ...existing,
    ...(patched || {}),
  };
}

async function deleteRows(table, query) {
  return rdbRequest("DELETE", table, {
    query,
    prefer: "return=representation",
    accept: "application/json",
  });
}

function buildCloudObjectId(path) {
  return `cloud://${ENV_ID}.${STORAGE_BUCKET}/${path}`;
}

async function requestStorage(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(
      payload?.message || payload?.error || `Storage request failed with ${response.status}`
    );
  }

  const payload = await readJson(response);
  return Array.isArray(payload) ? payload : [];
}

async function uploadObject(path, bytes, contentType) {
  const items = await requestStorage("/v1/storages/get-objects-upload-info", [
    { objectId: path },
  ]);
  const info = items[0];

  if (!info || !info.uploadUrl) {
    throw new Error(info?.message || "Failed to get upload information.");
  }

  const uploadResponse = await fetch(info.uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: info.authorization,
      "X-Cos-Security-Token": info.token,
      "X-Cos-Meta-Fileid": info.cloudObjectMeta,
      "Content-Type": contentType || "application/octet-stream",
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload object: ${uploadResponse.status}`);
  }
}

async function getDownloadUrls(paths) {
  const validPaths = Array.from(new Set(paths.filter(Boolean)));

  if (validPaths.length === 0) {
    return new Map();
  }

  const results = await requestStorage(
    "/v1/storages/get-objects-download-info",
    validPaths.map((path) => ({
      cloudObjectId: buildCloudObjectId(path),
    }))
  );

  const map = new Map();
  results.forEach((item, index) => {
    if (item && item.downloadUrl) {
      map.set(validPaths[index], item.downloadUrl);
    }
  });

  return map;
}

async function deleteObjects(paths) {
  const validPaths = paths.filter(Boolean);

  if (validPaths.length === 0) {
    return;
  }

  await requestStorage(
    "/v1/storages/delete-objects",
    validPaths.map((path) => ({
      cloudObjectId: buildCloudObjectId(path),
    }))
  );
}

async function downloadObject(path) {
  const urlMap = await getDownloadUrls([path]);
  const downloadUrl = urlMap.get(path);

  if (!downloadUrl) {
    throw new Error("Download URL is not available.");
  }

  const response = await fetch(downloadUrl, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

function getImageExtension(fileName, contentType) {
  const lowerFileName = String(fileName || "").toLowerCase();
  const lowerContentType = String(contentType || "").toLowerCase();

  if (lowerFileName.endsWith(".png") || lowerContentType === "image/png") {
    return "png";
  }

  if (lowerFileName.endsWith(".webp") || lowerContentType === "image/webp") {
    return "webp";
  }

  if (lowerFileName.endsWith(".bmp") || lowerContentType === "image/bmp") {
    return "bmp";
  }

  return "jpg";
}

function buildSourceImagePath(userId, generationId, fileName, contentType) {
  const ext = getImageExtension(fileName, contentType);
  return `bead/ai/${userId}/${generationId}/source.${ext}`;
}

function buildAIImagePath(userId, generationId) {
  return `bead/ai/${userId}/${generationId}/ai.png`;
}

function buildDisplayImagePath(userId, generationId, kind) {
  return `bead/ai/${userId}/${generationId}/${kind}-display.webp`;
}

function buildThumbnailImagePath(userId, generationId, kind) {
  return `bead/ai/${userId}/${generationId}/${kind}-thumb.webp`;
}

async function createOptimizedImageBuffers(sourceBuffer) {
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
    display,
    thumbnail,
  };
}

async function uploadImageVariants(userId, generationId, kind, sourceBuffer) {
  const optimized = await createOptimizedImageBuffers(sourceBuffer);

  await Promise.all([
    uploadObject(
      buildDisplayImagePath(userId, generationId, kind),
      optimized.display,
      "image/webp"
    ),
    uploadObject(
      buildThumbnailImagePath(userId, generationId, kind),
      optimized.thumbnail,
      "image/webp"
    ),
  ]);
}

function getStyleSelection(styleId, customPrompt) {
  const selected = PIXEL_STYLES.find((style) => style.id === styleId);

  return {
    prompt:
      typeof customPrompt === "string" && customPrompt.trim()
        ? customPrompt.trim()
        : (selected && selected.prompt) || "pixel art style",
    styleName: (selected && selected.name) || "Custom",
  };
}

function buildProxyUrl(generationId, kind, variant = "original") {
  const search =
    variant === "original"
      ? `kind=${kind}`
      : `kind=${kind}&variant=${variant}`;

  return `/api/ai-generate/history/${generationId}/image?${search}`;
}

async function buildHistoryItems(rows) {
  const urlMap = await getDownloadUrls(
    rows.flatMap((row) => {
      const paths = [
        buildDisplayImagePath(row.user_id, row.id, "source"),
        buildThumbnailImagePath(row.user_id, row.id, "source"),
      ];

      if (row.ai_image_path) {
        paths.push(buildDisplayImagePath(row.user_id, row.id, "ai"));
        paths.push(buildThumbnailImagePath(row.user_id, row.id, "ai"));
      }

      return paths;
    })
  );

  return rows.map((row) => {
    const sourceImageProxyUrl = buildProxyUrl(row.id, "source", "original");
    const sourceDisplayPath = buildDisplayImagePath(row.user_id, row.id, "source");
    const sourceThumbPath = buildThumbnailImagePath(row.user_id, row.id, "source");
    const sourceImageUrl = urlMap.get(sourceDisplayPath) || sourceImageProxyUrl;
    const sourceThumbnailUrl = urlMap.get(sourceThumbPath) || sourceImageUrl;
    const aiImageProxyUrl = row.ai_image_path
      ? buildProxyUrl(row.id, "ai", "original")
      : null;
    const aiDisplayPath = row.ai_image_path
      ? buildDisplayImagePath(row.user_id, row.id, "ai")
      : null;
    const aiThumbPath = row.ai_image_path
      ? buildThumbnailImagePath(row.user_id, row.id, "ai")
      : null;
    const aiImageUrl = aiDisplayPath
      ? urlMap.get(aiDisplayPath) || aiImageProxyUrl
      : null;
    const aiThumbnailUrl = aiThumbPath
      ? urlMap.get(aiThumbPath) || aiImageUrl
      : null;

    return {
      id: row.id,
      styleId: row.style_id,
      styleName: row.style_name,
      prompt: row.prompt,
      status: row.status,
      statusLabel:
        row.status === "UPLOADING_SOURCE"
          ? "上传原图"
          : row.status === "PENDING"
          ? "排队中"
          : row.status === "RUNNING"
          ? "生成中"
          : row.status === "SAVING_RESULT"
          ? "保存结果"
          : row.status === "SUCCEEDED"
          ? "已完成"
          : "失败",
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
  });
}

async function getLatestGenerations(userId) {
  return listRows("bead_ai_generations", {
    query: {
      user_id: eq(userId),
      select: "*",
      order: orderBy("created_at", "desc"),
      limit: HISTORY_LIMIT,
    },
  });
}

async function getGenerationById(userId, generationId) {
  return getFirstRow("bead_ai_generations", {
    query: {
      user_id: eq(userId),
      id: eq(generationId),
      select: "*",
    },
  });
}

async function getActiveMapping(userId) {
  return getFirstRow("user_active_generations", {
    query: {
      user_id: eq(userId),
      select: "*",
    },
  });
}

async function upsertActiveGeneration(userId, generationId) {
  const updated = await patchOne(
    "user_active_generations",
    {
      user_id: eq(userId),
    },
    {
      generation_id: generationId,
    }
  );

  if (updated) {
    return updated;
  }

  return rdbRequest("POST", "user_active_generations", {
    body: {
      user_id: userId,
      generation_id: generationId,
    },
    prefer: "return=representation",
    accept: "application/vnd.pgrst.object+json",
  });
}

async function clearActiveGeneration(userId) {
  const mapping = await getActiveMapping(userId);

  if (!mapping) {
    return;
  }

  await deleteRows("user_active_generations", {
    user_id: eq(userId),
  });
}

async function insertGeneration(row) {
  return insertOne("bead_ai_generations", row);
}

async function updateGeneration(userId, generationId, updates) {
  return patchOne(
    "bead_ai_generations",
    {
      user_id: eq(userId),
      id: eq(generationId),
    },
    updates
  );
}

async function pruneOldGenerations(userId) {
  const rows = await listRows("bead_ai_generations", {
    query: {
      user_id: eq(userId),
      select: "*",
      order: orderBy("created_at", "desc"),
      limit: 100,
    },
  });

  if (rows.length <= HISTORY_LIMIT) {
    return;
  }

  const extraRows = rows.slice(HISTORY_LIMIT);
  const paths = [];

  extraRows.forEach((row) => {
    if (row.source_image_path) {
      paths.push(row.source_image_path);
      paths.push(buildDisplayImagePath(userId, row.id, "source"));
      paths.push(buildThumbnailImagePath(userId, row.id, "source"));
    }

    if (row.ai_image_path) {
      paths.push(row.ai_image_path);
      paths.push(buildDisplayImagePath(userId, row.id, "ai"));
      paths.push(buildThumbnailImagePath(userId, row.id, "ai"));
    }
  });

  await deleteObjects(paths);

  await Promise.all(
    extraRows.map((row) =>
      deleteRows("bead_ai_generations", {
        user_id: eq(userId),
        id: eq(row.id),
      })
    )
  );
}

async function createDashScopeSyncImageEdit(imageInput, prompt) {
  const response = await fetch(DASHSCOPE_MULTIMODAL_GENERATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DASHSCOPE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DASHSCOPE_SYNC_MODEL,
      input: {
        messages: [
          {
            role: "user",
            content: [{ image: imageInput }, { text: prompt }],
          },
        ],
      },
      parameters: {
        size: "1328*1328",
        watermark: false,
        prompt_extend: true,
        n: 1,
        negative_prompt: " ",
      },
    }),
    cache: "no-store",
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(
      payload?.output?.message || payload?.message || "Failed to generate image."
    );
  }

  const resultUrl =
    payload?.output?.results?.find((item) => item && item.url)?.url ||
    payload?.output?.choices?.[0]?.message?.content?.find((item) => item && item.image)?.image ||
    null;

  if (!resultUrl) {
    throw new Error("DashScope did not return an image URL.");
  }

  return resultUrl;
}

async function uploadAIResultFromUrl(userId, generationId, imageUrl) {
  const response = await fetch(imageUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Failed to download AI image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const path = buildAIImagePath(userId, generationId);

  await uploadObject(path, sourceBuffer, contentType);

  try {
    await uploadImageVariants(userId, generationId, "ai", sourceBuffer);
  } catch {
    // Variant generation is best-effort.
  }

  return path;
}

async function runGenerationPipeline(options) {
  const {
    userId,
    generationId,
    sourceImagePath,
    styleSelection,
  } = options;

  try {
    const sourceUrlMap = await getDownloadUrls([sourceImagePath]);
    const sourceImageUrl = sourceUrlMap.get(sourceImagePath);

    if (!sourceImageUrl) {
      throw new Error("Failed to obtain source image URL.");
    }

    await updateGeneration(userId, generationId, {
      status: "RUNNING",
      progress_percent: 68,
      error_message: null,
      completed_at: null,
    });

    const resultImageUrl = await createDashScopeSyncImageEdit(
      sourceImageUrl,
      styleSelection.prompt
    );

    await updateGeneration(userId, generationId, {
      status: "SAVING_RESULT",
      progress_percent: 90,
      error_message: null,
      completed_at: null,
    });

    const aiImagePath = await uploadAIResultFromUrl(
      userId,
      generationId,
      resultImageUrl
    );

    await updateGeneration(userId, generationId, {
      status: "SUCCEEDED",
      progress_percent: 100,
      ai_image_path: aiImagePath,
      error_message: null,
      completed_at: toSqlTimestamp(),
    });

    await clearActiveGeneration(userId);
    await pruneOldGenerations(userId);
  } catch (error) {
    await updateGeneration(userId, generationId, {
      status: "FAILED",
      progress_percent: 100,
      error_message: error instanceof Error ? error.message : "AI generation failed.",
      completed_at: toSqlTimestamp(),
    });
    await clearActiveGeneration(userId);
  }
}

async function handleGenerate(body) {
  const { userId, styleId, customPrompt, imageBase64, fileName, contentType } = body;

  if (!userId || !imageBase64) {
    throw Object.assign(new Error("userId and imageBase64 are required."), {
      status: 400,
    });
  }

  const activeMapping = await getActiveMapping(userId);

  if (activeMapping) {
    const activeGeneration = await getGenerationById(userId, activeMapping.generation_id);

    if (
      activeGeneration &&
      ["UPLOADING_SOURCE", "PENDING", "RUNNING", "SAVING_RESULT"].includes(activeGeneration.status)
    ) {
      const [item] = await buildHistoryItems([activeGeneration]);
      throw Object.assign(new Error("You already have an AI generation in progress."), {
        status: 409,
        data: item || null,
      });
    }

    await clearActiveGeneration(userId);
  }

  const generationId = randomUUID();
  const sourceBuffer = Buffer.from(imageBase64, "base64");
  const styleSelection = getStyleSelection(styleId, customPrompt);
  const sourceImagePath = buildSourceImagePath(userId, generationId, fileName, contentType);

  let generation = await insertGeneration({
    id: generationId,
    user_id: userId,
    style_id: styleId || "custom",
    style_name: styleSelection.styleName,
    prompt: styleSelection.prompt,
    status: "UPLOADING_SOURCE",
    progress_percent: 10,
    source_image_path: sourceImagePath,
    ai_image_path: null,
    dashscope_task_id: null,
    error_message: null,
    completed_at: null,
  });

  await upsertActiveGeneration(userId, generationId);

  try {
    await uploadObject(sourceImagePath, sourceBuffer, contentType || "image/png");

    try {
      await uploadImageVariants(userId, generationId, "source", sourceBuffer);
    } catch {
      // Variant generation is best-effort.
    }

    generation =
      (await updateGeneration(userId, generationId, {
        status: "PENDING",
        progress_percent: 24,
        error_message: null,
        completed_at: null,
      })) || generation;
  } catch (error) {
    await updateGeneration(userId, generationId, {
      status: "FAILED",
      progress_percent: 100,
      error_message: error instanceof Error ? error.message : "AI generation failed.",
      completed_at: toSqlTimestamp(),
    });
    await clearActiveGeneration(userId);

    const failedGeneration = await getGenerationById(userId, generationId);
    const [item] = await buildHistoryItems(failedGeneration ? [failedGeneration] : []);

    throw Object.assign(
      new Error(error instanceof Error ? error.message : "AI generation failed."),
      {
        status: 500,
        data: item || null,
      }
    );
  }

  void runGenerationPipeline({
    userId,
    generationId,
    sourceImagePath,
    styleSelection,
  });

  const [item] = await buildHistoryItems([generation]);
  return item;
}

async function handleHistory(body) {
  const rows = await getLatestGenerations(body.userId);
  return buildHistoryItems(rows);
}

async function handleHistoryItem(body, generationId) {
  const row = await getGenerationById(body.userId, generationId);

  if (!row) {
    return null;
  }

  const [item] = await buildHistoryItems([row]);
  return item || null;
}

async function handleHistoryImage(body, generationId) {
  const row = await getGenerationById(body.userId, generationId);

  if (!row) {
    throw Object.assign(new Error("Generation record not found."), {
      status: 404,
    });
  }

  const kind = body.kind === "ai" ? "ai" : "source";
  const variant =
    body.variant === "display" || body.variant === "thumb"
      ? body.variant
      : "original";
  const originalPath = kind === "ai" ? row.ai_image_path : row.source_image_path;

  if (!originalPath) {
    throw Object.assign(new Error("Requested image is not available."), {
      status: 404,
    });
  }

  const variantPath =
    variant === "display"
      ? buildDisplayImagePath(row.user_id, row.id, kind)
      : variant === "thumb"
      ? buildThumbnailImagePath(row.user_id, row.id, kind)
      : originalPath;

  let file = null;
  let resolvedPath = originalPath;

  try {
    file = await downloadObject(variantPath);
    resolvedPath = variantPath;
  } catch (error) {
    if (variantPath === originalPath) {
      throw error;
    }

    file = await downloadObject(originalPath);
    resolvedPath = originalPath;
  }

  return {
    contentType: file.contentType,
    etag: `"${Buffer.from(`${kind}:${variant}:${resolvedPath}`).toString("base64url")}"`,
    dataBase64: file.buffer.toString("base64"),
  };
}

function ensureInternalRequest(req) {
  if (req.headers["x-internal-api-secret"] !== INTERNAL_API_SECRET) {
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    assertConfig();

    if (req.method === "GET" && req.url === "/health") {
      return sendJson(res, 200, { success: true });
    }

    ensureInternalRequest(req);

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const body = req.method === "POST" || req.method === "PATCH" ? await readBody(req) : {};

    if (req.method === "POST" && url.pathname === "/generate") {
      return sendJson(res, 200, await handleGenerate(body));
    }

    if (req.method === "POST" && url.pathname === "/history") {
      return sendJson(res, 200, await handleHistory(body));
    }

    const historyMatch = /^\/history\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && historyMatch) {
      return sendJson(res, 200, await handleHistoryItem(body, historyMatch[1]));
    }

    const imageMatch = /^\/history\/([^/]+)\/image$/.exec(url.pathname);
    if (req.method === "POST" && imageMatch) {
      return sendJson(res, 200, await handleHistoryImage(body, imageMatch[1]));
    }

    return sendJson(res, 404, {
      error: "Not found.",
    });
  } catch (error) {
    return sendJson(res, error.status || 500, {
      error: error instanceof Error ? error.message : "Internal server error.",
      data: error.data || null,
    });
  }
});

server.listen(PORT, () => {
  console.log(`toutoutool-ai listening on ${PORT}`);
});


