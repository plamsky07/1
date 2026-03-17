const {
  CHAT_CATEGORY,
  CHAT_PRIORITY,
  CHAT_STATUS,
  randomId,
  safeJsonParse,
  sanitizeText,
} = require("./config");
const { hasSupabaseAdminConfig, isMissingRelationError, safeFetchRows, supabaseRequest } = require("./supabase");

const memoryStore = {
  threads: [],
  participants: [],
  messages: [],
};

function normalizeChatThread(row) {
  return {
    id: String(row.id || ""),
    subject: sanitizeText(row.subject, 120) || "Нова консултация",
    status: CHAT_STATUS.has(String(row.status || "").toLowerCase())
      ? String(row.status).toLowerCase()
      : "open",
    priority: CHAT_PRIORITY.has(String(row.priority || "").toLowerCase())
      ? String(row.priority).toLowerCase()
      : "normal",
    category: CHAT_CATEGORY.has(String(row.category || "").toLowerCase())
      ? String(row.category).toLowerCase()
      : "support",
    createdBy: String(row.created_by || row.createdBy || ""),
    assignedAdminId: row.assigned_admin_id || row.assignedAdminId || null,
    metadata: safeJsonParse(row.metadata, {}),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt:
      row.updated_at || row.updatedAt || row.created_at || row.createdAt || new Date().toISOString(),
    lastMessageAt:
      row.last_message_at ||
      row.lastMessageAt ||
      row.updated_at ||
      row.updatedAt ||
      row.created_at ||
      row.createdAt ||
      new Date().toISOString(),
  };
}

function normalizeChatParticipant(row) {
  return {
    threadId: String(row.thread_id || row.threadId || ""),
    userId: String(row.user_id || row.userId || ""),
    role: String(row.role || "patient"),
    joinedAt: row.joined_at || row.joinedAt || new Date().toISOString(),
  };
}

function normalizeChatMessage(row) {
  return {
    id: String(row.id || ""),
    threadId: String(row.thread_id || row.threadId || ""),
    senderId: String(row.sender_id || row.senderId || ""),
    senderName: sanitizeText(row.sender_name || row.senderName, 160) || "MedLink",
    senderRole: String(row.sender_role || row.senderRole || "patient"),
    body: sanitizeText(row.body, 2000),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    metadata: safeJsonParse(row.metadata, {}),
  };
}

async function fetchAllChatThreads() {
  if (!hasSupabaseAdminConfig()) {
    return [...memoryStore.threads].sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );
  }

  const rows = (await safeFetchRows("chat_threads", { order: "last_message_at.desc" })).map(
    normalizeChatThread
  );
  return [...rows, ...memoryStore.threads].sort(
    (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
  );
}

async function fetchAllChatParticipants() {
  if (!hasSupabaseAdminConfig()) {
    return [...memoryStore.participants];
  }

  return [
    ...(await safeFetchRows("chat_participants", { order: "joined_at.asc" })).map(
      normalizeChatParticipant
    ),
    ...memoryStore.participants,
  ];
}

async function fetchMessagesByThreadIds(threadIds) {
  if (!Array.isArray(threadIds) || threadIds.length === 0) {
    return [];
  }

  if (!hasSupabaseAdminConfig()) {
    return memoryStore.messages
      .filter((item) => threadIds.includes(item.threadId))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("thread_id", `in.(${threadIds.join(",")})`);
  params.set("order", "created_at.asc");

  const result = await supabaseRequest(`/rest/v1/chat_messages?${params.toString()}`, {
    serviceRole: true,
  });

  if (!result.ok) {
    if (isMissingRelationError(result.data)) {
      return [...memoryStore.messages]
        .filter((item) => threadIds.includes(item.threadId))
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    console.error("Supabase fetch chat_messages failed:", result.data);
    return [...memoryStore.messages]
      .filter((item) => threadIds.includes(item.threadId))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }

  return [
    ...(Array.isArray(result.data) ? result.data : []).map(normalizeChatMessage),
    ...memoryStore.messages.filter((item) => threadIds.includes(item.threadId)),
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

function buildThreadSummary(thread, messages = []) {
  const lastMessage = messages[messages.length - 1] || null;

  return {
    ...thread,
    messageCount: messages.length,
    lastMessagePreview: sanitizeText(lastMessage?.body || "", 120),
    lastMessageSenderName: lastMessage?.senderName || "",
  };
}

async function buildThreadSummaryById(threadId) {
  const threads = await fetchAllChatThreads();
  const thread = threads.find((item) => item.id === String(threadId));
  if (!thread) {
    throw new Error("Разговорът не е намерен.");
  }

  const messages = await fetchMessagesByThreadIds([threadId]);
  return buildThreadSummary(thread, messages);
}

function getAccessibleThreadIds(user, threads, participants) {
  if (user.isAdmin) {
    return threads.map((thread) => thread.id);
  }

  const allowed = new Set(
    participants
      .filter((participant) => participant.userId === user.id)
      .map((participant) => participant.threadId)
  );

  return threads.filter((thread) => allowed.has(thread.id)).map((thread) => thread.id);
}

async function assertThreadAccess(user, threadId) {
  const threads = await fetchAllChatThreads();
  const participants = await fetchAllChatParticipants();
  const normalizedThreadId = String(threadId || "");
  const thread = threads.find((item) => item.id === normalizedThreadId);

  if (!thread) {
    throw new Error("Разговорът не е намерен.");
  }

  if (user.isAdmin) {
    return thread;
  }

  const hasAccess = participants.some(
    (participant) =>
      participant.threadId === normalizedThreadId && participant.userId === user.id
  );

  if (!hasAccess) {
    throw new Error("Нямаш достъп до този разговор.");
  }

  return thread;
}

async function ensureParticipant(threadId, userId, role) {
  if (!threadId || !userId) return;

  if (!hasSupabaseAdminConfig()) {
    const exists = memoryStore.participants.some(
      (participant) =>
        participant.threadId === String(threadId) && participant.userId === String(userId)
    );

    if (!exists) {
      memoryStore.participants.push(
        normalizeChatParticipant({
          thread_id: threadId,
          user_id: userId,
          role,
          joined_at: new Date().toISOString(),
        })
      );
    }
    return;
  }

  const result = await supabaseRequest("/rest/v1/chat_participants", {
    method: "POST",
    serviceRole: true,
    headers: {
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: {
      thread_id: threadId,
      user_id: userId,
      role,
    },
  });

  if (!result.ok && !isMissingRelationError(result.data)) {
    console.error("Supabase upsert chat_participants failed:", result.data);
  }
}

async function createChatThread(user, payload = {}) {
  const now = new Date().toISOString();
  const subject = sanitizeText(payload.subject, 120) || "Нова медицинска консултация";
  const category = CHAT_CATEGORY.has(String(payload.category || "").toLowerCase())
    ? String(payload.category).toLowerCase()
    : "support";
  const priority = CHAT_PRIORITY.has(String(payload.priority || "").toLowerCase())
    ? String(payload.priority).toLowerCase()
    : "normal";

  const threadPayload = {
    subject,
    status: "open",
    priority,
    category,
    created_by: user.id,
    assigned_admin_id: user.isAdmin ? user.id : null,
    metadata: {
      created_by_name: user.fullName,
      created_by_email: user.email,
      source: "web",
    },
    created_at: now,
    updated_at: now,
    last_message_at: now,
  };

  if (!hasSupabaseAdminConfig()) {
    const thread = normalizeChatThread({ id: randomId(), ...threadPayload });
    memoryStore.threads.unshift(thread);
    await ensureParticipant(thread.id, user.id, user.isAdmin ? "admin" : "patient");
    return thread;
  }

  const result = await supabaseRequest("/rest/v1/chat_threads", {
    method: "POST",
    serviceRole: true,
    headers: {
      Prefer: "return=representation",
    },
    body: threadPayload,
  });

  if (!result.ok) {
    if (!isMissingRelationError(result.data)) {
      console.error("Supabase chat thread insert failed:", result.data);
    }
    const thread = normalizeChatThread({ id: randomId(), ...threadPayload });
    memoryStore.threads.unshift(thread);
    await ensureParticipant(thread.id, user.id, user.isAdmin ? "admin" : "patient");
    return thread;
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  const thread = normalizeChatThread(row);
  await ensureParticipant(thread.id, user.id, user.isAdmin ? "admin" : "patient");
  return thread;
}

async function updateChatThread(threadId, patch = {}, actor) {
  const currentThread = await assertThreadAccess(actor, threadId);
  const nextStatus = CHAT_STATUS.has(String(patch.status || "").toLowerCase())
    ? String(patch.status).toLowerCase()
    : currentThread.status;
  const nextPriority = CHAT_PRIORITY.has(String(patch.priority || "").toLowerCase())
    ? String(patch.priority).toLowerCase()
    : currentThread.priority;

  if (!hasSupabaseAdminConfig()) {
    const index = memoryStore.threads.findIndex((item) => item.id === currentThread.id);
    memoryStore.threads[index] = {
      ...memoryStore.threads[index],
      status: nextStatus,
      priority: nextPriority,
      assignedAdminId: patch.assignedAdminId || actor.id,
      updatedAt: new Date().toISOString(),
    };
    return memoryStore.threads[index];
  }

  const result = await supabaseRequest(
    `/rest/v1/chat_threads?id=eq.${encodeURIComponent(currentThread.id)}`,
    {
      method: "PATCH",
      serviceRole: true,
      headers: {
        Prefer: "return=representation",
      },
      body: {
        status: nextStatus,
        priority: nextPriority,
        assigned_admin_id: patch.assignedAdminId || actor.id,
        updated_at: new Date().toISOString(),
      },
    }
  );

  if (!result.ok) {
    if (isMissingRelationError(result.data)) {
      const index = memoryStore.threads.findIndex((item) => item.id === currentThread.id);
      if (index === -1) {
        memoryStore.threads.unshift(currentThread);
      }
      const targetIndex = memoryStore.threads.findIndex((item) => item.id === currentThread.id);
      memoryStore.threads[targetIndex] = {
        ...memoryStore.threads[targetIndex],
        status: nextStatus,
        priority: nextPriority,
        assignedAdminId: patch.assignedAdminId || actor.id,
        updatedAt: new Date().toISOString(),
      };
      return memoryStore.threads[targetIndex];
    }
    throw new Error("Неуспешно обновяване на разговора.");
  }

  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return normalizeChatThread(row);
}

async function createChatMessage(user, payload = {}) {
  const threadId = String(payload.threadId || "");
  const body = sanitizeText(payload.body, 2000);

  if (!threadId) {
    throw new Error("Липсва threadId.");
  }
  if (!body) {
    throw new Error("Съобщението е празно.");
  }

  const thread = await assertThreadAccess(user, threadId);
  const now = new Date().toISOString();
  const senderRole = user.isAdmin ? "admin" : "patient";
  const nextStatus = !user.isAdmin && thread.status === "resolved" ? "open" : thread.status;

  await ensureParticipant(threadId, user.id, senderRole);

  if (!hasSupabaseAdminConfig()) {
    const message = normalizeChatMessage({
      id: randomId(),
      thread_id: threadId,
      sender_id: user.id,
      sender_name: user.fullName,
      sender_role: senderRole,
      body,
      created_at: now,
      metadata: {},
    });

    memoryStore.messages.push(message);
    const threadIndex = memoryStore.threads.findIndex((item) => item.id === threadId);
    memoryStore.threads[threadIndex] = {
      ...memoryStore.threads[threadIndex],
      status: nextStatus,
      assignedAdminId:
        user.isAdmin && !memoryStore.threads[threadIndex].assignedAdminId
          ? user.id
          : memoryStore.threads[threadIndex].assignedAdminId,
      updatedAt: now,
      lastMessageAt: now,
    };

    return { thread: memoryStore.threads[threadIndex], message };
  }

  const messageInsert = await supabaseRequest("/rest/v1/chat_messages", {
    method: "POST",
    serviceRole: true,
    headers: {
      Prefer: "return=representation",
    },
    body: {
      thread_id: threadId,
      sender_id: user.id,
      sender_name: user.fullName,
      sender_role: senderRole,
      body,
      metadata: {},
    },
  });

  if (!messageInsert.ok) {
    if (isMissingRelationError(messageInsert.data)) {
      const message = normalizeChatMessage({
        id: randomId(),
        thread_id: threadId,
        sender_id: user.id,
        sender_name: user.fullName,
        sender_role: senderRole,
        body,
        created_at: now,
        metadata: {},
      });

      const existingThreadIndex = memoryStore.threads.findIndex((item) => item.id === threadId);
      if (existingThreadIndex === -1) {
        memoryStore.threads.unshift(thread);
      }

      memoryStore.messages.push(message);
      const threadIndex = memoryStore.threads.findIndex((item) => item.id === threadId);
      memoryStore.threads[threadIndex] = {
        ...memoryStore.threads[threadIndex],
        status: nextStatus,
        assignedAdminId:
          user.isAdmin && !memoryStore.threads[threadIndex].assignedAdminId
            ? user.id
            : memoryStore.threads[threadIndex].assignedAdminId,
        updatedAt: now,
        lastMessageAt: now,
      };

      return {
        thread: memoryStore.threads[threadIndex],
        message,
      };
    }
    throw new Error("Неуспешно изпращане на съобщението.");
  }

  const threadUpdate = await supabaseRequest(
    `/rest/v1/chat_threads?id=eq.${encodeURIComponent(threadId)}`,
    {
      method: "PATCH",
      serviceRole: true,
      headers: {
        Prefer: "return=representation",
      },
      body: {
        status: nextStatus,
        assigned_admin_id:
          user.isAdmin && !thread.assignedAdminId ? user.id : thread.assignedAdminId,
        updated_at: now,
        last_message_at: now,
      },
    }
  );

  const messageRow = Array.isArray(messageInsert.data)
    ? messageInsert.data[0]
    : messageInsert.data;
  const threadRow = Array.isArray(threadUpdate.data) ? threadUpdate.data[0] : threadUpdate.data;

  return {
    thread: normalizeChatThread(threadRow || thread),
    message: normalizeChatMessage(messageRow),
  };
}

async function buildChatBootstrap(user) {
  const threads = await fetchAllChatThreads();
  const participants = await fetchAllChatParticipants();
  const accessibleThreadIds = getAccessibleThreadIds(user, threads, participants);
  const messages = await fetchMessagesByThreadIds(accessibleThreadIds);

  const messagesByThread = messages.reduce((acc, item) => {
    acc[item.threadId] = acc[item.threadId] || [];
    acc[item.threadId].push(item);
    return acc;
  }, {});

  const accessibleThreads = threads
    .filter((thread) => accessibleThreadIds.includes(thread.id))
    .map((thread) => buildThreadSummary(thread, messagesByThread[thread.id] || []))
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

  return {
    threads: accessibleThreads,
    messagesByThread,
    summary: {
      totalThreads: accessibleThreads.length,
      openThreads: accessibleThreads.filter((thread) => thread.status !== "resolved").length,
      resolvedThreads: accessibleThreads.filter((thread) => thread.status === "resolved").length,
      totalMessages: messages.length,
    },
  };
}

async function getThreadAudience(threadId) {
  const participants = await fetchAllChatParticipants();
  const participantRooms = participants
    .filter((participant) => participant.threadId === String(threadId))
    .map((participant) => `user:${participant.userId}`);

  return Array.from(new Set(["admins", `thread:${threadId}`, ...participantRooms]));
}

module.exports = {
  assertThreadAccess,
  buildChatBootstrap,
  buildThreadSummary,
  buildThreadSummaryById,
  createChatMessage,
  createChatThread,
  fetchAllChatParticipants,
  fetchAllChatThreads,
  fetchMessagesByThreadIds,
  getThreadAudience,
  updateChatThread,
};
