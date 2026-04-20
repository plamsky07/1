const {
  ACTIVE_SUBSCRIPTION_STATUSES,
  BG_MONTHS_SHORT,
  PLAN_CATALOG,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  stripe,
  sanitizeText,
} = require("./config");
const { fetchAdminUsers, fetchDoctorApplications } = require("./adminStore");
const { fetchAllChatParticipants, fetchAllChatThreads, fetchMessagesByThreadIds, buildThreadSummary } = require("./chatStore");
const { normalizeSubscription } = require("./subscriptions");
const { hasSupabaseAdminConfig, safeFetchRows } = require("./supabase");

function parseAppointmentNotes(value) {
  const fallback = {
    service: "",
    doctorName: "",
    specialty: "",
    clinicName: "",
  };

  if (!value) return fallback;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return {
        service: parsed.service || "",
        doctorName: parsed.doctorName || "",
        specialty: parsed.specialty || "",
        clinicName: parsed.clinicName || "",
      };
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function normalizeAppointment(row) {
  const meta = parseAppointmentNotes(row.notes);
  const rawAppointmentAt =
    row.appointment_at ||
    row.appointmentAt ||
    (row.appointment_date && row.appointment_time
      ? `${row.appointment_date}T${row.appointment_time}:00`
      : null);
  const appointmentAt = rawAppointmentAt ? new Date(rawAppointmentAt) : null;
  const appointmentDate =
    row.appointment_date ||
    row.appointmentDate ||
    (appointmentAt && !Number.isNaN(appointmentAt.getTime())
      ? appointmentAt.toISOString().slice(0, 10)
      : "");

  return {
    id: String(row.id || ""),
    doctorName: meta.doctorName || row.doctor_name || row.doctorName || "",
    specialty: meta.specialty || row.specialty || "",
    clinicName: meta.clinicName || row.clinic_name || row.clinicName || "",
    service: meta.service || row.service || "",
    status: String(row.status || "pending"),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    appointmentAt:
      appointmentAt && !Number.isNaN(appointmentAt.getTime())
        ? appointmentAt.toISOString()
        : null,
    appointmentDate,
  };
}

function formatShortDate(date) {
  return `${String(date.getDate()).padStart(2, "0")} ${BG_MONTHS_SHORT[date.getMonth()]}`;
}

function buildLast7DaysSeries(items, getDateValue) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const series = [];
  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - index);

    series.push({
      _key: day.toISOString().slice(0, 10),
      label: formatShortDate(day),
      value: 0,
    });
  }

  items.forEach((item) => {
    const rawValue = getDateValue(item);
    if (!rawValue) return;

    const date =
      String(rawValue).length === 10
        ? new Date(`${rawValue}T00:00:00`)
        : new Date(rawValue);
    if (Number.isNaN(date.getTime())) return;

    const key = date.toISOString().slice(0, 10);
    const point = series.find((entry) => entry._key === key);
    if (point) {
      point.value += 1;
    }
  });

  return series.map((entry) => ({
    label: entry.label,
    value: entry.value,
  }));
}

function countBy(items, selector) {
  return items.reduce((acc, item) => {
    const key = sanitizeText(selector(item), 60) || "Unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function mapCountObjectToArray(record) {
  return Object.entries(record)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function calculateAverageResponseMinutes(threads, messages) {
  const messagesByThread = messages.reduce((acc, item) => {
    acc[item.threadId] = acc[item.threadId] || [];
    acc[item.threadId].push(item);
    return acc;
  }, {});

  const values = threads
    .map((thread) => {
      const threadMessages = (messagesByThread[thread.id] || []).sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      const firstPatientMessage = threadMessages.find(
        (message) => message.senderRole !== "admin"
      );
      const firstAdminReply = threadMessages.find(
        (message) =>
          message.senderRole === "admin" &&
          firstPatientMessage &&
          new Date(message.createdAt) > new Date(firstPatientMessage.createdAt)
      );

      if (!firstPatientMessage || !firstAdminReply) return null;

      const diffMinutes = Math.round(
        (new Date(firstAdminReply.createdAt) - new Date(firstPatientMessage.createdAt)) /
          60000
      );

      return diffMinutes >= 0 ? diffMinutes : null;
    })
    .filter((value) => value !== null);

  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getMonthlyRecurringRevenue(subscriptions) {
  return subscriptions
    .filter((item) => ACTIVE_SUBSCRIPTION_STATUSES.has(item.status))
    .reduce((sum, item) => {
      const plan = PLAN_CATALOG[item.plan];
      if (!plan) return sum;
      const monthlyValue =
        plan.interval === "year" ? Math.round(plan.amount / 12) : plan.amount;
      return sum + monthlyValue;
    }, 0);
}

function centsToCurrency(amount, currency = "EUR") {
  return new Intl.NumberFormat("bg-BG", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format((amount || 0) / 100);
}

async function buildAdminOverview() {
  const [
    appointmentRows,
    doctorRows,
    subscriptionRows,
    threads,
    participants,
    adminUsers,
    doctorApplications,
  ] =
    await Promise.all([
      safeFetchRows("appointments", { order: "created_at.desc" }),
      safeFetchRows("doctors", { order: "id.asc" }),
      safeFetchRows("subscriptions", { order: "updated_at.desc" }),
      fetchAllChatThreads(),
      fetchAllChatParticipants(),
      fetchAdminUsers(),
      fetchDoctorApplications(),
    ]);

  const appointments = appointmentRows.map(normalizeAppointment);
  const subscriptions = subscriptionRows.map(normalizeSubscription).filter(Boolean);
  const messageRows = await fetchMessagesByThreadIds(threads.map((thread) => thread.id));
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  const upcomingAppointments = appointments.filter((item) => {
    const targetDate = item.appointmentDate || item.appointmentAt?.slice(0, 10);
    return targetDate && targetDate >= todayKey;
  });
  const activeSubscriptions = subscriptions.filter((item) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(item.status)
  );
  const monthlyRecurringRevenue = getMonthlyRecurringRevenue(subscriptions);

  return {
    generatedAt: new Date().toISOString(),
    configuration: {
      stripeConfigured: Boolean(stripe),
      stripeMode: STRIPE_SECRET_KEY.startsWith("sk_live_") ? "live" : "test",
      webhookConfigured: Boolean(STRIPE_WEBHOOK_SECRET),
      supabaseAdminConfigured: hasSupabaseAdminConfig(),
    },
    summary: {
      totalDoctors: doctorRows.length,
      totalUsers: adminUsers.length,
      totalPatients: adminUsers.filter((item) => item.accountType !== "doctor").length,
      pendingDoctorApplications: doctorApplications.filter(
        (item) =>
          (item.doctorProfile?.verificationStatus || item.verificationStatus) ===
          "pending_review"
      ).length,
      approvedDoctors: doctorApplications.filter(
        (item) =>
          (item.doctorProfile?.verificationStatus || item.verificationStatus) === "approved"
      ).length,
      totalAppointments: appointments.length,
      upcomingAppointments: upcomingAppointments.length,
      bookingsToday: upcomingAppointments.filter(
        (item) => (item.appointmentDate || item.appointmentAt?.slice(0, 10)) === todayKey
      ).length,
      activeSubscriptions: activeSubscriptions.length,
      monthlyRecurringRevenue,
      monthlyRecurringRevenueLabel: centsToCurrency(monthlyRecurringRevenue),
      openThreads: threads.filter((thread) => thread.status !== "resolved").length,
      resolvedThreads: threads.filter((thread) => thread.status === "resolved").length,
      totalMessages: messageRows.length,
      averageFirstResponseMinutes: calculateAverageResponseMinutes(threads, messageRows),
      totalParticipants: new Set(participants.map((item) => item.userId)).size,
    },
    charts: {
      appointmentsDaily: buildLast7DaysSeries(appointments, (item) => item.createdAt),
      messagesDaily: buildLast7DaysSeries(messageRows, (item) => item.createdAt),
      subscriptionMix: mapCountObjectToArray(
        countBy(activeSubscriptions, (item) => item.plan.toUpperCase())
      ),
      appointmentStatus: mapCountObjectToArray(
        countBy(appointments, (item) => item.status)
      ),
      userRoles: mapCountObjectToArray(
        countBy(adminUsers, (item) => item.role || item.accountType || "patient")
      ),
      doctorVerification: mapCountObjectToArray(
        countBy(
          doctorApplications,
          (item) => item.doctorProfile?.verificationStatus || item.verificationStatus || "pending_review"
        )
      ),
    },
    highlights: {
      topSpecialties: mapCountObjectToArray(
        countBy(appointments, (item) => item.specialty || "Unspecified")
      ).slice(0, 4),
      topPlans: mapCountObjectToArray(
        countBy(activeSubscriptions, (item) => item.plan.toUpperCase())
      ).slice(0, 4),
      topCities: mapCountObjectToArray(
        countBy(
          doctorApplications.filter((item) => item.doctorProfile?.city),
          (item) => item.doctorProfile?.city || "Unknown"
        )
      ).slice(0, 4),
    },
    recent: {
      appointments: appointments.slice(0, 5),
      subscriptions: subscriptions.slice(0, 5),
      users: adminUsers.slice(0, 6),
      doctorApplications: doctorApplications.slice(0, 6),
      threads: threads
        .map((thread) =>
          buildThreadSummary(
            thread,
            messageRows.filter((item) => item.threadId === thread.id)
          )
        )
        .slice(0, 5),
    },
  };
}

module.exports = {
  buildAdminOverview,
};
