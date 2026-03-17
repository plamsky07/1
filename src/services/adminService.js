import { apiRequest } from "./apiClient";

export function fetchAdminOverview() {
  return apiRequest("/api/admin/overview");
}
