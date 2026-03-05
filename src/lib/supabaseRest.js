const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

function buildHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function supabaseSelect(table, { select = "*", filters = {}, orderBy } = {}) {
  if (!hasSupabaseConfig) {
    throw new Error("Supabase config is missing");
  }

  const params = new URLSearchParams();
  params.set("select", select);

  Object.entries(filters).forEach(([field, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(field, `eq.${value}`);
    }
  });

  if (orderBy?.column) {
    params.set("order", `${orderBy.column}.${orderBy.ascending === false ? "desc" : "asc"}`);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, {
    headers: buildHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${errorText}`);
  }

  return response.json();
}
