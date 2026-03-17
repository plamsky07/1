const {
  PLAN_CATALOG,
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  stripe,
  unixToIso,
} = require("./config");
const { hasSupabaseAdminConfig, isMissingRelationError, supabaseRequest } = require("./supabase");

const memorySubscriptions = [];

function normalizeSubscription(row) {
  if (!row) return null;

  return {
    userId: String(row.user_id || row.userId || ""),
    plan: String(row.plan || "free"),
    status: String(row.status || "inactive"),
    stripeCustomerId: row.stripe_customer_id || row.stripeCustomerId || null,
    stripeSubscriptionId:
      row.stripe_subscription_id || row.stripeSubscriptionId || null,
    currentPeriodEnd:
      row.current_period_end || row.currentPeriodEnd || row.updated_at || row.updatedAt || null,
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt:
      row.updated_at || row.updatedAt || row.created_at || row.createdAt || new Date().toISOString(),
  };
}

async function fetchSubscriptionByUserId(userId) {
  if (!userId) return null;

  if (!hasSupabaseAdminConfig()) {
    return (
      memorySubscriptions.find((item) => String(item.userId) === String(userId)) || null
    );
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("user_id", `eq.${userId}`);
  params.set("limit", "1");

  const result = await supabaseRequest(`/rest/v1/subscriptions?${params.toString()}`, {
    serviceRole: true,
  });

  if (!result.ok) {
    if (isMissingRelationError(result.data)) {
      return null;
    }

    console.error("Supabase subscriptions fetch failed:", result.data);
    return null;
  }

  const row = Array.isArray(result.data) ? result.data[0] : null;
  return normalizeSubscription(row);
}

async function upsertSubscriptionByUserId(userId, patch) {
  if (!userId) return;

  const nextRecord = normalizeSubscription({
    user_id: userId,
    ...patch,
    updated_at: new Date().toISOString(),
  });

  if (!hasSupabaseAdminConfig()) {
    const index = memorySubscriptions.findIndex(
      (item) => String(item.userId) === String(userId)
    );

    if (index >= 0) {
      memorySubscriptions[index] = {
        ...memorySubscriptions[index],
        ...nextRecord,
      };
    } else {
      memorySubscriptions.unshift(nextRecord);
    }
    return;
  }

  const baseUrl = `${SUPABASE_URL}/rest/v1/subscriptions`;
  const query = `user_id=eq.${encodeURIComponent(userId)}`;

  const patchResponse = await fetch(`${baseUrl}?${query}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...patch,
      updated_at: new Date().toISOString(),
    }),
  });

  let patchData = [];
  try {
    patchData = await patchResponse.json();
  } catch {
    patchData = [];
  }

  if (!patchResponse.ok) {
    if (!isMissingRelationError(patchData)) {
      console.error("Supabase PATCH subscriptions failed:", patchData);
    }
    return;
  }

  if (Array.isArray(patchData) && patchData.length > 0) {
    return;
  }

  const insertResponse = await fetch(baseUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
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

    if (!isMissingRelationError(insertData)) {
      console.error("Supabase INSERT subscriptions failed:", insertData);
    }
  }
}

async function updateSubscriptionByStripeId(stripeSubscriptionId, patch) {
  if (!stripeSubscriptionId) return false;

  if (!hasSupabaseAdminConfig()) {
    const index = memorySubscriptions.findIndex(
      (item) => String(item.stripeSubscriptionId || "") === String(stripeSubscriptionId)
    );

    if (index === -1) return false;

    memorySubscriptions[index] = {
      ...memorySubscriptions[index],
      ...normalizeSubscription({
        ...memorySubscriptions[index],
        ...patch,
      }),
    };
    return true;
  }

  const result = await supabaseRequest(
    `/rest/v1/subscriptions?stripe_subscription_id=eq.${encodeURIComponent(
      stripeSubscriptionId
    )}`,
    {
      method: "PATCH",
      serviceRole: true,
      headers: {
        Prefer: "return=representation",
      },
      body: {
        ...patch,
        updated_at: new Date().toISOString(),
      },
    }
  );

  if (!result.ok) {
    if (!isMissingRelationError(result.data)) {
      console.error("Supabase PATCH by stripe_subscription_id failed:", result.data);
    }
    return false;
  }

  return Array.isArray(result.data) && result.data.length > 0;
}

async function handleCheckoutCompleted(session) {
  const userId = session?.metadata?.user_id || session?.client_reference_id || null;
  const planId = session?.metadata?.plan_id || null;
  const stripeCustomerId = session?.customer || null;
  const stripeSubscriptionId = session?.subscription || null;

  let status = "active";
  let currentPeriodEnd = null;

  if (stripe && stripeSubscriptionId) {
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

module.exports = {
  PLAN_CATALOG,
  fetchSubscriptionByUserId,
  handleCheckoutCompleted,
  handleSubscriptionEvent,
  normalizeSubscription,
  upsertSubscriptionByUserId,
};
