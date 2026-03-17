const {
  SUPABASE_PUBLIC_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
} = require("./config");

function hasSupabaseAuthConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);
}

function hasSupabaseAdminConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function isMissingRelationError(data) {
  const message = String(data?.message || data?.error || data || "");
  return data?.code === "42P01" || /relation .* does not exist/i.test(message);
}

async function parseHttpResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function supabaseRequest(
  path,
  { method = "GET", body, accessToken, serviceRole = false, headers = {} } = {}
) {
  if (!SUPABASE_URL) {
    throw new Error("Supabase URL is not configured.");
  }

  const apikey = serviceRole ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_PUBLIC_KEY;
  if (!apikey) {
    throw new Error("Supabase key is not configured.");
  }

  const requestHeaders = {
    apikey,
    ...headers,
  };

  if (body !== undefined && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  } else if (serviceRole) {
    requestHeaders.Authorization = `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body:
      body !== undefined
        ? requestHeaders["Content-Type"] === "application/json"
          ? JSON.stringify(body)
          : body
        : undefined,
  });

  const data = await parseHttpResponse(response);
  return { ok: response.ok, status: response.status, data };
}

async function safeFetchRows(tableName, { order, limit, filters = {} } = {}) {
  if (!hasSupabaseAdminConfig()) {
    return [];
  }

  const params = new URLSearchParams();
  params.set("select", "*");

  if (order) {
    params.set("order", order);
  }

  if (limit) {
    params.set("limit", String(limit));
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  });

  const result = await supabaseRequest(`/rest/v1/${tableName}?${params.toString()}`, {
    serviceRole: true,
  });

  if (!result.ok) {
    if (isMissingRelationError(result.data)) {
      return [];
    }

    console.error(`Supabase fetch ${tableName} failed:`, result.data);
    return [];
  }

  return Array.isArray(result.data) ? result.data : [];
}

module.exports = {
  hasSupabaseAdminConfig,
  hasSupabaseAuthConfig,
  isMissingRelationError,
  safeFetchRows,
  supabaseRequest,
};
