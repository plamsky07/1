const { sanitizeText } = require("./config");
const { safeFetchRows, supabaseRequest, hasSupabaseAdminConfig } = require("./supabase");
const { normalizeSubscription } = require("./subscriptions");

const APPOINTMENT_STATUSES = new Set([
  "pending",
  "booked",
  "confirmed",
  "done",
  "cancelled",
  "rejected",
]);
const PROFILE_ROLES = new Set(["patient", "doctor", "admin"]);
const ACCOUNT_TYPES = new Set(["patient", "doctor"]);
const ACCOUNT_STATUSES = new Set(["active", "pending_review", "blocked"]);
const VERIFICATION_STATUSES = new Set([
  "active",
  "pending_review",
  "approved",
  "rejected",
  "suspended",
]);

function normalizeArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeText(item, 160)).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((item) => sanitizeText(item, 160)).filter(Boolean)
        : [];
    } catch {
      return value
        .split(",")
        .map((item) => sanitizeText(item, 160))
        .filter(Boolean);
    }
  }

  return [];
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

function buildDefaultSlots() {
  return ["09:00", "09:30", "10:00", "10:30", "14:00", "14:30"];
}

function normalizeProfile(row) {
  return {
    id: String(row.id || ""),
    email: sanitizeText(row.email, 160),
    firstName: sanitizeText(row.first_name || row.firstName, 80),
    lastName: sanitizeText(row.last_name || row.lastName, 80),
    phone: sanitizeText(row.phone, 40),
    role: sanitizeText(row.role, 40) || "patient",
    accountType: sanitizeText(row.account_type || row.accountType, 40) || "patient",
    verificationStatus:
      sanitizeText(row.verification_status || row.verificationStatus, 40) || "active",
    accountStatus: sanitizeText(row.account_status || row.accountStatus, 40) || "active",
    adminNotes: sanitizeText(row.admin_notes || row.adminNotes, 500),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString(),
  };
}

function normalizeDoctorProfile(row) {
  return {
    userId: String(row.user_id || row.userId || ""),
    specialty: sanitizeText(row.specialty, 120),
    city: sanitizeText(row.city, 120),
    clinicName: sanitizeText(row.clinic_name || row.clinicName, 160),
    clinicId: sanitizeText(row.clinic_id || row.clinicId, 160),
    licenseNumber: sanitizeText(row.license_number || row.licenseNumber, 120),
    yearsExperience: Number(row.years_experience || row.yearsExperience || 0) || 0,
    bio: sanitizeText(row.bio, 2000),
    services: normalizeArray(row.services),
    languages: normalizeArray(row.languages),
    online: Boolean(row.online),
    certificationConfirmed: Boolean(row.certification_confirmed || row.certificationConfirmed),
    verificationStatus:
      sanitizeText(row.verification_status || row.verificationStatus, 40) ||
      "pending_review",
    isListed: Boolean(row.is_listed || row.isListed),
    adminNotes: sanitizeText(row.admin_notes || row.adminNotes, 500),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || row.created_at || new Date().toISOString(),
  };
}

function normalizeDoctorDirectoryRow(row) {
  return {
    id: String(row.id || ""),
    name: sanitizeText(row.name, 160),
    specialty: sanitizeText(row.specialty, 120),
    city: sanitizeText(row.city, 120),
    clinicId: sanitizeText(row.clinic_id || row.clinicId, 160),
    clinicName: sanitizeText(row.clinic_name || row.clinicName, 160),
    online: Boolean(row.online),
    bio: sanitizeText(row.bio, 2000),
    services: normalizeArray(row.services),
    slots: normalizeArray(row.slots),
  };
}

function buildDoctorDirectoryPayload(profile, doctorProfile) {
  const fullName =
    sanitizeText(`${profile.firstName} ${profile.lastName}`, 160) ||
    sanitizeText(profile.email, 160) ||
    "MedLink Doctor";

  return {
    id: profile.id,
    name: fullName,
    specialty: doctorProfile.specialty || "Лекар",
    city: doctorProfile.city || "София",
    clinic_id:
      doctorProfile.clinicId || slugify(doctorProfile.clinicName, `doctor-${profile.id}`),
    clinic_name: doctorProfile.clinicName || "MedLink Clinic",
    online: doctorProfile.online,
    bio:
      doctorProfile.bio ||
      "Профилът е одобрен от администратор и очаква финална редакция.",
    services:
      doctorProfile.services.length > 0
        ? doctorProfile.services
        : ["Първичен преглед", "Контролен преглед", "Консултация"],
    slots: buildDefaultSlots(),
  };
}

function normalizeAdminUser(profile, doctorProfile, subscription, doctorDirectoryEntry) {
  return {
    ...profile,
    fullName:
      sanitizeText(`${profile.firstName} ${profile.lastName}`, 160) || profile.email,
    subscription: subscription || null,
    doctorProfile: doctorProfile || null,
    isListedDoctor: Boolean(doctorDirectoryEntry),
  };
}

async function patchTableRow(tableName, filters, payload) {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase admin достъпът не е конфигуриран.");
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  Object.entries(filters).forEach(([key, value]) => {
    params.set(key, `eq.${value}`);
  });

  const result = await supabaseRequest(`/rest/v1/${tableName}?${params.toString()}`, {
    method: "PATCH",
    serviceRole: true,
    headers: {
      Prefer: "return=representation",
    },
    body: payload,
  });

  if (!result.ok) {
    throw new Error(
      result.data?.message || result.data?.error || `Неуспешно обновяване на ${tableName}.`
    );
  }

  return Array.isArray(result.data) ? result.data[0] || null : result.data;
}

async function upsertTableRow(tableName, payload) {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase admin достъпът не е конфигуриран.");
  }

  const result = await supabaseRequest(`/rest/v1/${tableName}`, {
    method: "POST",
    serviceRole: true,
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: payload,
  });

  if (!result.ok) {
    throw new Error(
      result.data?.message || result.data?.error || `Неуспешен upsert към ${tableName}.`
    );
  }

  return Array.isArray(result.data) ? result.data[0] || null : result.data;
}

async function deleteTableRow(tableName, filters) {
  if (!hasSupabaseAdminConfig()) {
    throw new Error("Supabase admin достъпът не е конфигуриран.");
  }

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    params.set(key, `eq.${value}`);
  });

  const result = await supabaseRequest(`/rest/v1/${tableName}?${params.toString()}`, {
    method: "DELETE",
    serviceRole: true,
    headers: {
      Prefer: "return=representation",
    },
  });

  if (!result.ok) {
    throw new Error(
      result.data?.message || result.data?.error || `Неуспешно изтриване от ${tableName}.`
    );
  }

  return Array.isArray(result.data) ? result.data[0] || null : result.data;
}

async function fetchSupportingAdminRows() {
  const [profileRows, doctorProfileRows, subscriptionRows, doctorDirectoryRows] =
    await Promise.all([
      safeFetchRows("profiles", { order: "created_at.desc" }),
      safeFetchRows("doctor_profiles", { order: "created_at.desc" }),
      safeFetchRows("subscriptions", { order: "updated_at.desc" }),
      safeFetchRows("doctors", { order: "name.asc" }),
    ]);

  return {
    profiles: profileRows.map(normalizeProfile),
    doctorProfiles: doctorProfileRows.map(normalizeDoctorProfile),
    subscriptions: subscriptionRows.map(normalizeSubscription).filter(Boolean),
    doctorDirectory: doctorDirectoryRows.map(normalizeDoctorDirectoryRow),
  };
}

async function fetchAdminUsers() {
  const { profiles, doctorProfiles, subscriptions, doctorDirectory } =
    await fetchSupportingAdminRows();

  return profiles
    .map((profile) =>
      normalizeAdminUser(
        profile,
        doctorProfiles.find((item) => item.userId === profile.id) || null,
        subscriptions.find((item) => item.userId === profile.id) || null,
        doctorDirectory.find((item) => item.id === profile.id) || null
      )
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function fetchDoctorApplications() {
  const users = await fetchAdminUsers();
  return users
    .filter((user) => user.accountType === "doctor" || user.doctorProfile)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function updateAdminUser(userId, payload = {}) {
  const role = sanitizeText(payload.role, 40).toLowerCase();
  const accountType = sanitizeText(payload.accountType, 40).toLowerCase();
  const verificationStatus = sanitizeText(payload.verificationStatus, 40).toLowerCase();
  const accountStatus = sanitizeText(payload.accountStatus, 40).toLowerCase();
  const adminNotes = sanitizeText(payload.adminNotes, 500);

  const patch = {};
  if (PROFILE_ROLES.has(role)) {
    patch.role = role;
  }
  if (ACCOUNT_TYPES.has(accountType)) {
    patch.account_type = accountType;
  }
  if (VERIFICATION_STATUSES.has(verificationStatus)) {
    patch.verification_status = verificationStatus;
  }
  if (ACCOUNT_STATUSES.has(accountStatus)) {
    patch.account_status = accountStatus;
  }
  if (payload.adminNotes !== undefined) {
    patch.admin_notes = adminNotes;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error("Няма валидни полета за обновяване на потребителя.");
  }

  await patchTableRow("profiles", { id: userId }, patch);
  const users = await fetchAdminUsers();
  return users.find((item) => item.id === String(userId)) || null;
}

async function reviewDoctorApplication(userId, payload = {}) {
  const applications = await fetchDoctorApplications();
  const current = applications.find((item) => item.id === String(userId));

  if (!current?.doctorProfile) {
    throw new Error("Лекарската кандидатура не е намерена.");
  }

  const verificationStatus = sanitizeText(payload.verificationStatus, 40).toLowerCase();
  const adminNotes = sanitizeText(payload.adminNotes, 500);
  const shouldList =
    payload.isListed === undefined ? current.doctorProfile.isListed : Boolean(payload.isListed);

  const doctorPatch = {
    is_listed: shouldList,
  };
  if (VERIFICATION_STATUSES.has(verificationStatus)) {
    doctorPatch.verification_status = verificationStatus;
  }
  if (payload.adminNotes !== undefined) {
    doctorPatch.admin_notes = adminNotes;
  }

  await patchTableRow("doctor_profiles", { user_id: userId }, doctorPatch);
  await patchTableRow("profiles", { id: userId }, {
    role: "doctor",
    account_type: "doctor",
    verification_status:
      doctorPatch.verification_status || current.verificationStatus || "pending_review",
    account_status:
      doctorPatch.verification_status === "rejected" ? "pending_review" : "active",
    admin_notes: adminNotes || current.adminNotes || "",
  });

  const mergedDoctorProfile = {
    ...current.doctorProfile,
    verificationStatus:
      doctorPatch.verification_status || current.doctorProfile.verificationStatus,
    isListed: shouldList,
    adminNotes: adminNotes || current.doctorProfile.adminNotes,
  };

  if (
    shouldList &&
    (doctorPatch.verification_status === "approved" ||
      mergedDoctorProfile.verificationStatus === "approved")
  ) {
    await upsertTableRow(
      "doctors",
      buildDoctorDirectoryPayload(
        {
          id: current.id,
          firstName: current.firstName,
          lastName: current.lastName,
          email: current.email,
        },
        mergedDoctorProfile
      )
    );
  } else if (!shouldList || doctorPatch.verification_status === "rejected") {
    await deleteTableRow("doctors", { id: userId }).catch(() => null);
  }

  const nextApplications = await fetchDoctorApplications();
  return nextApplications.find((item) => item.id === String(userId)) || null;
}

async function updateAppointmentStatus(appointmentId, status) {
  const normalizedStatus = sanitizeText(status, 40).toLowerCase();
  if (!APPOINTMENT_STATUSES.has(normalizedStatus)) {
    throw new Error("Невалиден статус за записване.");
  }

  return patchTableRow("appointments", { id: appointmentId }, { status: normalizedStatus });
}

module.exports = {
  fetchAdminUsers,
  fetchDoctorApplications,
  updateAdminUser,
  reviewDoctorApplication,
  updateAppointmentStatus,
};
