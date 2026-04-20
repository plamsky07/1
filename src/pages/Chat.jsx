import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  connectChatSocket,
  createChatThread,
  fetchChatBootstrap,
  updateChatThread,
} from "../services/chatService";
import { useToast } from "../context/ToastState";
import { isAdminUser } from "../utils/userRole";
import "../styles/Chat.css";

const THREAD_CATEGORIES = [
  { value: "appointments", label: "Записвания" },
  { value: "billing", label: "Плащания" },
  { value: "support", label: "Поддръжка" },
  { value: "technical", label: "Технически" },
];

const THREAD_STATUSES = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
];

const THREAD_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function mergeThreads(items, incomingThread) {
  const next = [...items];
  const index = next.findIndex((item) => item.id === incomingThread.id);

  if (index >= 0) {
    next[index] = { ...next[index], ...incomingThread };
  } else {
    next.unshift(incomingThread);
  }

  return next.sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

function appendMessage(messagesByThread, threadId, message) {
  const current = messagesByThread[threadId] || [];
  if (current.some((item) => item.id === message.id)) {
    return messagesByThread;
  }

  return {
    ...messagesByThread,
    [threadId]: [...current, message].sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    ),
  };
}

function emitWithAck(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(eventName, payload, (response) => {
      if (!response?.ok) {
        reject(new Error(response?.error || "Socket request failed."));
        return;
      }

      resolve(response);
    });
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(value) {
  return THREAD_STATUSES.find((item) => item.value === value)?.label || value;
}

function priorityLabel(value) {
  return THREAD_PRIORITIES.find((item) => item.value === value)?.label || value;
}

function categoryLabel(value) {
  return THREAD_CATEGORIES.find((item) => item.value === value)?.label || value;
}

export default function Chat({ authUser }) {
  const canModerate = isAdminUser(authUser);
  const [threads, setThreads] = useState([]);
  const [messagesByThread, setMessagesByThread] = useState({});
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingThread, setUpdatingThread] = useState(false);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState("");
  const [threadDraft, setThreadDraft] = useState({
    subject: "",
    category: "support",
    priority: "normal",
    initialMessage: "",
  });
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const { showError, showSuccess } = useToast();

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [selectedThreadId, threads]
  );
  const activeMessages = useMemo(
    () => messagesByThread[selectedThreadId] || [],
    [messagesByThread, selectedThreadId]
  );
  const summary = useMemo(() => {
    const totalMessages = Object.values(messagesByThread).reduce(
      (sum, items) => sum + items.length,
      0
    );

    return {
      totalThreads: threads.length,
      openThreads: threads.filter((thread) => thread.status !== "resolved").length,
      totalMessages,
    };
  }, [messagesByThread, threads]);

  useEffect(() => {
    if (!authUser?.id) return undefined;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchChatBootstrap();
        if (cancelled) return;

        setThreads(data?.threads || []);
        setMessagesByThread(data?.messagesByThread || {});
        setSelectedThreadId((prev) => {
          if (prev && (data?.threads || []).some((thread) => thread.id === prev)) {
            return prev;
          }
          return data?.threads?.[0]?.id || "";
        });
      } catch (err) {
        if (!cancelled) {
          const text = err?.message || "Неуспешно зареждане на chat системата.";
          setError(text);
          showError(text);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, showError]);

  useEffect(() => {
    if (!authUser?.id) return undefined;

    const socket = connectChatSocket();
    socketRef.current = socket;
    socket.connect();

    socket.on("chat:thread:updated", ({ thread }) => {
      if (!thread) return;
      setThreads((prev) => mergeThreads(prev, thread));
    });

    socket.on("chat:message:new", ({ threadId, message }) => {
      if (!threadId || !message) return;
      setMessagesByThread((prev) => appendMessage(prev, threadId, message));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!selectedThreadId || !socketRef.current?.connected) return;

    socketRef.current.emit("chat:join-thread", {
      threadId: selectedThreadId,
    });
  }, [selectedThreadId, threads.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, selectedThreadId]);

  if (!authUser) {
    return (
      <section className="chat-page">
        <div className="container">
          <div className="chat-guest-card">
            <h1>Secure MedLink Chat</h1>
            <p>
              Влез в профила си, за да отвориш реален чат с admin/support екипа
              чрез Socket.IO.
            </p>
            <Link className="chat-primary-btn" to="/auth">
              Вход / Регистрация
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const handleCreateThread = async (event) => {
    event.preventDefault();
    setError("");
    setCreating(true);

    try {
      const response = await createChatThread(threadDraft);
      if (response?.thread) {
        setThreads((prev) => mergeThreads(prev, response.thread));
        if (response.message) {
          setMessagesByThread((prev) =>
            appendMessage(prev, response.thread.id, response.message)
          );
        }
        setSelectedThreadId(response.thread.id);
      }

      setThreadDraft({
        subject: "",
        category: "support",
        priority: "normal",
        initialMessage: "",
      });
      showSuccess("Новата тема беше отворена успешно.", { title: "Chat Desk" });
    } catch (err) {
      const text = err?.message || "Неуспешно създаване на нова тема.";
      setError(text);
      showError(text);
    } finally {
      setCreating(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedThreadId || !composer.trim()) return;
    setError("");
    setSending(true);

    try {
      const socket = socketRef.current;
      if (!socket) {
        throw new Error("Socket връзката не е активна.");
      }

      if (!socket.connected) {
        socket.connect();
      }

      const response = await emitWithAck(socket, "chat:send-message", {
        threadId: selectedThreadId,
        body: composer.trim(),
      });

      setThreads((prev) => mergeThreads(prev, response.thread));
      setMessagesByThread((prev) =>
        appendMessage(prev, selectedThreadId, response.message)
      );
      setComposer("");
    } catch (err) {
      const text = err?.message || "Неуспешно изпращане на съобщение.";
      setError(text);
      showError(text);
    } finally {
      setSending(false);
    }
  };

  const handleThreadMetaUpdate = async (patch) => {
    if (!selectedThreadId) return;
    setUpdatingThread(true);
    setError("");

    try {
      const response = await updateChatThread(selectedThreadId, patch);
      if (response?.thread) {
        setThreads((prev) => mergeThreads(prev, response.thread));
      }
      showSuccess("Разговорът беше обновен.", { title: "Chat Desk" });
    } catch (err) {
      const text = err?.message || "Неуспешно обновяване на thread-а.";
      setError(text);
      showError(text);
    } finally {
      setUpdatingThread(false);
    }
  };

  return (
    <section className="chat-page">
      <div className="container">
        <div className="chat-hero">
          <div>
            <span className="chat-hero__eyebrow">Realtime Care Desk</span>
            <h1>Socket.IO чат за пациенти и admin екип</h1>
            <p>
              Всички разговори се синхронизират в реално време, а admin профилите
              могат да управляват статус, приоритет и оперативен флоу.
            </p>
          </div>

          <div className="chat-hero__stats">
            <article>
              <strong>{summary.totalThreads}</strong>
              <span>Теми</span>
            </article>
            <article>
              <strong>{summary.openThreads}</strong>
              <span>Активни</span>
            </article>
            <article>
              <strong>{summary.totalMessages}</strong>
              <span>Съобщения</span>
            </article>
          </div>
        </div>

        {error && <div className="chat-banner chat-banner--error">{error}</div>}

        <div className="chat-layout">
          <aside className="chat-sidebar">
            <form className="chat-create-card" onSubmit={handleCreateThread}>
              <div className="chat-create-card__head">
                <h2>Нова тема</h2>
                <span>{creating ? "Създаване..." : "Live"}</span>
              </div>

              <label>
                Заглавие
                <input
                  value={threadDraft.subject}
                  onChange={(event) =>
                    setThreadDraft((prev) => ({
                      ...prev,
                      subject: event.target.value,
                    }))
                  }
                  placeholder="Напр. Промяна на час или въпрос за плащане"
                />
              </label>

              <label>
                Категория
                <select
                  value={threadDraft.category}
                  onChange={(event) =>
                    setThreadDraft((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                >
                  {THREAD_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              {canModerate && (
                <label>
                  Приоритет
                  <select
                    value={threadDraft.priority}
                    onChange={(event) =>
                      setThreadDraft((prev) => ({
                        ...prev,
                        priority: event.target.value,
                      }))
                    }
                  >
                    {THREAD_PRIORITIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label>
                Начално съобщение
                <textarea
                  rows={4}
                  value={threadDraft.initialMessage}
                  onChange={(event) =>
                    setThreadDraft((prev) => ({
                      ...prev,
                      initialMessage: event.target.value,
                    }))
                  }
                  placeholder="Опиши казуса кратко и ясно..."
                />
              </label>

              <button className="chat-primary-btn" type="submit" disabled={creating}>
                {creating ? "Създаване..." : "Отвори тема"}
              </button>
            </form>

            <div className="chat-thread-list">
              {loading ? (
                <div className="chat-empty">Зареждане на нишките...</div>
              ) : threads.length === 0 ? (
                <div className="chat-empty">Все още няма отворени теми.</div>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    className={`chat-thread-item ${
                      thread.id === selectedThreadId ? "is-active" : ""
                    }`}
                    onClick={() => setSelectedThreadId(thread.id)}
                  >
                    <div className="chat-thread-item__top">
                      <strong>{thread.subject}</strong>
                      <span>{formatDateTime(thread.lastMessageAt)}</span>
                    </div>
                    <div className="chat-thread-item__meta">
                      <span className={`chat-pill is-${thread.status}`}>
                        {statusLabel(thread.status)}
                      </span>
                      <span className={`chat-pill is-priority-${thread.priority}`}>
                        {priorityLabel(thread.priority)}
                      </span>
                    </div>
                    <p>{thread.lastMessagePreview || "Няма съобщения все още."}</p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="chat-panel">
            {activeThread ? (
              <>
                <header className="chat-panel__header">
                  <div>
                    <h2>{activeThread.subject}</h2>
                    <p>
                      Категория: {categoryLabel(activeThread.category)} • Последна
                      активност: {formatDateTime(activeThread.lastMessageAt)}
                    </p>
                  </div>

                  <div className="chat-panel__badges">
                    <span className={`chat-pill is-${activeThread.status}`}>
                      {statusLabel(activeThread.status)}
                    </span>
                    <span className={`chat-pill is-priority-${activeThread.priority}`}>
                      {priorityLabel(activeThread.priority)}
                    </span>
                  </div>
                </header>

                {canModerate && (
                  <div className="chat-admin-toolbar">
                    <label>
                      Status
                      <select
                        value={activeThread.status}
                        disabled={updatingThread}
                        onChange={(event) =>
                          handleThreadMetaUpdate({ status: event.target.value })
                        }
                      >
                        {THREAD_STATUSES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Priority
                      <select
                        value={activeThread.priority}
                        disabled={updatingThread}
                        onChange={(event) =>
                          handleThreadMetaUpdate({ priority: event.target.value })
                        }
                      >
                        {THREAD_PRIORITIES.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}

                <div className="chat-messages">
                  {activeMessages.length === 0 ? (
                    <div className="chat-empty">
                      Още няма съобщения. Изпрати първото и разговорът ще тръгне в реално време.
                    </div>
                  ) : (
                    activeMessages.map((message) => (
                      <article
                        key={message.id}
                        className={`chat-message ${
                          String(message.senderId) === String(authUser.id)
                            ? "is-own"
                            : "is-other"
                        }`}
                      >
                        <div className="chat-message__meta">
                          <strong>{message.senderName}</strong>
                          <span>{formatDateTime(message.createdAt)}</span>
                        </div>
                        <p>{message.body}</p>
                      </article>
                    ))
                  )}
                  <div ref={endRef} />
                </div>

                <div className="chat-composer">
                  <textarea
                    rows={3}
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    placeholder="Напиши съобщение..."
                  />
                  <button
                    type="button"
                    className="chat-primary-btn"
                    onClick={handleSendMessage}
                    disabled={sending || !composer.trim()}
                  >
                    {sending ? "Изпращане..." : "Изпрати"}
                  </button>
                </div>
              </>
            ) : (
              <div className="chat-empty chat-empty--large">
                Избери съществуваща тема или отвори нова отляво.
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
