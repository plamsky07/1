import { apiRequest } from "./apiClient";

export function fetchAdminOverview() {
  return apiRequest("/api/admin/overview");
}

export function fetchAdminUsers() {
  return apiRequest("/api/admin/users");
}

export function updateAdminUser(userId, payload) {
  return apiRequest(`/api/admin/users/${userId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function fetchDoctorApplications() {
  return apiRequest("/api/admin/doctors");
}

export function reviewDoctorApplication(userId, payload) {
  return apiRequest(`/api/admin/doctors/${userId}`, {
    method: "PATCH",
    body: payload,
  });
}

export function updateAdminAppointment(appointmentId, payload) {
  return apiRequest(`/api/admin/appointments/${appointmentId}`, {
    method: "PATCH",
    body: payload,
  });
}
