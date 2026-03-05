import { hasSupabaseConfig } from "../lib/supabaseRest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const AUTH_STORAGE_KEY = "medlink.auth.session";

function getAuthHeaders(accessToken) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function authRequest(path, { method = "GET", body, accessToken } = {}) {
  if (!hasSupabaseConfig) {
    throw new Error("Липсва Supabase конфигурация (.env).");
  }

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}${path}`, {
      method,
      headers: getAuthHeaders(accessToken),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Няма връзка със Supabase. Провери интернет, Project URL/Key и рестартирай приложението.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.msg || data?.error_description || data?.message || "Грешка при заявка към Supabase Auth.";
    throw new Error(message);
  }

  return data;
}

function saveSession(session) {
  if (!session?.access_token) return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getStoredSession() {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    clearSession();
    return null;
  }
}

export async function signUpWithEmail(email, password, profile = {}) {
  const metadata = {
    first_name: profile.firstName?.trim() || "",
    last_name: profile.lastName?.trim() || "",
    full_name: `${profile.firstName?.trim() || ""} ${profile.lastName?.trim() || ""}`.trim(),
    phone: profile.phone?.trim() || "",
  };

  const data = await authRequest("/auth/v1/signup", {
    method: "POST",
    body: { email, password, data: metadata },
  });

  if (data?.access_token) {
    saveSession(data);
  }

  return data;
}

export async function signInWithEmail(email, password) {
  const data = await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });

  saveSession(data);
  return data;
}

export async function signOut() {
  const session = getStoredSession();
  const accessToken = session?.access_token;

  if (accessToken) {
    try {
      await authRequest("/auth/v1/logout", {
        method: "POST",
        accessToken,
      });
    } catch {
      // If token is expired/invalid, clear local session anyway.
    }
  }

  clearSession();
}

export async function getCurrentUser() {
  const session = getStoredSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    return null;
  }

  try {
    const user = await authRequest("/auth/v1/user", {
      accessToken,
    });

    return user;
  } catch {
    clearSession();
    return null;
  }
}

export async function updateAuthUserMetadata(metadata = {}) {
  const session = getStoredSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error("Трябва да си влязъл в профила си.");
  }

  return authRequest("/auth/v1/user", {
    method: "PUT",
    accessToken,
    body: {
      data: {
        first_name: metadata.first_name || "",
        last_name: metadata.last_name || "",
        full_name: `${metadata.first_name || ""} ${metadata.last_name || ""}`.trim(),
        phone: metadata.phone || "",
      },
    },
  });
}

export { clearSession };
