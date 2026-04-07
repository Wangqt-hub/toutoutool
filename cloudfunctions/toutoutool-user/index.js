const { randomUUID } = require("node:crypto");

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
const API_BASE_URL = `https://${ENV_ID}.api.tcloudbasegateway.com`;
const DEFAULT_PREFERENCES = ["food", "sightseeing"];

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

function stringifyJsonValue(value) {
  if (value === undefined || value === null) {
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

function readDateInput(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const trimmed = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function toDateInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function toSqlTimestamp(value) {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

function normalizeTimestampInput(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const directSqlMatch = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

  if (directSqlMatch.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      "last_generated_at must be a valid datetime string."
    );
  }

  return toSqlTimestamp(parsed);
}

function addDays(base, days) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date;
}

function getDefaultTravelDates() {
  const start = new Date();
  const end = addDays(start, 2);

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
}

function normalizeBudget(value) {
  if (
    value === "unspecified" ||
    value === "low" ||
    value === "medium" ||
    value === "high"
  ) {
    return value;
  }

  return "unspecified";
}

function normalizePlanStatus(value) {
  if (value === "generated" || value === "attention" || value === "draft") {
    return value;
  }

  return "draft";
}

function normalizePreferences(value) {
  if (!Array.isArray(value)) {
    return DEFAULT_PREFERENCES;
  }

  const normalized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);

  return normalized.length > 0 ? normalized : DEFAULT_PREFERENCES;
}

function hasItineraryContent(value) {
  const parsed = parseJsonValue(value);

  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.days)) {
    return false;
  }

  return parsed.days.some(
    (day) => day && Array.isArray(day.items) && day.items.length > 0
  );
}

function computeTravelPlanStatus(payload, currentRow) {
  if (payload.plan_status !== undefined) {
    return normalizePlanStatus(payload.plan_status);
  }

  const generationError =
    payload.generation_error !== undefined
      ? String(payload.generation_error || "").trim()
      : String(currentRow?.generation_error || "").trim();

  if (generationError) {
    return "attention";
  }

  const itineraryValue =
    payload.itinerary_json !== undefined
      ? payload.itinerary_json
      : currentRow?.itinerary_json || null;

  return hasItineraryContent(itineraryValue) ? "generated" : "draft";
}

function normalizeTravelPlanRow(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    preferences: parseJsonValue(row.preferences),
    itinerary_json: parseJsonValue(row.itinerary_json),
    source_links_json: parseJsonValue(row.source_links_json),
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

  return rdbRequest("PATCH", table, {
    query,
    body,
    prefer: "return=representation",
    accept: "application/vnd.pgrst.object+json",
  });
}

function toSubscriptionTier(value) {
  return value === "premium" ? "premium" : "free";
}

async function ensureProfile(userId, phoneNumber) {
  const existing = await getFirstRow("profiles", {
    query: {
      user_id: eq(userId),
      select: "*",
    },
  });

  if (!existing) {
    const created = await insertOne("profiles", {
      user_id: userId,
      phone_e164: phoneNumber || `unknown:${userId}`,
      subscription_tier: "free",
    });

    return {
      subscriptionTier: toSubscriptionTier(created.subscription_tier),
    };
  }

  if (phoneNumber && existing.phone_e164 !== phoneNumber) {
    await patchOne(
      "profiles",
      {
        user_id: eq(userId),
      },
      {
        phone_e164: phoneNumber,
      }
    );
  }

  return {
    subscriptionTier: toSubscriptionTier(existing.subscription_tier),
  };
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is required.`);
  }

  return value.trim();
}

function buildCreateTravelPlanData(payload = {}) {
  const defaults = getDefaultTravelDates();
  const requestedStart = readDateInput(payload.start_date);
  const requestedEnd = readDateInput(payload.end_date);
  const startDate = requestedStart || defaults.startDate;
  const endDate =
    requestedEnd && requestedEnd >= startDate ? requestedEnd : requestedStart || defaults.endDate;

  return {
    destination:
      typeof payload.destination === "string" && payload.destination.trim()
        ? payload.destination.trim()
        : "未命名旅程",
    start_date: startDate,
    end_date: endDate >= startDate ? endDate : startDate,
    budget: normalizeBudget(payload.budget),
    preferences: stringifyJsonValue(normalizePreferences(payload.preferences)),
    notes:
      typeof payload.notes === "string" && payload.notes.trim()
        ? payload.notes.trim()
        : null,
    itinerary_json: stringifyJsonValue(payload.itinerary_json || null),
    source_links_json: stringifyJsonValue(
      Array.isArray(payload.source_links_json) ? payload.source_links_json : []
    ),
    generation_model:
      typeof payload.generation_model === "string" && payload.generation_model.trim()
        ? payload.generation_model.trim()
        : null,
    generation_error:
      typeof payload.generation_error === "string" && payload.generation_error.trim()
        ? payload.generation_error.trim()
        : null,
    last_generated_at: normalizeTimestampInput(payload.last_generated_at),
    plan_status: computeTravelPlanStatus(payload, null),
  };
}

function buildTravelPlanPatch(payload = {}, currentRow) {
  const next = {};
  const currentStart = readDateInput(currentRow.start_date);
  const currentEnd = readDateInput(currentRow.end_date);
  const requestedStart =
    payload.start_date !== undefined ? readDateInput(payload.start_date) : currentStart;
  const requestedEnd =
    payload.end_date !== undefined ? readDateInput(payload.end_date) : currentEnd;
  const nextStart = requestedStart || currentStart;
  const nextEnd = requestedEnd && requestedEnd >= nextStart ? requestedEnd : nextStart;

  if (payload.destination !== undefined) {
    next.destination = requireString(payload.destination, "destination");
  }

  if (payload.start_date !== undefined || payload.end_date !== undefined) {
    next.start_date = nextStart;
    next.end_date = nextEnd;
  }

  if (payload.budget !== undefined) {
    next.budget = normalizeBudget(payload.budget);
  }

  if (payload.preferences !== undefined) {
    next.preferences = stringifyJsonValue(normalizePreferences(payload.preferences));
  }

  if (payload.notes !== undefined) {
    next.notes =
      typeof payload.notes === "string" && payload.notes.trim()
        ? payload.notes.trim()
        : null;
  }

  if (payload.itinerary_json !== undefined) {
    next.itinerary_json = stringifyJsonValue(payload.itinerary_json);
  }

  if (payload.source_links_json !== undefined) {
    next.source_links_json = stringifyJsonValue(
      Array.isArray(payload.source_links_json) ? payload.source_links_json : []
    );
  }

  if (payload.generation_model !== undefined) {
    next.generation_model =
      typeof payload.generation_model === "string" && payload.generation_model.trim()
        ? payload.generation_model.trim()
        : null;
  }

  if (payload.generation_error !== undefined) {
    next.generation_error =
      typeof payload.generation_error === "string" && payload.generation_error.trim()
        ? payload.generation_error.trim()
        : null;
  }

  if (payload.last_generated_at !== undefined) {
    next.last_generated_at = normalizeTimestampInput(payload.last_generated_at);
  }

  next.plan_status = computeTravelPlanStatus(payload, currentRow);

  return next;
}

async function handleGetProfile(event) {
  return ensureProfile(event.userId, event.phoneNumber || null);
}

async function handleListTravelPlans(event) {
  await ensureProfile(event.userId, event.phoneNumber || null);

  const rows = await listRows("travel_plans", {
    query: {
      user_id: eq(event.userId),
      select: "*",
      order: orderBy("updated_at", "desc"),
      limit: 40,
    },
  });

  return rows.map(normalizeTravelPlanRow);
}

async function handleGetTravelPlan(event) {
  await ensureProfile(event.userId, event.phoneNumber || null);

  const row = await getFirstRow("travel_plans", {
    query: {
      id: eq(requireString(event.travelPlanId, "travelPlanId")),
      user_id: eq(event.userId),
      select: "*",
    },
  });

  return normalizeTravelPlanRow(row);
}

async function handleCreateTravelPlan(event) {
  await ensureProfile(event.userId, event.phoneNumber || null);

  const payload = event.payload || {};
  const row = await insertOne("travel_plans", {
    id: randomUUID(),
    user_id: event.userId,
    ...buildCreateTravelPlanData(payload),
  });

  return normalizeTravelPlanRow(row);
}

async function handleUpdateTravelPlan(event) {
  await ensureProfile(event.userId, event.phoneNumber || null);

  const travelPlanId = requireString(event.travelPlanId, "travelPlanId");
  const query = {
    id: eq(travelPlanId),
    user_id: eq(event.userId),
  };
  const currentRow = await getFirstRow("travel_plans", {
    query: {
      ...query,
      select: "*",
    },
  });

  if (!currentRow) {
    return null;
  }

  const nextRow = await patchOne(
    "travel_plans",
    query,
    buildTravelPlanPatch(event.payload || {}, currentRow)
  );

  return normalizeTravelPlanRow(nextRow);
}

async function handleCreateIdeaBox(event) {
  await ensureProfile(event.userId, event.phoneNumber || null);

  const payload = event.payload || {};
  const content = requireString(payload.content, "content");

  return insertOne("idea_box", {
    id: randomUUID(),
    user_id: event.userId,
    content,
    contact:
      typeof payload.contact === "string" && payload.contact.trim()
        ? payload.contact.trim()
        : null,
    allow_contact: payload.allow_contact === false ? false : true,
  });
}

exports.main = async (event = {}) => {
  try {
    if (!event.userId) {
      return failure(400, "userId is required.");
    }

    switch (event.action) {
      case "getProfile":
        return success(await handleGetProfile(event));
      case "listTravelPlans":
        return success(await handleListTravelPlans(event));
      case "getTravelPlan":
        return success(await handleGetTravelPlan(event));
      case "createTravelPlan":
        return success(await handleCreateTravelPlan(event));
      case "updateTravelPlan":
        return success(await handleUpdateTravelPlan(event));
      case "createIdeaBox":
        return success(await handleCreateIdeaBox(event));
      default:
        return failure(400, `Unsupported action: ${event.action || "unknown"}`);
    }
  } catch (error) {
    return failure(
      500,
      error instanceof Error ? error.message : "Function execution failed."
    );
  }
};
