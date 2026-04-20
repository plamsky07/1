import { hasSupabaseConfig } from "../lib/supabaseRest";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const AUTH_STORAGE_KEY = "medlink.auth.session";

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value, fallback = "doctor-clinic") {
  const normalized = String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

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

export function getAccessToken() {
  return getStoredSession()?.access_token || "";
}

function buildRegistrationMetadata(profile = {}) {
  const accountType = profile.accountType === "doctor" ? "doctor" : "patient";
  const firstName = profile.firstName?.trim() || "";
  const lastName = profile.lastName?.trim() || "";
  const doctorServices = normalizeArray(profile.doctorServices);
  const doctorLanguages = normalizeArray(profile.doctorLanguages);
  const clinicName = profile.doctorClinicName?.trim() || "";

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    phone: profile.phone?.trim() || "",
    role: accountType === "doctor" ? "doctor" : "patient",
    account_type: accountType,
    verification_status: accountType === "doctor" ? "pending_review" : "active",
    doctor_specialty: profile.doctorSpecialty?.trim() || "",
    doctor_city: profile.doctorCity?.trim() || "",
    doctor_clinic_name: clinicName,
    doctor_clinic_id: slugify(clinicName, "doctor-clinic"),
    doctor_license_number: profile.doctorLicenseNumber?.trim() || "",
    doctor_years_experience: Number(profile.doctorYearsExperience || 0) || 0,
    doctor_bio: profile.doctorBio?.trim() || "",
    doctor_services: doctorServices,
    doctor_languages: doctorLanguages,
    doctor_online: Boolean(profile.doctorOnline),
    doctor_certification_confirmed: Boolean(profile.doctorCertificationConfirmed),
  };
}

async function loadCurrentUserShape(accessToken, user) {
  if (!hasSupabaseConfig || !accessToken || !user?.id) {
    return user;
  }

  try {
    const [profileRow, doctorProfileRow] = await Promise.all([
      authRequest(`/rest/v1/profiles?select=*&id=eq.${user.id}&limit=1`, {
        accessToken,
      }).then((result) => (Array.isArray(result) ? result[0] || null : result)),
      authRequest(`/rest/v1/doctor_profiles?select=*&user_id=eq.${user.id}&limit=1`, {
        accessToken,
      })
        .then((result) => (Array.isArray(result) ? result[0] || null : result))
        .catch(() => null),
    ]);

    return {
      ...user,
      profileRole: profileRow?.role || user.user_metadata?.role || user.role || "patient",
      accountType:
        profileRow?.account_type || user.user_metadata?.account_type || "patient",
      verificationStatus:
        profileRow?.verification_status ||
        user.user_metadata?.verification_status ||
        "active",
      accountStatus: profileRow?.account_status || "active",
      profile: profileRow
        ? {
            id: profileRow.id,
            email: profileRow.email || user.email || "",
            firstName: profileRow.first_name || "",
            lastName: profileRow.last_name || "",
            phone: profileRow.phone || "",
            role: profileRow.role || "patient",
            accountType: profileRow.account_type || "patient",
            verificationStatus: profileRow.verification_status || "active",
            accountStatus: profileRow.account_status || "active",
            adminNotes: profileRow.admin_notes || "",
          }
        : null,
      doctorProfile: doctorProfileRow
        ? {
            userId: doctorProfileRow.user_id,
            specialty: doctorProfileRow.specialty || "",
            city: doctorProfileRow.city || "",
            clinicName: doctorProfileRow.clinic_name || "",
            clinicId: doctorProfileRow.clinic_id || "",
            licenseNumber: doctorProfileRow.license_number || "",
            yearsExperience: Number(doctorProfileRow.years_experience || 0) || 0,
            bio: doctorProfileRow.bio || "",
            services: normalizeArray(doctorProfileRow.services),
            languages: normalizeArray(doctorProfileRow.languages),
            online: Boolean(doctorProfileRow.online),
            certificationConfirmed: Boolean(doctorProfileRow.certification_confirmed),
            verificationStatus:
              doctorProfileRow.verification_status ||
              profileRow?.verification_status ||
              "pending_review",
            isListed: Boolean(doctorProfileRow.is_listed),
            adminNotes: doctorProfileRow.admin_notes || "",
          }
        : null,
    };
  } catch {
    return user;
  }
}

export async function signUpWithEmail(email, password, profile = {}) {
  const metadata = buildRegistrationMetadata(profile);

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
  return {
    ...data,
    user: await loadCurrentUserShape(data?.access_token, data?.user),
  };
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

    return await loadCurrentUserShape(accessToken, user);
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

  const currentUser = await authRequest("/auth/v1/user", {
    accessToken,
  });

  return authRequest("/auth/v1/user", {
    method: "PUT",
    accessToken,
    body: {
      data: {
        ...(currentUser?.user_metadata || {}),
        first_name: metadata.first_name || "",
        last_name: metadata.last_name || "",
        full_name: `${metadata.first_name || ""} ${metadata.last_name || ""}`.trim(),
        phone: metadata.phone || "",
        role: metadata.role || currentUser?.user_metadata?.role || "patient",
        account_type:
          metadata.account_type || currentUser?.user_metadata?.account_type || "patient",
        verification_status:
          metadata.verification_status ||
          currentUser?.user_metadata?.verification_status ||
          "active",
      },
    },
  });
}

export { clearSession };
