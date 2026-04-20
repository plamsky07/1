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

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
    } catch {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeDoctorProfile(row) {
  if (!row) return null;

  return {
    userId: row.user_id || row.userId || "",
    specialty: row.specialty || "",
    city: row.city || "",
    clinicName: row.clinic_name || row.clinicName || "",
    clinicId: row.clinic_id || row.clinicId || "",
    licenseNumber: row.license_number || row.licenseNumber || "",
    yearsExperience: Number(row.years_experience || row.yearsExperience || 0) || 0,
    bio: row.bio || "",
    services: normalizeArray(row.services),
    languages: normalizeArray(row.languages),
    online: Boolean(row.online),
    certificationConfirmed: Boolean(row.certification_confirmed || row.certificationConfirmed),
    verificationStatus: row.verification_status || row.verificationStatus || "pending_review",
    isListed: Boolean(row.is_listed || row.isListed),
    adminNotes: row.admin_notes || row.adminNotes || "",
  };
}

function getFallbackProfile(user) {
  const metadata = user?.user_metadata || {};
  return {
    id: user?.id || "",
    firstName: metadata.first_name || "",
    lastName: metadata.last_name || "",
    phone: metadata.phone || "",
    email: user?.email || "",
    role: user?.profileRole || metadata.role || "patient",
    accountType: user?.accountType || metadata.account_type || "patient",
    verificationStatus: user?.verificationStatus || metadata.verification_status || "active",
    accountStatus: user?.accountStatus || "active",
    adminNotes: user?.profile?.adminNotes || "",
    doctorProfile: normalizeDoctorProfile(user?.doctorProfile),
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

async function fetchOptionalDoctorProfile(accessToken, userId) {
  try {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("user_id", `eq.${userId}`);
    params.set("limit", "1");

    const response = await fetch(`${SUPABASE_URL}/rest/v1/doctor_profiles?${params.toString()}`, {
      headers: getHeaders(accessToken),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const row = Array.isArray(data) ? data[0] || null : null;
    return normalizeDoctorProfile(row);
  } catch {
    return null;
  }
}

async function upsertProfileRow(accessToken, userId, profile) {
  const baseRequest = {
    method: "POST",
    headers: {
      ...getHeaders(accessToken),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
  };

  let response = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    ...baseRequest,
    body: JSON.stringify({
      id: userId,
      first_name: profile.firstName,
      last_name: profile.lastName,
      phone: profile.phone,
      role: profile.role,
      account_type: profile.accountType,
      verification_status: profile.verificationStatus,
      account_status: profile.accountStatus,
      admin_notes: profile.adminNotes,
      email: profile.email,
    }),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok && /first_name|last_name/i.test(String(data?.message || data?.hint || ""))) {
    response = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      ...baseRequest,
      body: JSON.stringify({
        id: userId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        role: profile.role,
        accountType: profile.accountType,
        verificationStatus: profile.verificationStatus,
        accountStatus: profile.accountStatus,
        adminNotes: profile.adminNotes,
        email: profile.email,
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
    email: row?.email || profile.email || "",
    role: row?.role || profile.role || "patient",
    accountType: row?.account_type || row?.accountType || profile.accountType || "patient",
    verificationStatus:
      row?.verification_status || row?.verificationStatus || profile.verificationStatus || "active",
    accountStatus: row?.account_status || row?.accountStatus || profile.accountStatus || "active",
    adminNotes: row?.admin_notes || row?.adminNotes || profile.adminNotes || "",
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
      role: local?.role ?? fallback.role,
      accountType: local?.accountType ?? fallback.accountType,
      verificationStatus: local?.verificationStatus ?? fallback.verificationStatus,
      accountStatus: local?.accountStatus ?? fallback.accountStatus,
      adminNotes: local?.adminNotes ?? fallback.adminNotes,
      doctorProfile: local?.doctorProfile ?? fallback.doctorProfile,
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
  const doctorProfile = await fetchOptionalDoctorProfile(accessToken, user.id);

  if (!row) {
    return {
      ...fallback,
      doctorProfile: doctorProfile || fallback.doctorProfile,
    };
  }

  return {
    id: row.id,
    firstName: row.first_name ?? row.firstName ?? fallback.firstName,
    lastName: row.last_name ?? row.lastName ?? fallback.lastName,
    phone: row.phone || fallback.phone,
    email: row.email || fallback.email,
    role: row.role || fallback.role,
    accountType: row.account_type || row.accountType || fallback.accountType,
    verificationStatus:
      row.verification_status || row.verificationStatus || fallback.verificationStatus,
    accountStatus: row.account_status || row.accountStatus || fallback.accountStatus,
    adminNotes: row.admin_notes || row.adminNotes || fallback.adminNotes,
    doctorProfile: doctorProfile || fallback.doctorProfile,
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
    email: user.email || "",
    role: payload.role || user.profileRole || user.profile?.role || "patient",
    accountType: payload.accountType || user.accountType || user.profile?.accountType || "patient",
    verificationStatus:
      payload.verificationStatus ||
      user.verificationStatus ||
      user.profile?.verificationStatus ||
      "active",
    accountStatus: payload.accountStatus || user.accountStatus || user.profile?.accountStatus || "active",
    adminNotes: payload.adminNotes || user.profile?.adminNotes || "",
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
    role: savedProfile.role,
    account_type: savedProfile.accountType,
    verification_status: savedProfile.verificationStatus,
  });

  return {
    profile: {
      ...savedProfile,
      doctorProfile: payload.doctorProfile || user.doctorProfile || null,
    },
    user: updatedUser,
  };
}
