import { API_BASE } from "../lib/api";
import { getAccessToken } from "./authService";

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest(
  path,
  { method = "GET", body, headers = {}, requireAuth = true } = {}
) {
  const accessToken = getAccessToken();
  const requestHeaders = {
    ...headers,
  };

  if (body !== undefined) {
    requestHeaders["Content-Type"] = requestHeaders["Content-Type"] || "application/json";
  }

  if (requireAuth && accessToken) {
    requestHeaders.Authorization = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Няма връзка със сървъра. Провери дали backend-ът е стартиран.");
  }

  const data = await parseResponse(response);
  if (!response.ok) {
    const message =
      data?.error ||
      data?.message ||
      (typeof data === "string" ? data : "") ||
      "Неуспешна заявка към сървъра.";
    throw new Error(message);
  }

  return data;
}
