/* eslint-disable no-undef */
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const Stripe = require("stripe");

dotenv.config();

const app = express();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

if (!stripeSecretKey) {
  console.warn("Missing STRIPE_SECRET_KEY in server/.env");
}

const stripe = new Stripe(stripeSecretKey || "");

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

function hasSupabaseAdminConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseAdminHeaders() {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function upsertSubscriptionByUserId(userId, patch) {
  if (!hasSupabaseAdminConfig() || !userId) return;

  const baseUrl = `${process.env.SUPABASE_URL}/rest/v1/subscriptions`;
  const query = `user_id=eq.${encodeURIComponent(userId)}`;

  const patchResponse = await fetch(`${baseUrl}?${query}`, {
    method: "PATCH",
    headers: {
      ...getSupabaseAdminHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  let patchData = [];
  try {
    patchData = await patchResponse.json();
  } catch {
    patchData = [];
  }

  if (!patchResponse.ok) {
    console.error("Supabase PATCH subscriptions failed:", patchData);
    return;
  }

  if (Array.isArray(patchData) && patchData.length > 0) {
    return;
  }

  const insertResponse = await fetch(baseUrl, {
    method: "POST",
    headers: {
      ...getSupabaseAdminHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      ...patch,
    }),
  });

  if (!insertResponse.ok) {
    let insertData = null;
    try {
      insertData = await insertResponse.json();
    } catch {
      insertData = null;
    }
    console.error("Supabase INSERT subscriptions failed:", insertData);
  }
}

async function updateSubscriptionByStripeId(stripeSubscriptionId, patch) {
  if (!hasSupabaseAdminConfig() || !stripeSubscriptionId) return false;

  const baseUrl = `${process.env.SUPABASE_URL}/rest/v1/subscriptions`;
  const query = `stripe_subscription_id=eq.${encodeURIComponent(stripeSubscriptionId)}`;

  const response = await fetch(`${baseUrl}?${query}`, {
    method: "PATCH",
    headers: {
      ...getSupabaseAdminHeaders(),
      Prefer: "return=representation",
    },
    body: JSON.stringify(patch),
  });

  let data = [];
  try {
    data = await response.json();
  } catch {
    data = [];
  }

  if (!response.ok) {
    console.error("Supabase PATCH by stripe_subscription_id failed:", data);
    return false;
  }

  return Array.isArray(data) && data.length > 0;
}

function unixToIso(ts) {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

async function handleCheckoutCompleted(session) {
  const userId = session?.metadata?.user_id || session?.client_reference_id || null;
  const planId = session?.metadata?.plan_id || null;
  const stripeCustomerId = session?.customer || null;
  const stripeSubscriptionId = session?.subscription || null;

  let status = "active";
  let currentPeriodEnd = null;

  if (stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      status = subscription?.status || status;
      currentPeriodEnd = unixToIso(subscription?.current_period_end);
    } catch (error) {
      console.error("Stripe subscription retrieve failed:", error?.message || error);
    }
  }

  await upsertSubscriptionByUserId(userId, {
    plan: planId,
    status,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    current_period_end: currentPeriodEnd,
  });
}

async function handleSubscriptionEvent(subscription, deleted = false) {
  if (!subscription?.id) return;

  const patch = {
    status: deleted ? "canceled" : subscription.status || "active",
    stripe_customer_id: subscription.customer || null,
    current_period_end: unixToIso(subscription.current_period_end),
  };

  const updatedByStripeId = await updateSubscriptionByStripeId(subscription.id, patch);
  if (updatedByStripeId) return;

  const userId = subscription?.metadata?.user_id || null;
  const planId = subscription?.metadata?.plan_id || null;

  if (!userId) return;

  await upsertSubscriptionByUserId(userId, {
    ...patch,
    plan: planId,
    stripe_subscription_id: subscription.id,
  });
}

app.use(cors({ origin: clientUrl }));

// Stripe webhook must use raw body before express.json middleware.
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripeWebhookSecret) {
    return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing stripe-signature header");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (error) {
    console.error("Webhook signature verification failed:", error?.message || error);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionEvent(event.data.object, false);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionEvent(event.data.object, true);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("Webhook handler failed:", error?.message || error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  return res.json({ received: true });
});

app.use(express.json());

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { planId, userId, email, fullName } = req.body || {};

    if (!planId || !PLAN_CATALOG[planId]) {
      return res.status(400).json({ error: "Invalid or missing planId" });
    }
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    const plan = PLAN_CATALOG[planId];

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: {
              name: plan.name,
            },
            recurring: {
              interval: plan.interval,
              interval_count: plan.interval_count,
            },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${clientUrl}/checkout?status=success&session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
      cancel_url: `${clientUrl}/checkout?status=canceled&plan=${planId}`,
      customer_email: email || undefined,
      customer_creation: "always",
      client_reference_id: String(userId),
      metadata: {
        user_id: String(userId),
        plan_id: planId,
        full_name: fullName || "",
      },
      subscription_data: {
        metadata: {
          user_id: String(userId),
          plan_id: planId,
        },
      },
    });

    await upsertSubscriptionByUserId(String(userId), {
      plan: planId,
      status: "pending",
      stripe_customer_id: null,
      stripe_subscription_id: session.subscription || null,
      current_period_end: null,
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe create-checkout-session error:", error?.message || error);
    return res.status(500).json({ error: "Stripe session creation failed" });
  }
});

const PORT = Number(process.env.PORT || 4242);
app.listen(PORT, () => {
  console.log(`Stripe server running on http://localhost:${PORT}`);
});
