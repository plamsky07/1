function quoteLabel(value) {
  return `"${String(value || "").replace(/"/g, "'")}"`;
}

function clampNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export function buildAppointmentsTrendChart(points = []) {
  const labels = points.map((item) => quoteLabel(item.label || ""));
  const values = points.map((item) => clampNumber(item.value));
  const maxValue = Math.max(4, ...values);

  return [
    "xychart-beta",
    'title "Нови записвания за последните 7 дни"',
    `x-axis [${labels.join(", ")}]`,
    `y-axis "Записвания" 0 --> ${maxValue + 2}`,
    `bar [${values.join(", ")}]`,
    `line [${values.join(", ")}]`,
  ].join("\n");
}

export function buildSubscriptionMixChart(items = []) {
  const rows = items.length > 0 ? items : [{ label: "No active plans", value: 1 }];

  return [
    "pie showData",
    'title "Активни абонаменти по план"',
    ...rows.map((item) => `${quoteLabel(item.label)} : ${clampNumber(item.value)}`),
  ].join("\n");
}

export function buildAppointmentStatusChart(items = []) {
  const rows = items.length > 0 ? items : [{ label: "No data", value: 1 }];

  return [
    "pie showData",
    'title "Статуси на записванията"',
    ...rows.map((item) => `${quoteLabel(item.label)} : ${clampNumber(item.value)}`),
  ].join("\n");
}

export function buildChatLoadChart(points = []) {
  const labels = points.map((item) => quoteLabel(item.label || ""));
  const values = points.map((item) => clampNumber(item.value));
  const maxValue = Math.max(4, ...values);

  return [
    "xychart-beta",
    'title "Активност в чата за последните 7 дни"',
    `x-axis [${labels.join(", ")}]`,
    `y-axis "Съобщения" 0 --> ${maxValue + 3}`,
    `bar [${values.join(", ")}]`,
    `line [${values.join(", ")}]`,
  ].join("\n");
}

export function buildUserRoleChart(items = []) {
  const rows = items.length > 0 ? items : [{ label: "No users", value: 1 }];

  return [
    "pie showData",
    'title "Роли и типове акаунти"',
    ...rows.map((item) => `${quoteLabel(item.label)} : ${clampNumber(item.value)}`),
  ].join("\n");
}

export function buildDoctorVerificationChart(items = []) {
  const rows = items.length > 0 ? items : [{ label: "No applications", value: 1 }];

  return [
    "pie showData",
    'title "Статус на лекарските кандидатури"',
    ...rows.map((item) => `${quoteLabel(item.label)} : ${clampNumber(item.value)}`),
  ].join("\n");
}
