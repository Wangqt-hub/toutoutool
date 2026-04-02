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

function normalizeTravelPlanRow(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    preferences: parseJsonValue(row.preferences),
    itinerary_json: parseJsonValue(row.itinerary_json),
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

async function patchRows(table, query, body, options = {}) {
  return rdbRequest("PATCH", table, {
    query,
    body,
    prefer: options.prefer || "return=representation",
    accept: options.accept || "application/json",
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
    await patchRows(
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

async function handleGetProfile(event) {
  return ensureProfile(event.userId, event.phoneNumber || null);
}

async function handleListTravelPlans(event) {
  await ensureProfile(event.userId, event.phoneNumber || null);

  const rows = await listRows("travel_plans", {
    query: {
      user_id: eq(event.userId),
      select: "*",
      order: orderBy("created_at", "desc"),
      limit: 10,
    },
  });

  return rows.map(normalizeTravelPlanRow);
}

async function handleCreateTravelPlan(event) {
  await ensureProfile(event.userId, event.phoneNumber || null);

  const payload = event.payload || {};
  const destination = requireString(payload.destination, "destination");
  const startDate = requireString(payload.start_date, "start_date");
  const endDate = requireString(payload.end_date, "end_date");
  const budget = requireString(payload.budget, "budget");

  const row = await insertOne("travel_plans", {
    id: randomUUID(),
    user_id: event.userId,
    destination,
    start_date: startDate,
    end_date: endDate,
    budget,
    preferences: stringifyJsonValue(
      Array.isArray(payload.preferences) ? payload.preferences : []
    ),
    notes: typeof payload.notes === "string" && payload.notes.trim() ? payload.notes.trim() : null,
    itinerary_json: stringifyJsonValue(payload.itinerary_json || null),
  });

  return normalizeTravelPlanRow(row);
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
      case "createTravelPlan":
        return success(await handleCreateTravelPlan(event));
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

