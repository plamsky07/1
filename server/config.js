const crypto = require("crypto");
const Stripe = require("stripe");

function parseCsv(value = "") {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sanitizeText(value, maxLength = 120) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function safeJsonParse(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function unixToIso(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

const PORT = Number(process.env.PORT || 4242);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const ALLOWED_ORIGINS = parseCsv(process.env.ALLOWED_ORIGINS || CLIENT_URL);
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_PUBLIC_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ADMIN_EMAILS = new Set(
  parseCsv(process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS).map((email) =>
    email.toLowerCase()
  )
);

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

const PLAN_CATALOG = {
  monthly: {
    id: "monthly",
    name: "MedLink Plus Monthly",
    amount: 499,
    currency: "eur",
    interval: "month",
    interval_count: 1,
  },
  basic: {
    id: "basic",
    name: "MedLink Plus Basic",
    amount: 999,
    currency: "eur",
    interval: "month",
    interval_count: 1,
  },
  pro: {
    id: "pro",
    name: "MedLink Plus Pro",
    amount: 1999,
    currency: "eur",
    interval: "month",
    interval_count: 1,
  },
  yearly: {
    id: "yearly",
    name: "MedLink Plus Yearly",
    amount: 14900,
    currency: "eur",
    interval: "year",
    interval_count: 1,
  },
};

const CHAT_STATUS = new Set(["open", "pending", "resolved"]);
const CHAT_PRIORITY = new Set(["low", "normal", "high", "urgent"]);
const CHAT_CATEGORY = new Set(["appointments", "billing", "support", "technical"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);
const BG_MONTHS_SHORT = [
  "ян",
  "фев",
  "мар",
  "апр",
  "май",
  "юни",
  "юли",
  "авг",
  "сеп",
  "окт",
  "ное",
  "дек",
];

function randomId() {
  return crypto.randomUUID();
}

if (!STRIPE_SECRET_KEY) {
  console.warn("Missing STRIPE_SECRET_KEY in server/.env");
}

module.exports = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  ADMIN_EMAILS,
  ALLOWED_ORIGINS,
  BG_MONTHS_SHORT,
  CHAT_CATEGORY,
  CHAT_PRIORITY,
  CHAT_STATUS,
  CLIENT_URL,
  PLAN_CATALOG,
  PORT,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  SUPABASE_PUBLIC_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  parseCsv,
  randomId,
  safeJsonParse,
  sanitizeText,
  stripe,
  unixToIso,
};
