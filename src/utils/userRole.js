const ADMIN_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

export function getUserDisplayName(user) {
  if (!user) return "";

  const candidate = [
    user.user_metadata?.full_name,
    [user.user_metadata?.first_name, user.user_metadata?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim(),
    user.email,
  ].find(Boolean);

  return candidate || "MedLink User";
}

export function isAdminUser(user) {
  if (!user) return false;

  const roleCandidates = [
    user.user_metadata?.role,
    user.app_metadata?.role,
    user.role,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return roleCandidates.includes("admin") || ADMIN_EMAILS.includes(String(user.email || "").toLowerCase());
}

export function getUserInitials(user) {
  const displayName = getUserDisplayName(user);
  const parts = displayName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "ML";
  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}
