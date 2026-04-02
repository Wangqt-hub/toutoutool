const { randomUUID } = require("node:crypto");

const MAX_BEAD_WORKSPACES = 3;
const WORKSPACE_LIMIT_ERROR_CODE = "WORKSPACE_LIMIT_REACHED";

function getEnv(name, fallback) {
  const value = process.env[name];

  if (value && String(value).trim()) {
    return String(value).trim();
  }

  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`${name} is not configured.`);
}

const ENV_ID = getEnv("CLOUDBASE_ENV_ID", process.env.TCB_ENV || "");
const API_KEY = getEnv("CLOUDBASE_SERVER_API_KEY");
const SQL_INSTANCE = getEnv("CLOUDBASE_SQL_INSTANCE", "default");
const SQL_SCHEMA = getEnv("CLOUDBASE_SQL_SCHEMA", ENV_ID);
const STORAGE_BUCKET = getEnv("CLOUDBASE_STORAGE_BUCKET");
const API_BASE_URL = `https://${ENV_ID}.api.tcloudbasegateway.com`;

class WorkspaceLimitError extends Error {
  constructor(data) {
    super(
      `Current workspace history is limited to ${data.maxWorkspaces} items. Please delete ${data.requiredDeletionCount} workspace(s) first.`
    );
    this.name = "WorkspaceLimitError";
    this.code = WORKSPACE_LIMIT_ERROR_CODE;
    this.status = 409;
    this.data = data;
  }
}

function success(data) {
  return { success: true, data };
}

function failure(status, error, code, data) {
  return {
    success: false,
    status,
    error,
    code,
    data,
  };
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

function normalizeCompletedColorIndexes(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : []).filter(
        (value) => Number.isInteger(value) && value >= 0
      )
    )
  ).sort((left, right) => left - right);
}

function stringifyJsonValue(value) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  return typeof value === "string" ? value : JSON.stringify(value);
}

function parseJsonValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return value;
  }

  if (!(trimmed.startsWith("[") || trimmed.startsWith("{"))) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function normalizeWorkspaceRow(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    pattern_data: parseJsonValue(row.pattern_data),
    used_color_codes: parseJsonValue(row.used_color_codes),
    completed_color_indexes: parseJsonValue(row.completed_color_indexes),
    thumbnail_url: row.thumbnail_url || null,
  };
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

  return Array.isArray(rows) ? rows.map(normalizeWorkspaceRow) : [];
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
  return normalizeWorkspaceRow(
    await rdbRequest("POST", table, {
      body,
      prefer: "return=representation",
      accept: "application/vnd.pgrst.object+json",
    })
  );
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

  // CloudBase MySQL REST may omit untouched columns in PATCH responses.
  // Merge the patch result over the previously loaded row so callers
  // always receive a complete workspace payload.
  return normalizeWorkspaceRow({
    ...existing,
    ...(patched || {}),
  });
}

async function patchRows(table, query, body) {
  return rdbRequest("PATCH", table, {
    query,
    body,
    prefer: "return=representation",
    accept: "application/json",
  });
}

async function deleteRows(table, query) {
  return rdbRequest("DELETE", table, {
    query,
    prefer: "return=representation",
    accept: "application/json",
  });
}

async function upsertCurrentWorkspace(userId, workspaceId) {
  const updated = await patchOne(
    "user_current_workspaces",
    {
      user_id: eq(userId),
    },
    {
      workspace_id: workspaceId,
    }
  );

  if (updated) {
    return updated;
  }

  return rdbRequest("POST", "user_current_workspaces", {
    body: {
      user_id: userId,
      workspace_id: workspaceId,
    },
    prefer: "return=representation",
    accept: "application/vnd.pgrst.object+json",
  });
}

async function clearCurrentWorkspace(userId) {
  const existing = await getFirstRow("user_current_workspaces", {
    query: {
      user_id: eq(userId),
      select: "*",
    },
  });

  if (!existing) {
    return;
  }

  await deleteRows("user_current_workspaces", {
    user_id: eq(userId),
  });
}

async function getCurrentWorkspaceId(userId) {
  const mapping = await getFirstRow("user_current_workspaces", {
    query: {
      user_id: eq(userId),
      select: "*",
    },
  });

  return mapping ? mapping.workspace_id : null;
}

function requireWorkspaceInput(input) {
  if (
    !input ||
    !input.patternData ||
    !Array.isArray(input.patternData.grid) ||
    !Array.isArray(input.patternData.palette) ||
    typeof input.brand !== "string" ||
    !input.brand ||
    typeof input.sourceType !== "string" ||
    !input.sourceType
  ) {
    throw new Error("Invalid workspace payload.");
  }
}

function createWorkspaceName(sourceType, preferredName) {
  const trimmed = typeof preferredName === "string" ? preferredName.trim() : "";

  if (trimmed) {
    return trimmed;
  }

  const prefix =
    sourceType === "ai"
      ? "AI 图纸"
      : sourceType === "pattern"
      ? "导入图纸"
      : sourceType === "legacy"
      ? "历史图纸"
      : "图片图纸";

  const stamp = new Date()
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, "")
    .replace(/:/g, "-");

  return `${prefix} ${stamp}`;
}

function getWorkspaceDimensions(patternData) {
  return {
    width: Array.isArray(patternData.grid[0]) ? patternData.grid[0].length : 0,
    height: patternData.grid.length,
  };
}

function buildWorkspaceColorUsage(patternData, brand) {
  const countMap = new Map();

  patternData.grid.forEach((row) => {
    row.forEach((colorIndex) => {
      if (colorIndex === null || colorIndex === undefined) {
        return;
      }

      countMap.set(colorIndex, (countMap.get(colorIndex) || 0) + 1);
    });
  });

  return Array.from(countMap.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([colorIndex, count]) => {
      const color = patternData.palette[colorIndex] || {};
      const brandCodes = color.brandCodes || {};

      return {
        colorIndex,
        colorId: color.id ?? colorIndex,
        hex: color.hex || "#000000",
        brandCode: brandCodes[brand] || null,
        count,
      };
    });
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");

  if (!match) {
    throw new Error("Invalid thumbnail payload.");
  }

  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
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
    {
      objectId: path,
    },
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
  const validPaths = paths.filter(Boolean);

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

function buildThumbnailProxyUrl(workspaceId) {
  return "/api/bead-workspaces/" + workspaceId + "/thumbnail";
}

async function attachThumbnailUrls(rows) {
  return rows.map((row) => ({
    ...row,
    thumbnail_url: row.thumbnail_path ? buildThumbnailProxyUrl(row.id) : null,
  }));
}

async function listWorkspaceRows(userId) {
  const rows = await listRows("bead_workspaces", {
    query: {
      user_id: eq(userId),
      select: "*",
      order: orderBy("updated_at", "desc"),
      limit: 25,
    },
  });

  return attachThumbnailUrls(rows);
}

function buildOverviewPayload(currentWorkspaceId, rows) {
  return {
    currentWorkspaceId,
    rows,
  };
}

function getRequiredDeletionCount(totalCount) {
  return Math.max(0, totalCount - MAX_BEAD_WORKSPACES + 1);
}

function normalizeDeleteWorkspaceIds(deleteWorkspaceIds) {
  return Array.from(
    new Set(
      (Array.isArray(deleteWorkspaceIds) ? deleteWorkspaceIds : []).filter(
        (value) => typeof value === "string" && value.trim()
      )
    )
  );
}

async function deleteWorkspaceRows(userId, rows, currentWorkspaceId) {
  const rowIds = rows.map((row) => row.id);
  const thumbnailPaths = rows.map((row) => row.thumbnail_path).filter(Boolean);

  if (thumbnailPaths.length > 0) {
    await deleteObjects(thumbnailPaths);
  }

  await Promise.all(
    rowIds.map((rowId) =>
      deleteRows("bead_workspaces", {
        user_id: eq(userId),
        id: eq(rowId),
      })
    )
  );

  if (currentWorkspaceId && rowIds.includes(currentWorkspaceId)) {
    await clearCurrentWorkspace(userId);
  }
}

async function handleListWorkspaceOverview(event) {
  const currentWorkspaceId = await getCurrentWorkspaceId(event.userId);
  const rows = await listWorkspaceRows(event.userId);

  return buildOverviewPayload(currentWorkspaceId, rows);
}

async function handleCreateWorkspace(event) {
  requireWorkspaceInput(event.input);

  const input = event.input;
  const existingRows = await listWorkspaceRows(event.userId);
  const currentWorkspaceId = await getCurrentWorkspaceId(event.userId);
  const requiredDeletionCount = getRequiredDeletionCount(existingRows.length);
  const deleteWorkspaceIds = normalizeDeleteWorkspaceIds(input.deleteWorkspaceIds);

  if (requiredDeletionCount > 0 && deleteWorkspaceIds.length < requiredDeletionCount) {
    throw new WorkspaceLimitError({
      overview: buildOverviewPayload(currentWorkspaceId, existingRows),
      requiredDeletionCount,
      maxWorkspaces: MAX_BEAD_WORKSPACES,
    });
  }

  if (deleteWorkspaceIds.length > 0) {
    const rowsToDelete = existingRows.filter((row) => deleteWorkspaceIds.includes(row.id));

    if (rowsToDelete.length !== deleteWorkspaceIds.length) {
      throw new Error("One or more selected workspaces could not be found.");
    }

    await deleteWorkspaceRows(event.userId, rowsToDelete, currentWorkspaceId);
  }

  const workspaceId = randomUUID();
  const dimensions = getWorkspaceDimensions(input.patternData);
  const usedColorCodes = buildWorkspaceColorUsage(input.patternData, input.brand);
  const completedColorIndexes = normalizeCompletedColorIndexes(input.completedColorIndexes);
  const thumbnailPath = input.thumbnailDataUrl
    ? `bead/workspaces/${event.userId}/${workspaceId}/thumbnail.png`
    : null;

  if (thumbnailPath) {
    const parsed = parseDataUrl(input.thumbnailDataUrl);
    await uploadObject(thumbnailPath, parsed.bytes, parsed.contentType);
  }

  const row = await insertOne("bead_workspaces", {
    id: workspaceId,
    user_id: event.userId,
    name: createWorkspaceName(input.sourceType, input.name),
    source_type: input.sourceType,
    brand: input.brand,
    pattern_data: stringifyJsonValue(input.patternData),
    width: dimensions.width,
    height: dimensions.height,
    used_color_codes: stringifyJsonValue(usedColorCodes),
    completed_color_indexes: stringifyJsonValue(completedColorIndexes),
    selected_color_index:
      typeof input.selectedColorIndex === "number" ? input.selectedColorIndex : null,
    thumbnail_path: thumbnailPath,
    last_opened_at: toSqlTimestamp(),
  });

  await upsertCurrentWorkspace(event.userId, workspaceId);
  const rowsWithUrls = await attachThumbnailUrls([row]);

  return {
    currentWorkspaceId: workspaceId,
    row: rowsWithUrls[0],
  };
}

async function handleGetWorkspaceById(event) {
  const currentWorkspaceId = await getCurrentWorkspaceId(event.userId);
  const row = await getFirstRow("bead_workspaces", {
    query: {
      user_id: eq(event.userId),
      id: eq(event.workspaceId),
      select: "*",
    },
  });

  if (!row) {
    return {
      currentWorkspaceId,
      row: null,
    };
  }

  const touched =
    (await patchOne(
      "bead_workspaces",
      {
        user_id: eq(event.userId),
        id: eq(event.workspaceId),
      },
      {
        last_opened_at: toSqlTimestamp(),
      }
    )) || row;

  const rowsWithUrls = await attachThumbnailUrls([touched]);

  return {
    currentWorkspaceId,
    row: rowsWithUrls[0],
  };
}

async function handleUpdateWorkspaceState(event) {
  const input = event.input || {};
  const updated = await patchOne(
    "bead_workspaces",
    {
      user_id: eq(event.userId),
      id: eq(event.workspaceId),
    },
    {
      completed_color_indexes: stringifyJsonValue(
        normalizeCompletedColorIndexes(input.completedColorIndexes)
      ),
      selected_color_index:
        typeof input.selectedColorIndex === "number" ? input.selectedColorIndex : null,
      last_opened_at: toSqlTimestamp(),
    }
  );

  if (!updated) {
    return null;
  }

  return {
    updatedAt: updated.updated_at,
    lastOpenedAt: updated.last_opened_at || null,
  };
}

async function handleActivateWorkspace(event) {
  const row = await getFirstRow("bead_workspaces", {
    query: {
      user_id: eq(event.userId),
      id: eq(event.workspaceId),
      select: "*",
    },
  });

  if (!row) {
    return {
      currentWorkspaceId: null,
      row: null,
    };
  }

  await upsertCurrentWorkspace(event.userId, event.workspaceId);
  const touched =
    (await patchOne(
      "bead_workspaces",
      {
        user_id: eq(event.userId),
        id: eq(event.workspaceId),
      },
      {
        last_opened_at: toSqlTimestamp(),
      }
    )) || row;
  const rowsWithUrls = await attachThumbnailUrls([touched]);

  return {
    currentWorkspaceId: event.workspaceId,
    row: rowsWithUrls[0],
  };
}

exports.main = async (event = {}) => {
  try {
    if (!event.userId) {
      return failure(400, "userId is required.");
    }

    switch (event.action) {
      case "listWorkspaceOverview":
        return success(await handleListWorkspaceOverview(event));
      case "createWorkspace":
        return success(await handleCreateWorkspace(event));
      case "getWorkspaceById":
        return success(await handleGetWorkspaceById(event));
      case "updateWorkspaceState":
        return success(await handleUpdateWorkspaceState(event));
      case "activateWorkspace":
        return success(await handleActivateWorkspace(event));
      default:
        return failure(400, `Unsupported action: ${event.action || "unknown"}`);
    }
  } catch (error) {
    if (error instanceof WorkspaceLimitError) {
      return failure(error.status, error.message, error.code, error.data);
    }

    return failure(
      500,
      error instanceof Error ? error.message : "Function execution failed."
    );
  }
};



