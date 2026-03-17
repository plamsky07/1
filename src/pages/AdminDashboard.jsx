import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MermaidChart from "../components/MermaidChart";
import {
  buildAppointmentStatusChart,
  buildAppointmentsTrendChart,
  buildChatLoadChart,
  buildSubscriptionMixChart,
} from "../lib/adminCharts";
import { fetchAdminOverview } from "../services/adminService";
import { isAdminUser } from "../utils/userRole";
import "../styles/Admin.css";

function formatTimeStamp(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("bg-BG", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboard({ authUser }) {
  const canAccess = isAdminUser(authUser);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authUser?.id || !canAccess) return undefined;

    let cancelled = false;

    async function loadOverview() {
      setLoading(true);
      setError("");

      try {
        const data = await fetchAdminOverview();
        if (!cancelled) {
          setOverview(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Неуспешно зареждане на admin статистиките.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [authUser?.id, canAccess]);

  const charts = useMemo(() => {
    if (!overview) return null;

    return {
      appointments: buildAppointmentsTrendChart(overview.charts?.appointmentsDaily || []),
      subscriptions: buildSubscriptionMixChart(overview.charts?.subscriptionMix || []),
      statuses: buildAppointmentStatusChart(overview.charts?.appointmentStatus || []),
      chat: buildChatLoadChart(overview.charts?.messagesDaily || []),
    };
  }, [overview]);

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

  const statCards = overview
    ? [
        { label: "Appointments", value: overview.summary?.totalAppointments || 0 },
        { label: "Upcoming", value: overview.summary?.upcomingAppointments || 0 },
        { label: "Active Subs", value: overview.summary?.activeSubscriptions || 0 },
        {
          label: "MRR",
          value: overview.summary?.monthlyRecurringRevenueLabel || "€0.00",
        },
        { label: "Open Threads", value: overview.summary?.openThreads || 0 },
        {
          label: "Avg Response",
          value: `${overview.summary?.averageFirstResponseMinutes || 0} min`,
        },
      ]
    : [];

  return (
    <section className="admin-page">
      <div className="container">
        <div className="admin-hero">
          <div>
            <span className="admin-hero__eyebrow">Operations Command Center</span>
            <h1>Професионален admin dashboard с Mermaid KPI визуализации</h1>
            <p>
              Проследявай записвания, чат натоварване и Stripe performance от едно място.
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

            <div className="admin-chart-grid">
              <MermaidChart
                chart={charts.appointments}
                title="Booking Pulse"
                subtitle="Нови резервации по дни"
              />
              <MermaidChart
                chart={charts.subscriptions}
                title="Revenue Mix"
                subtitle="Активни абонаменти по план"
              />
              <MermaidChart
                chart={charts.statuses}
                title="Appointment Mix"
                subtitle="Разпределение по статуси"
              />
              <MermaidChart
                chart={charts.chat}
                title="Chat Activity"
                subtitle="Съобщения за последните 7 дни"
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
              </section>

              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Stripe Setup Checklist</h2>
                </div>
                <ol className="admin-checklist">
                  <li>Попълни `server/.env` със `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` и `SUPABASE_SERVICE_ROLE_KEY`.</li>
                  <li>В Stripe Dashboard създай webhook към `http://localhost:4242/api/stripe/webhook`.</li>
                  <li>Избери `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.</li>
                  <li>Провери дали `CLIENT_URL`, `VITE_API_URL` и `VITE_SOCKET_URL` сочат към правилните локални адреси.</li>
                </ol>
              </section>
            </div>

            <div className="admin-table-grid">
              <section className="admin-panel">
                <div className="admin-panel__head">
                  <h2>Recent Appointments</h2>
                </div>
                <div className="admin-list">
                  {(overview.recent?.appointments || []).map((item) => (
                    <article key={item.id} className="admin-list-item">
                      <strong>{item.doctorName || item.specialty || "Appointment"}</strong>
                      <span>
                        {item.status} • {item.appointmentDate || item.createdAt?.slice(0, 10)}
                      </span>
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
