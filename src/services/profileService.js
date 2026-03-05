import { hasSupabaseConfig } from "../lib/supabaseRest";
import { getStoredSession, updateAuthUserMetadata } from "./authService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const LOCAL_PROFILE_KEY = "medlink.local.profile";

function getHeaders(accessToken) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

function getAccessToken() {
  return getStoredSession()?.access_token || "";
}

function getFallbackProfile(user) {
  const metadata = user?.user_metadata || {};
  return {
    id: user?.id || "",
    firstName: metadata.first_name || "",
    lastName: metadata.last_name || "",
    phone: metadata.phone || "",
    email: user?.email || "",
  };
}

function parseLocalProfiles() {
  const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalProfiles(profiles) {
  localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profiles));
}

async function upsertProfileRow(accessToken, userId, profile) {
  const baseRequest = {
    method: "POST",
    headers: {
      ...getHeaders(accessToken),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  };

  // Preferred shape for schema with snake_case columns.
  let response = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    ...baseRequest,
    body: JSON.stringify({
      id: userId,
      first_name: profile.firstName,
      last_name: profile.lastName,
      phone: profile.phone,
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  // Fallback for schemas that use camelCase column names.
  if (!response.ok && /first_name|last_name/i.test(String(data?.message || data?.hint || ""))) {
    response = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      ...baseRequest,
      body: JSON.stringify({
        id: userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
      }),
    });

    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.hint || "Неуспешно записване на профила.";
    throw new Error(message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    id: row?.id || userId,
    firstName: row?.first_name ?? row?.firstName ?? "",
    lastName: row?.last_name ?? row?.lastName ?? "",
    phone: row?.phone || "",
  };
}

export async function fetchMyProfile(user) {
  if (!user?.id) {
    throw new Error("Няма активен потребител.");
  }

  const fallback = getFallbackProfile(user);

  if (!hasSupabaseConfig) {
    const profiles = parseLocalProfiles();
    const local = profiles[user.id];
    return {
      ...fallback,
      firstName: local?.firstName ?? fallback.firstName,
      lastName: local?.lastName ?? fallback.lastName,
      phone: local?.phone ?? fallback.phone,
    };
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("Трябва да си влязъл в профила си.");
  }

  let response;
  try {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("id", `eq.${user.id}`);
    params.set("limit", "1");

    response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?${params.toString()}`, {
      headers: getHeaders(accessToken),
    });
  } catch {
    throw new Error("Няма връзка със Supabase. Опитай отново.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.hint || "Неуспешно зареждане на профила.";
    throw new Error(message);
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return fallback;
  }

  return {
    id: row.id,
    firstName: row.first_name ?? row.firstName ?? fallback.firstName,
    lastName: row.last_name ?? row.lastName ?? fallback.lastName,
    phone: row.phone || fallback.phone,
    email: fallback.email,
  };
}

export async function updateMyProfile(user, payload) {
  if (!user?.id) {
    throw new Error("Няма активен потребител.");
  }

  const firstName = payload.firstName?.trim() || "";
  const lastName = payload.lastName?.trim() || "";
  const phone = payload.phone?.trim() || "";

  if (!firstName || !lastName) {
    throw new Error("Името и фамилията са задължителни.");
  }

  if (phone && !/^\+?[0-9\s-]{7,20}$/.test(phone)) {
    throw new Error("Телефонният номер е невалиден.");
  }

  let savedProfile = {
    id: user.id,
    firstName,
    lastName,
    phone,
  };

  if (!hasSupabaseConfig) {
    const profiles = parseLocalProfiles();
    profiles[user.id] = savedProfile;
    saveLocalProfiles(profiles);
  } else {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error("Трябва да си влязъл в профила си.");
    }

    savedProfile = await upsertProfileRow(accessToken, user.id, savedProfile);
  }

  const updatedUser = await updateAuthUserMetadata({
    first_name: savedProfile.firstName,
    last_name: savedProfile.lastName,
    phone: savedProfile.phone,
  });

  return {
    profile: {
      ...savedProfile,
      email: user.email || "",
    },
    user: updatedUser,
  };
}
