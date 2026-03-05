import { cities as localCities, clinicFilters as localClinicFilters, doctors as localDoctors } from "../data/doctorsData";
import { hasSupabaseConfig, supabaseSelect } from "../lib/supabaseRest";

function normalizeArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function normalizeDoctor(row) {
  return {
    id: String(row.id),
    name: row.name || "",
    specialty: row.specialty || "",
    city: row.city || "",
    clinicId: row.clinic_id || row.clinicId || "",
    clinicName: row.clinic_name || row.clinicName || "",
    online: Boolean(row.online),
    bio: row.bio || "",
    services: normalizeArray(row.services, ["Преглед", "Консултация", "Контролен преглед"]),
    slots: normalizeArray(row.slots, []),
  };
}

export async function fetchDoctors() {
  if (!hasSupabaseConfig) {
    return localDoctors;
  }

  try {
    const rows = await supabaseSelect("doctors", {
      select: "id,name,specialty,city,clinic_id,clinic_name,online,bio,services,slots",
      orderBy: { column: "id", ascending: true },
    });

    return rows.map(normalizeDoctor);
  } catch (error) {
    console.warn("Supabase unavailable, fallback to local doctors data", error);
    return localDoctors;
  }
}

export async function fetchDoctorById(id) {
  const doctors = await fetchDoctors();
  return doctors.find((doctor) => doctor.id === String(id)) || null;
}

export function getClinicFilters(doctors) {
  if (!doctors?.length) {
    return localClinicFilters;
  }

  const generated = doctors.reduce((acc, doctor) => {
    if (!doctor.clinicId) {
      return acc;
    }

    if (!acc[doctor.clinicId]) {
      acc[doctor.clinicId] = {
        name: doctor.clinicName || doctor.clinicId,
        city: doctor.city,
        specialties: [],
      };
    }

    if (doctor.specialty && !acc[doctor.clinicId].specialties.includes(doctor.specialty)) {
      acc[doctor.clinicId].specialties.push(doctor.specialty);
    }

    return acc;
  }, {});

  return Object.keys(generated).length > 0 ? generated : localClinicFilters;
}

export function getCities(doctors) {
  if (!doctors?.length) {
    return localCities;
  }

  const unique = Array.from(new Set(doctors.map((doctor) => doctor.city).filter(Boolean)));
  return unique.length > 0 ? unique.sort((a, b) => a.localeCompare(b, "bg")) : localCities;
}
