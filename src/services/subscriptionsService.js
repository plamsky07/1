import { apiRequest } from "./apiClient";

export function startCheckoutSession(payload) {
  return apiRequest("/api/stripe/create-checkout-session", {
    method: "POST",
    body: payload,
  });
}

export function fetchMySubscription() {
  return apiRequest("/api/subscriptions/me");
}

export function createBillingPortalSession() {
  return apiRequest("/api/stripe/create-portal-session", {
    method: "POST",
  });
}
