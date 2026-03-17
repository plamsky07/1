const { ADMIN_EMAILS, sanitizeText } = require("./config");
const { hasSupabaseAuthConfig, supabaseRequest } = require("./supabase");

function extractBearerToken(req) {
  const header = String(req.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

function getUserDisplayName(user) {
  return (
    sanitizeText(user?.user_metadata?.full_name, 160) ||
    sanitizeText(
      [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
        .filter(Boolean)
        .join(" "),
      160
    ) ||
    sanitizeText(user?.email, 160) ||
    "MedLink User"
  );
}

function isAdminUser(user) {
  const roleCandidates = [
    user?.user_metadata?.role,
    user?.app_metadata?.role,
    user?.role,
  ]
    .map((value) => String(value || "").toLowerCase().trim())
    .filter(Boolean);

  return (
    roleCandidates.includes("admin") ||
    ADMIN_EMAILS.has(String(user?.email || "").toLowerCase().trim())
  );
}

function normalizeAuthUser(user) {
  return {
    id: String(user?.id || ""),
    email: String(user?.email || ""),
    fullName: getUserDisplayName(user),
    isAdmin: isAdminUser(user),
    metadata: user?.user_metadata || {},
  };
}

async function fetchSupabaseUser(accessToken) {
  if (!hasSupabaseAuthConfig()) {
    throw new Error("Supabase auth is not configured on the server.");
  }

  const result = await supabaseRequest("/auth/v1/user", {
    accessToken,
  });

  if (!result.ok || !result.data?.id) {
    throw new Error("Невалидна или изтекла сесия.");
  }

  return result.data;
}

async function requireUser(req, res, next) {
  try {
    const accessToken = extractBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: "Липсва access token." });
    }

    const user = await fetchSupabaseUser(accessToken);
    req.currentUser = normalizeAuthUser(user);
    req.accessToken = accessToken;
    next();
  } catch (error) {
    res.status(401).json({ error: error?.message || "Неуспешна автентикация." });
  }
}

async function requireAdmin(req, res, next) {
  await requireUser(req, res, async () => {
    if (!req.currentUser?.isAdmin) {
      res.status(403).json({ error: "Нямаш достъп до admin панела." });
      return;
    }

    next();
  });
}

module.exports = {
  extractBearerToken,
  fetchSupabaseUser,
  getUserDisplayName,
  isAdminUser,
  normalizeAuthUser,
  requireAdmin,
  requireUser,
};
