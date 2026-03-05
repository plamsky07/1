import { hasSupabaseConfig } from "../lib/supabaseRest";
import { getStoredSession } from "./authService";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const LOCAL_APPOINTMENTS_KEY = "medlink.local.appointments";

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

function parseLocalAppointments() {
  const raw = localStorage.getItem(LOCAL_APPOINTMENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalAppointments(items) {
  localStorage.setItem(LOCAL_APPOINTMENTS_KEY, JSON.stringify(items));
}

function normalizeTime(rawValue) {
  const match = String(rawValue || "").match(/(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function parseAppointmentNotes(value) {
  const fallback = {
    service: "",
    userNote: "",
    doctorName: "",
    specialty: "",
    clinicName: "",
    slot: "",
  };

  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object") {
        return {
          service: parsed.service || "",
          userNote: parsed.userNote || "",
          doctorName: parsed.doctorName || "",
          specialty: parsed.specialty || "",
          clinicName: parsed.clinicName || "",
          slot: parsed.slot || "",
        };
      }
    } catch {
      return { ...fallback, userNote: value };
    }
  }

  return fallback;
}

function normalizeAppointment(row) {
  const meta = parseAppointmentNotes(row.notes);
  const legacyDate = row.appointment_date || row.appointmentDate || "";
  const legacyTime = normalizeTime(row.appointment_time || row.appointmentTime || "");
  const appointmentAt =
    row.appointment_at ||
    row.appointmentAt ||
    (legacyDate && legacyTime ? `${legacyDate}T${legacyTime}:00` : "");
  const parsedDate = appointmentAt ? new Date(appointmentAt) : null;
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
  const appointmentDate = validDate ? validDate.toISOString().slice(0, 10) : legacyDate;
  const appointmentTime = meta.slot || (validDate ? validDate.toTimeString().slice(0, 5) : legacyTime);

  return {
    id: String(row.id),
    userId: row.patient_id || row.user_id || row.userId || "",
    doctorId: row.doctor_id ? String(row.doctor_id) : "",
    doctorName: meta.doctorName || row.doctor_name || row.doctorName || "",
    specialty: meta.specialty || row.specialty || "",
    clinicName: meta.clinicName || row.clinic_name || row.clinicName || "",
    appointmentDate,
    appointmentTime,
    service: meta.service || row.service || "",
    notes: meta.userNote || "",
    status: row.status || "pending",
    createdAt: row.created_at || row.createdAt || appointmentAt,
    appointmentAt,
  };
}

function extractApiError(data) {
  return String(data?.message || data?.error_description || data?.hint || data?.details || "");
}

export async function createAppointment(payload) {
  const slotTime = normalizeTime(payload.appointmentTime);
  if (!slotTime) {
    throw new Error("Невалиден час.");
  }

  const appointmentAt = new Date(`${payload.appointmentDate}T${slotTime}:00`);
  if (Number.isNaN(appointmentAt.getTime())) {
    throw new Error("Невалидна дата/час.");
  }

  const notesMetadata = {
    service: payload.service || "",
    userNote: payload.notes || "",
    doctorName: payload.doctorName || "",
    specialty: payload.specialty || "",
    clinicName: payload.clinicName || "",
    slot: slotTime,
  };

  const doctorIdRaw = String(payload.doctorId || "");

  const modernPayload = {
    patient_id: payload.userId,
    doctor_id: isUuid(doctorIdRaw) ? doctorIdRaw : null,
    patient_name: payload.patientName || "",
    patient_phone: payload.patientPhone || "",
    patient_email: payload.patientEmail || "",
    appointment_at: appointmentAt.toISOString(),
    notes: JSON.stringify(notesMetadata),
    status: "pending",
  };

  const legacyPayload = {
    user_id: payload.userId,
    doctor_id: doctorIdRaw,
    doctor_name: payload.doctorName || "",
    specialty: payload.specialty || "",
    clinic_name: payload.clinicName || "",
    appointment_date: payload.appointmentDate,
    appointment_time: slotTime,
    service: payload.service || "",
    notes: JSON.stringify(notesMetadata),
    status: "booked",
  };

  if (!hasSupabaseConfig) {
    const localItems = parseLocalAppointments();
    const newItem = normalizeAppointment({
      ...modernPayload,
      id: `${Date.now()}`,
      created_at: new Date().toISOString(),
    });
    saveLocalAppointments([newItem, ...localItems]);
    return newItem;
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("Трябва да си влязъл в профила си, за да запазиш час.");
  }

  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: {
        ...getHeaders(accessToken),
        Prefer: "return=representation",
      },
      body: JSON.stringify(modernPayload),
    });
  } catch {
    throw new Error("Няма връзка със Supabase. Опитай отново след малко.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  // Fallback for legacy schema that uses user_id + appointment_date/appointment_time.
  if (
    !response.ok &&
    /patient_id|appointment_at|patient_name|patient_phone|patient_email|user_id|doctor_name|clinic_name|specialty|service|appointment_date|appointment_time/i.test(
      extractApiError(data)
    )
  ) {
    try {
      response = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
        method: "POST",
        headers: {
          ...getHeaders(accessToken),
          Prefer: "return=representation",
        },
        body: JSON.stringify(legacyPayload),
      });

      try {
        data = await response.json();
      } catch {
        data = null;
      }
    } catch {
      throw new Error("Няма връзка със Supabase. Опитай отново след малко.");
    }
  }

  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.hint || "Неуспешно записване на час.";
    throw new Error(message);
  }

  return normalizeAppointment(Array.isArray(data) ? data[0] : data);
}

export async function fetchMyAppointments(userId) {
  if (!userId) return [];

  if (!hasSupabaseConfig) {
    return parseLocalAppointments()
      .map(normalizeAppointment)
      .filter((item) => item.userId === userId)
      .sort((a, b) => `${a.appointmentDate} ${a.appointmentTime}`.localeCompare(`${b.appointmentDate} ${b.appointmentTime}`));
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    return [];
  }

  let response;
  let data = null;
  try {
    const params = new URLSearchParams();
    params.set("select", "*");
    params.set("patient_id", `eq.${userId}`);
    params.set("order", "appointment_at.asc");

    response = await fetch(`${SUPABASE_URL}/rest/v1/appointments?${params.toString()}`, {
      headers: getHeaders(accessToken),
    });
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    // Legacy fallback: user_id with appointment_date.
    if (!response.ok && /patient_id|appointment_at/i.test(extractApiError(data))) {
      const legacyParams = new URLSearchParams();
      legacyParams.set("select", "*");
      legacyParams.set("user_id", `eq.${userId}`);
      legacyParams.set("order", "created_at.desc");

      response = await fetch(`${SUPABASE_URL}/rest/v1/appointments?${legacyParams.toString()}`, {
        headers: getHeaders(accessToken),
      });

      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }
  } catch {
    throw new Error("Няма връзка със Supabase. Опитай отново след малко.");
  }

  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.hint || "Неуспешно зареждане на известията.";
    throw new Error(message);
  }

  return (Array.isArray(data) ? data : [])
    .map(normalizeAppointment)
    .sort((a, b) => `${a.appointmentDate} ${a.appointmentTime}`.localeCompare(`${b.appointmentDate} ${b.appointmentTime}`));
}

export async function fetchMyAppointmentsCount(userId) {
  const items = await fetchMyAppointments(userId);
  return items.filter((item) => !["done", "cancelled", "rejected"].includes(item.status)).length;
}

export async function deleteAppointment(appointmentId, userId) {
  if (!appointmentId) {
    throw new Error("Липсва ID на резервацията.");
  }

  if (!hasSupabaseConfig) {
    const localItems = parseLocalAppointments();
    const next = localItems.filter(
      (item) => String(item.id) !== String(appointmentId) || String(item.userId) !== String(userId)
    );
    saveLocalAppointments(next);
    return true;
  }

  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error("Трябва да си влязъл в профила си.");
  }

  let response;
  let data = null;
  try {
    const params = new URLSearchParams();
    params.set("id", `eq.${appointmentId}`);
    params.set("patient_id", `eq.${userId}`);

    response = await fetch(`${SUPABASE_URL}/rest/v1/appointments?${params.toString()}`, {
      method: "DELETE",
      headers: {
        ...getHeaders(accessToken),
        Prefer: "return=representation",
      },
    });
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok && /patient_id/i.test(extractApiError(data))) {
      const legacyParams = new URLSearchParams();
      legacyParams.set("id", `eq.${appointmentId}`);
      legacyParams.set("user_id", `eq.${userId}`);

      response = await fetch(`${SUPABASE_URL}/rest/v1/appointments?${legacyParams.toString()}`, {
        method: "DELETE",
        headers: {
          ...getHeaders(accessToken),
          Prefer: "return=representation",
        },
      });

      try {
        data = await response.json();
      } catch {
        data = null;
      }
    }
  } catch {
    throw new Error("Няма връзка със Supabase. Опитай отново след малко.");
  }

  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.hint || "Неуспешно премахване на часа.";
    throw new Error(message);
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Часът не беше премахнат (провери RLS policy за DELETE в Supabase).");
  }

  return true;
}
