import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MermaidChart from "../components/MermaidChart";
import {
  buildAppointmentStatusChart,
  buildAppointmentsTrendChart,
  buildChatLoadChart,
  buildDoctorVerificationChart,
  buildSubscriptionMixChart,
  buildUserRoleChart,
} from "../lib/adminCharts";
import {
  fetchAdminOverview,
  fetchAdminUsers,
  fetchDoctorApplications,
  reviewDoctorApplication,
  updateAdminAppointment,
  updateAdminUser,
} from "../services/adminService";
import { useToast } from "../context/ToastState";
import { isAdminUser } from "../utils/userRole";
import "../styles/Admin.css";

const ROLE_OPTIONS = ["patient", "doctor", "admin"];
const ACCOUNT_STATUS_OPTIONS = ["active", "pending_review", "blocked"];
const VERIFICATION_OPTIONS = ["active", "pending_review", "approved", "rejected", "suspended"];
const APPOINTMENT_STATUS_OPTIONS = [
  "pending",
  "booked",
  "confirmed",
  "done",
  "cancelled",
  "rejected",
];

function formatTimeStamp(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildUserDraft(user) {
  return {
    role: user.role || "patient",
    accountStatus: user.accountStatus || "active",
    verificationStatus: user.verificationStatus || "active",
    adminNotes: user.adminNotes || "",
  };
}

function buildDoctorDraft(item) {
  return {
    verificationStatus:
      item.doctorProfile?.verificationStatus || item.verificationStatus || "pending_review",
    isListed: Boolean(item.doctorProfile?.isListed || item.isListedDoctor),
    adminNotes: item.doctorProfile?.adminNotes || item.adminNotes || "",
  };
}

export default function AdminDashboard({ authUser }) {
  const canAccess = isAdminUser(authUser);
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [doctorApplications, setDoctorApplications] = useState([]);
  const [userDrafts, setUserDrafts] = useState({});
  const [doctorDrafts, setDoctorDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState("");
  const [savingDoctorId, setSavingDoctorId] = useState("");
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState("");
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    if (!authUser?.id || !canAccess) return undefined;

    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [overviewResult, usersResult, doctorsResult] = await Promise.all([
          fetchAdminOverview(),
          fetchAdminUsers(),
          fetchDoctorApplications(),
        ]);

        if (cancelled) return;

        const nextUsers = usersResult?.users || [];
        const nextDoctorApplications = doctorsResult?.applications || [];

        setOverview(overviewResult);
        setUsers(nextUsers);
        setDoctorApplications(nextDoctorApplications);
        setUserDrafts(
          nextUsers.reduce((acc, user) => {
            acc[user.id] = buildUserDraft(user);
            return acc;
          }, {})
        );
        setDoctorDrafts(
          nextDoctorApplications.reduce((acc, item) => {
            acc[item.id] = buildDoctorDraft(item);
            return acc;
          }, {})
        );
      } catch (err) {
        if (!cancelled) {
          const text = err?.message || "Неуспешно зареждане на admin статистиките.";
          setError(text);
          showError(text);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, canAccess, showError]);

  const charts = useMemo(() => {
    if (!overview) return null;

    return {
      appointments: buildAppointmentsTrendChart(overview.charts?.appointmentsDaily || []),
      subscriptions: buildSubscriptionMixChart(overview.charts?.subscriptionMix || []),
      statuses: buildAppointmentStatusChart(overview.charts?.appointmentStatus || []),
      chat: buildChatLoadChart(overview.charts?.messagesDaily || []),
      users: buildUserRoleChart(overview.charts?.userRoles || []),
      doctorVerification: buildDoctorVerificationChart(
        overview.charts?.doctorVerification || []
      ),
    };
  }, [overview]);

  const statCards = useMemo(() => {
    if (!overview) return [];

    return [
      { label: "Users", value: overview.summary?.totalUsers || 0 },
      { label: "Patients", value: overview.summary?.totalPatients || 0 },
      { label: "Doctors", value: overview.summary?.totalDoctors || 0 },
      {
        label: "Doctor Review",
        value: overview.summary?.pendingDoctorApplications || 0,
      },
      { label: "Appointments", value: overview.summary?.totalAppointments || 0 },
      { label: "Active Subs", value: overview.summary?.activeSubscriptions || 0 },
      { label: "Open Threads", value: overview.summary?.openThreads || 0 },
      {
        label: "Avg Response",
        value: `${overview.summary?.averageFirstResponseMinutes || 0} min`,
      },
    ];
  }, [overview]);

  const handleUserDraftChange = (userId, field, value) => {
    setUserDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [field]: value,
      },
    }));
  };

  const handleDoctorDraftChange = (userId, field, value) => {
    setDoctorDrafts((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || {}),
        [field]: value,
      },
    }));
  };

  const handleUserSave = async (userId) => {
    const draft = userDrafts[userId];
    if (!draft) return;

    setSavingUserId(userId);
    try {
      const result = await updateAdminUser(userId, draft);
      if (result?.user) {
        setUsers((prev) => prev.map((item) => (item.id === userId ? result.user : item)));
        setUserDrafts((prev) => ({
          ...prev,
          [userId]: buildUserDraft(result.user),
        }));
      }
      showSuccess("Потребителят беше обновен.", { title: "Admin Users" });
    } catch (err) {
      showError(err?.message || "Неуспешно обновяване на потребителя.");
    } finally {
      setSavingUserId("");
    }
  };

  const handleDoctorReview = async (userId, extraPatch = {}) => {
    const draft = doctorDrafts[userId];
    if (!draft) return;

    setSavingDoctorId(userId);
    try {
      const result = await reviewDoctorApplication(userId, {
        ...draft,
        ...extraPatch,
      });
      if (result?.application) {
        setDoctorApplications((prev) =>
          prev.map((item) => (item.id === userId ? result.application : item))
        );
        setDoctorDrafts((prev) => ({
          ...prev,
          [userId]: buildDoctorDraft(result.application),
        }));
      }
      showSuccess("Лекарската кандидатура беше обновена.", {
        title: "Doctor Verification",
      });
    } catch (err) {
      showError(err?.message || "Неуспешна обработка на кандидатурата.");
    } finally {
      setSavingDoctorId("");
    }
  };

  const handleAppointmentStatusChange = async (appointmentId, status) => {
    setUpdatingAppointmentId(appointmentId);
    try {
      await updateAdminAppointment(appointmentId, { status });
      setOverview((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          recent: {
            ...prev.recent,
            appointments: (prev.recent?.appointments || []).map((item) =>
              item.id === appointmentId ? { ...item, status } : item
            ),
          },
        };
      });
      showSuccess("Статусът на записването беше обновен.", {
        title: "Appointments",
      });
    } catch (err) {
      showError(err?.message || "Неуспешно обновяване на записването.");
    } finally {
      setUpdatingAppointmentId("");
    }
  };

  if (!authUser) {
    return (
      <section className="admin-page">
        <div className="container">
          <div className="admin-empty-card">
            <h1>Admin Command Center</h1>
            <p>Влез с admin профил, за да отвориш dashboard-а и професионалните Mermaid статистики.</p>
            <Link className="admin-primary-btn" to="/auth">
              Вход
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!canAccess) {
    return (
      <section className="admin-page">
        <div className="container">
          <div className="admin-empty-card">
            <h1>Достъпът е ограничен</h1>
            <p>Този панел е видим само за потребители с admin роля или имейл в `ADMIN_EMAILS`.</p>
            <Link className="admin-primary-btn" to="/profile">
              Към профила
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <div className="container">
        <div className="admin-hero">
          <div>
            <span className="admin-hero__eyebrow">Operations Command Center</span>
            <h1>Пълен admin контрол върху потребители, лекари, записвания и чат</h1>
            <p>
              Dashboard-ът комбинира realtime операции, бизнес KPI, лекарски верификации и
              потребителско управление в един професионален панел.
            </p>
          </div>

          <div className="admin-config-card">
            <div className="admin-config-card__top">
              <strong>System Health</strong>
              <span>{formatTimeStamp(overview?.generatedAt)}</span>
            </div>
            <div className="admin-config-list">
              <div>
                <span>Stripe</span>
                <strong>{overview?.configuration?.stripeConfigured ? "Ready" : "Pending"}</strong>
              </div>
              <div>
                <span>Webhook</span>
                <strong>{overview?.configuration?.webhookConfigured ? "Ready" : "Pending"}</strong>
              </div>
              <div>
                <span>Supabase Admin</span>
                <strong>
                  {overview?.configuration?.supabaseAdminConfigured ? "Ready" : "Pending"}
                </strong>
              </div>
              <div>
                <span>Stripe Mode</span>
                <strong>{overview?.configuration?.stripeMode || "test"}</strong>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="admin-banner admin-banner--error">{error}</div>}
        {loading && <div className="admin-banner">Зареждане на dashboard-а...</div>}

        {!loading && overview && (
          <>
            <div className="admin-stats-grid">
              {statCards.map((card) => (
                <article key={card.label} className="admin-stat-card">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                </article>
              ))}
            </div>

            <div className="admin-chart-grid admin-chart-grid--triple">
              <MermaidChart
                chart={charts.appointments}
                title="Booking Pulse"
                subtitle="Нови записвания за последните 7 дни"
              />
              <MermaidChart
                chart={charts.subscriptions}
                title="Revenue Mix"
                subtitle="Активни Stripe планове"
              />
              <MermaidChart
                chart={charts.chat}
                title="Chat Activity"
                subtitle="Съобщения в realtime desk-а"
              />
              <MermaidChart
                chart={charts.statuses}
                title="Appointment Mix"
                subtitle="Разпределение по статуси"
              />
              <MermaidChart
                chart={charts.users}
                title="Account Mix"
                subtitle="Роли и типове профили"
              />
              <MermaidChart
                chart={charts.doctorVerification}
                title="Doctor Verification"
                subtitle="Статуси на лекарските кандидатури"
              />
            </div>

            <div className="admin-detail-grid">
              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Top Operational Signals</h2>
                </div>
                <div className="admin-tag-list">
                  {(overview.highlights?.topSpecialties || []).map((item) => (
                    <span key={item.label} className="admin-tag">
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
                <div className="admin-tag-list">
                  {(overview.highlights?.topPlans || []).map((item) => (
                    <span key={item.label} className="admin-tag admin-tag--dark">
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
                <div className="admin-tag-list">
                  {(overview.highlights?.topCities || []).map((item) => (
                    <span key={item.label} className="admin-tag">
                      {item.label}: {item.value}
                    </span>
                  ))}
                </div>
              </section>

              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Stripe Setup Checklist</h2>
                </div>
                <ol className="admin-checklist">
                  <li>Попълни `server/.env` със `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` и `SUPABASE_SERVICE_ROLE_KEY`.</li>
                  <li>Стартирай `npm run server` и провери `http://localhost:4242/health`.</li>
                  <li>В Stripe Dashboard насочи webhook към `http://localhost:4242/api/stripe/webhook`.</li>
                  <li>Избери `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.</li>
                </ol>
              </section>
            </div>

            <div className="admin-panel-stack">
              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Потребители и роли</h2>
                  <span>{users.length} профила</span>
                </div>

                <div className="admin-card-grid">
                  {users.map((user) => (
                    <article key={user.id} className="admin-action-card">
                      <div className="admin-action-card__top">
                        <div>
                          <strong>{user.fullName || user.email}</strong>
                          <span>{user.email || "Без имейл"}</span>
                        </div>
                        <span className="admin-badge">{user.accountType}</span>
                      </div>

                      <div className="admin-field-grid">
                        <label>
                          Роля
                          <select
                            value={userDrafts[user.id]?.role || "patient"}
                            onChange={(event) =>
                              handleUserDraftChange(user.id, "role", event.target.value)
                            }
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Статус
                          <select
                            value={userDrafts[user.id]?.accountStatus || "active"}
                            onChange={(event) =>
                              handleUserDraftChange(
                                user.id,
                                "accountStatus",
                                event.target.value
                              )
                            }
                          >
                            {ACCOUNT_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label>
                          Верификация
                          <select
                            value={userDrafts[user.id]?.verificationStatus || "active"}
                            onChange={(event) =>
                              handleUserDraftChange(
                                user.id,
                                "verificationStatus",
                                event.target.value
                              )
                            }
                          >
                            {VERIFICATION_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label>
                        Admin бележка
                        <textarea
                          rows={3}
                          value={userDrafts[user.id]?.adminNotes || ""}
                          onChange={(event) =>
                            handleUserDraftChange(user.id, "adminNotes", event.target.value)
                          }
                        />
                      </label>

                      <div className="admin-action-row">
                        <span>
                          Subscription: {user.subscription?.plan || "free"} /{" "}
                          {user.subscription?.status || "inactive"}
                        </span>
                        <button
                          type="button"
                          className="admin-primary-btn admin-primary-btn--small"
                          disabled={savingUserId === user.id}
                          onClick={() => handleUserSave(user.id)}
                        >
                          {savingUserId === user.id ? "Запазване..." : "Запази"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Лекарски кандидатури</h2>
                  <span>{doctorApplications.length} кандидатури</span>
                </div>

                <div className="admin-card-grid">
                  {doctorApplications.map((item) => (
                    <article key={item.id} className="admin-action-card">
                      <div className="admin-action-card__top">
                        <div>
                          <strong>{item.fullName || item.email}</strong>
                          <span>
                            {item.doctorProfile?.specialty || "Лекар"} •{" "}
                            {item.doctorProfile?.clinicName || "Без клиника"}
                          </span>
                        </div>
                        <span className="admin-badge">
                          {item.doctorProfile?.verificationStatus || item.verificationStatus}
                        </span>
                      </div>

                      <div className="admin-meta-grid">
                        <span>Лиценз: {item.doctorProfile?.licenseNumber || "—"}</span>
                        <span>Град: {item.doctorProfile?.city || "—"}</span>
                        <span>
                          Опит: {item.doctorProfile?.yearsExperience || 0} години
                        </span>
                        <span>
                          Online: {item.doctorProfile?.online ? "Да" : "Не"}
                        </span>
                      </div>

                      <div className="admin-field-grid">
                        <label>
                          Верификация
                          <select
                            value={doctorDrafts[item.id]?.verificationStatus || "pending_review"}
                            onChange={(event) =>
                              handleDoctorDraftChange(
                                item.id,
                                "verificationStatus",
                                event.target.value
                              )
                            }
                          >
                            {VERIFICATION_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="admin-toggle-field">
                          <span>Публикуван в директорията</span>
                          <input
                            type="checkbox"
                            checked={Boolean(doctorDrafts[item.id]?.isListed)}
                            onChange={(event) =>
                              handleDoctorDraftChange(item.id, "isListed", event.target.checked)
                            }
                          />
                        </label>
                      </div>

                      <label>
                        Admin бележка
                        <textarea
                          rows={3}
                          value={doctorDrafts[item.id]?.adminNotes || ""}
                          onChange={(event) =>
                            handleDoctorDraftChange(item.id, "adminNotes", event.target.value)
                          }
                        />
                      </label>

                      <div className="admin-action-row admin-action-row--split">
                        <button
                          type="button"
                          className="admin-secondary-btn"
                          disabled={savingDoctorId === item.id}
                          onClick={() =>
                            handleDoctorReview(item.id, {
                              verificationStatus: "rejected",
                              isListed: false,
                            })
                          }
                        >
                          Откажи
                        </button>
                        <button
                          type="button"
                          className="admin-primary-btn admin-primary-btn--small"
                          disabled={savingDoctorId === item.id}
                          onClick={() =>
                            handleDoctorReview(item.id, {
                              verificationStatus: "approved",
                              isListed: true,
                            })
                          }
                        >
                          {savingDoctorId === item.id ? "Обработка..." : "Одобри и публикувай"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <div className="admin-table-grid">
              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Recent Appointments</h2>
                </div>
                <div className="admin-list">
                  {(overview.recent?.appointments || []).map((item) => (
                    <article key={item.id} className="admin-list-item admin-list-item--stack">
                      <div>
                        <strong>{item.doctorName || item.specialty || "Appointment"}</strong>
                        <span>
                          {item.appointmentDate || item.createdAt?.slice(0, 10)} •{" "}
                          {item.status}
                        </span>
                      </div>
                      <select
                        value={item.status || "pending"}
                        disabled={updatingAppointmentId === item.id}
                        onChange={(event) =>
                          handleAppointmentStatusChange(item.id, event.target.value)
                        }
                      >
                        {APPOINTMENT_STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Recent Subscriptions</h2>
                </div>
                <div className="admin-list">
                  {(overview.recent?.subscriptions || []).map((item) => (
                    <article key={`${item.userId}-${item.updatedAt}`} className="admin-list-item">
                      <strong>{item.plan?.toUpperCase() || "FREE"}</strong>
                      <span>
                        {item.status} • {formatTimeStamp(item.updatedAt)}
                      </span>
                    </article>
                  ))}
                </div>
              </section>

              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Recent Chat Threads</h2>
                  <Link className="admin-inline-link" to="/chat">
                    Отвори чата
                  </Link>
                </div>
                <div className="admin-list">
                  {(overview.recent?.threads || []).map((item) => (
                    <article key={item.id} className="admin-list-item">
                      <strong>{item.subject}</strong>
                      <span>
                        {item.status} • {item.messageCount} messages
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
