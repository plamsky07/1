const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const { buildAdminOverview } = require("./analytics");
const {
  assertThreadAccess,
  buildChatBootstrap,
  buildThreadSummaryById,
  createChatMessage,
  createChatThread,
  getThreadAudience,
  updateChatThread,
} = require("./chatStore");
const {
  ALLOWED_ORIGINS,
  CLIENT_URL,
  PLAN_CATALOG,
  PORT,
  STRIPE_WEBHOOK_SECRET,
  stripe,
  sanitizeText,
} = require("./config");
const { fetchSupabaseUser, normalizeAuthUser, requireAdmin, requireUser } = require("./auth");
const {
  fetchSubscriptionByUserId,
  handleCheckoutCompleted,
  handleSubscriptionEvent,
  upsertSubscriptionByUserId,
} = require("./subscriptions");
const { hasSupabaseAdminConfig } = require("./supabase");

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  })
);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send("Stripe webhook is not configured");
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).send("Missing stripe-signature header");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
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
  }
);

app.use(express.json());

app.get("/health", (req, res) =>
  res.json({
    ok: true,
    stripeConfigured: Boolean(stripe),
    socketReady: true,
    supabaseConfigured: hasSupabaseAdminConfig(),
  })
);

app.get("/api/chat/bootstrap", requireUser, async (req, res) => {
  res.json(await buildChatBootstrap(req.currentUser));
});

app.post("/api/chat/threads", requireUser, async (req, res) => {
  try {
    const { subject, category, priority, initialMessage } = req.body || {};
    const thread = await createChatThread(req.currentUser, { subject, category, priority });

    let message = null;
    if (sanitizeText(initialMessage, 2000)) {
      const result = await createChatMessage(req.currentUser, {
        threadId: thread.id,
        body: initialMessage,
      });
      message = result.message;
    }

    const threadSummary = await buildThreadSummaryById(thread.id);
    await broadcastThreadUpdate(thread.id, threadSummary);
    if (message) {
      await broadcastMessage(thread.id, message);
    }

    res.status(201).json({ thread: threadSummary, message });
  } catch (error) {
    res.status(400).json({ error: error?.message || "Неуспешно създаване на разговор." });
  }
});

app.patch("/api/chat/threads/:threadId", requireAdmin, async (req, res) => {
  try {
    const thread = await updateChatThread(req.params.threadId, req.body || {}, req.currentUser);
    const summary = await buildThreadSummaryById(thread.id);
    await broadcastThreadUpdate(thread.id, summary);
    res.json({ thread: summary });
  } catch (error) {
    res.status(400).json({ error: error?.message || "Неуспешно обновяване на разговора." });
  }
});

app.get("/api/subscriptions/me", requireUser, async (req, res) => {
  res.json({
    subscription: await fetchSubscriptionByUserId(req.currentUser.id),
  });
});

app.post("/api/stripe/create-checkout-session", requireUser, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe не е конфигуриран на сървъра." });
    }

    const { planId, email, fullName } = req.body || {};
    if (!planId || !PLAN_CATALOG[planId]) {
      return res.status(400).json({ error: "Invalid or missing planId" });
    }

    const plan = PLAN_CATALOG[planId];
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: plan.currency,
            product_data: { name: plan.name },
            recurring: {
              interval: plan.interval,
              interval_count: plan.interval_count,
            },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${CLIENT_URL}/checkout?status=success&session_id={CHECKOUT_SESSION_ID}&plan=${planId}`,
      cancel_url: `${CLIENT_URL}/checkout?status=canceled&plan=${planId}`,
      customer_email: sanitizeText(email, 160) || req.currentUser.email || undefined,
      customer_creation: "always",
      client_reference_id: String(req.currentUser.id),
      metadata: {
        user_id: String(req.currentUser.id),
        plan_id: planId,
        full_name: sanitizeText(fullName, 160) || req.currentUser.fullName || "",
      },
      subscription_data: {
        metadata: {
          user_id: String(req.currentUser.id),
          plan_id: planId,
        },
      },
    });

    await upsertSubscriptionByUserId(String(req.currentUser.id), {
      plan: planId,
      status: "pending",
      stripe_customer_id: null,
      stripe_subscription_id: session.subscription || null,
      current_period_end: null,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe create-checkout-session error:", error?.message || error);
    res.status(500).json({ error: "Stripe session creation failed" });
  }
});

app.post("/api/stripe/create-portal-session", requireUser, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe не е конфигуриран на сървъра." });
    }

    const subscription = await fetchSubscriptionByUserId(req.currentUser.id);
    const customerId = subscription?.stripeCustomerId;

    if (!customerId) {
      return res.status(400).json({
        error: "Няма открит Stripe customer за този профил. Завърши поне едно плащане през Checkout.",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${CLIENT_URL}/profile`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe billing portal error:", error?.message || error);
    res.status(500).json({ error: "Неуспешно създаване на billing portal сесия." });
  }
});

app.get("/api/admin/overview", requireAdmin, async (req, res) => {
  try {
    res.json(await buildAdminOverview());
  } catch (error) {
    console.error("Admin overview error:", error?.message || error);
    res.status(500).json({ error: "Неуспешно зареждане на admin статистиките." });
  }
});

io.use(async (socket, next) => {
  try {
    const accessToken = socket.handshake.auth?.accessToken;
    if (!accessToken) {
      throw new Error("Липсва access token.");
    }

    const user = await fetchSupabaseUser(accessToken);
    socket.currentUser = normalizeAuthUser(user);
    next();
  } catch (error) {
    next(new Error(error?.message || "Socket authentication failed"));
  }
});

io.on("connection", (socket) => {
  const currentUser = socket.currentUser;
  socket.join(`user:${currentUser.id}`);
  if (currentUser.isAdmin) {
    socket.join("admins");
  }

  socket.on("chat:join-thread", async (payload = {}, ack) => {
    const safeAck = typeof ack === "function" ? ack : () => {};

    try {
      const threadId = String(payload.threadId || "");
      await assertThreadAccess(currentUser, threadId);
      socket.join(`thread:${threadId}`);
      safeAck({ ok: true, threadId });
    } catch (error) {
      safeAck({ ok: false, error: error?.message || "Неуспешно присъединяване към разговора." });
    }
  });

  socket.on("chat:send-message", async (payload = {}, ack) => {
    const safeAck = typeof ack === "function" ? ack : () => {};

    try {
      const result = await createChatMessage(currentUser, payload);
      const threadSummary = await buildThreadSummaryById(result.thread.id);
      socket.join(`thread:${result.thread.id}`);

      await broadcastThreadUpdate(result.thread.id, threadSummary);
      await broadcastMessage(result.thread.id, result.message);

      safeAck({ ok: true, thread: threadSummary, message: result.message });
    } catch (error) {
      safeAck({ ok: false, error: error?.message || "Неуспешно изпращане на съобщение." });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`MedLink server running on http://localhost:${PORT}`);
});

async function broadcastThreadUpdate(threadId, threadSummary) {
  const rooms = await getThreadAudience(threadId);
  rooms.forEach((room) => {
    io.to(room).emit("chat:thread:updated", { thread: threadSummary });
  });
}

async function broadcastMessage(threadId, message) {
  const rooms = await getThreadAudience(threadId);
  rooms.forEach((room) => {
    io.to(room).emit("chat:message:new", { threadId, message });
  });
}
