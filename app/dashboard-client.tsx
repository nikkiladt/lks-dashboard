"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Row = Record<string, string>;
type DataState = {
  billing: Row[];
  capacity: Row[];
  employees: Row[];
  tasks: Row[];
  calls: Row[];
  dailyProductivity: Row[];
  monthlyProductivity: Row[];
  expenses: Row[];
};

function looksLikeMoney(label: string, value: string) {
  const cleaned = String(value || "").replace(/[$,%\s,]/g, "");
  const isNumeric = cleaned !== "" && !Number.isNaN(Number(cleaned));
  const l = label.toLowerCase();
  return (
    /collected|expected|projected|revenue|amount|billed|pending|salary|cost|income|gap|balance|total/.test(
      l
    ) && isNumeric
  );
}

function formatValue(label: string, value: string) {
  if (!value) return "—";

  if (looksLikeMoney(label, value)) {
    const num = Number(String(value).replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(num)) return value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num);
  }

  return value;
}

function prettyLabel(label: string) {
  return label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeStatus(status: string) {
  return (status || "").toLowerCase().trim();
}

function statusColor(status: string) {
  const s = normalizeStatus(status);

  if (s.includes("assessment completed")) {
    return { bg: "#ecfdf3", text: "#166534", border: "#bbf7d0" };
  }
  if (s.includes("assessment scheduled")) {
    return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" };
  }
  if (s.includes("pending assessment")) {
    return { bg: "#fef3c7", text: "#92400e", border: "#fde68a" };
  }
  if (s.includes("hold")) {
    return { bg: "#fff7ed", text: "#9a3412", border: "#fdba74" };
  }
  if (s.includes("declined")) {
    return { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" };
  }
  if (s.includes("waitlist")) {
    return { bg: "#f5f3ff", text: "#5b21b6", border: "#ddd6fe" };
  }
  if (s.includes("contacted")) {
    return { bg: "#f8fafc", text: "#475569", border: "#cbd5e1" };
  }

  return { bg: "#f8fafc", text: "#334155", border: "#e2e8f0" };
}

function getStatusLabel(status: string) {
  const s = normalizeStatus(status);

  if (s.includes("assessment completed")) return "Completed";
  if (s.includes("assessment scheduled")) return "Scheduled";
  if (s.includes("declined")) return "Declined";
  if (s.includes("hold")) return "On Hold";
  if (s.includes("pending assessment")) return "Pending";
  if (s.includes("waitlist")) return "Waitlist";
  if (s.includes("contacted")) return "Contacted";
  if (s.includes("new")) return "New";

  return status || "Unknown";
}

function getStatusDetail(status: string) {
  if (!status) return "";

  const raw = status.trim();

  if (raw.includes(" - ")) {
    const parts = raw.split(" - ");
    parts.shift();
    return parts.join(" - ");
  }

  return "";
}

function parseMonthDayYear(dateString: string) {
  if (!dateString) return null;

  const parsed = new Date(dateString);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const parts = dateString.split("/");
  if (parts.length === 3) {
    const [month, day, year] = parts.map(Number);
    const manual = new Date(year, month - 1, day);
    if (!Number.isNaN(manual.getTime())) return manual;
  }

  return null;
}

function isCurrentMonth(dateString: string) {
  const date = parseMonthDayYear(dateString);
  if (!date) return false;

  const now = new Date();
  return (
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isScheduledAssessment(status: string) {
  return normalizeStatus(status).includes("assessment scheduled");
}

function isCompletedAssessment(status: string) {
  return normalizeStatus(status).includes("assessment completed");
}

function getBillingCards(billingRows: Row[]) {
  const firstRow = billingRows[0];
  if (!firstRow) return [];

  return Object.entries(firstRow).map(([label, value]) => ({
    label: prettyLabel(label),
    value: formatValue(label, value),
  }));
}

function formatMonthDayOnly(value: string) {
  if (!value) return "";

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  return value;
}

function getNextOccurrence(value: string) {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const year = now.getFullYear();

  let next = new Date(year, parsed.getMonth(), parsed.getDate());
  next.setHours(0, 0, 0, 0);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  if (next < today) {
    next = new Date(year + 1, parsed.getMonth(), parsed.getDate());
    next.setHours(0, 0, 0, 0);
  }

  return next;
}

function getUpcomingEmployeeEvents(employees: Row[], daysAhead = 45) {
  const events: {
    employee: string;
    role: string;
    type: "birthday" | "anniversary";
    label: string;
    years?: number | null;
    timestamp: number;
  }[] = [];

  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const maxTime = today.getTime() + daysAhead * 24 * 60 * 60 * 1000;

  employees.forEach((row) => {
    const employee = row.employee || "Unknown Employee";
    const role = row.role || "";

    if (row.birthday) {
      const next = getNextOccurrence(row.birthday);
      if (next) {
        const ts = next.getTime();
        if (ts >= today.getTime() && ts <= maxTime) {
          events.push({
            employee,
            role,
            type: "birthday",
            label: formatMonthDayOnly(row.birthday),
            timestamp: ts,
          });
        }
      }
    }

    if (row.work_anniversary) {
      const next = getNextOccurrence(row.work_anniversary);
      if (next) {
        const ts = next.getTime();
        if (ts >= today.getTime() && ts <= maxTime) {
          events.push({
            employee,
            role,
            type: "anniversary",
            label: formatMonthDayOnly(row.work_anniversary),
            years: getUpcomingAnniversaryYears(row.work_anniversary),
            timestamp: ts,
          });
        }
      }
    }
  });

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

function getWorkAnniversaryYears(dateString: string) {
  if (!dateString) return null;

  const start = new Date(dateString);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();

  let years = now.getFullYear() - start.getFullYear();

  const hasHadAnniversaryThisYear =
    now.getMonth() > start.getMonth() ||
    (now.getMonth() === start.getMonth() && now.getDate() >= start.getDate());

  if (!hasHadAnniversaryThisYear) {
    years -= 1;
  }

  return years;
}

function isTaskOpen(status: string) {
  const s = normalizeStatus(status);
  return !s.includes("done") && !s.includes("complete") && !s.includes("completed");
}

function parseNumber(value: string) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
}

function sumCharges(rows: Row[]) {
  return rows.reduce((sum, row) => sum + parseNumber(row.charges || ""), 0);
}

function sumVisits(rows: Row[]) {
  return rows.reduce((sum, row) => sum + parseNumber(row.visits || ""), 0);
}

function sumDurations(rows: Row[]) {
  const totalSeconds = rows.reduce((sum, row) => {
    const value = row.duration || "";
    const parts = value.split(":").map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return sum;
    const [hours, minutes, seconds] = parts;
    return sum + hours * 3600 + minutes * 60 + seconds;
  }, 0);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function isProductivityDataRow(row: Row) {
  const therapist = normalizeStatus(row.therapist || "");
  return !!row.therapist && therapist !== "total" && !therapist.includes("--");
}

function sortProductivityRows(rows: Row[]) {
  return [...rows].sort(
    (a, b) => parseNumber(b.charges || "") - parseNumber(a.charges || "")
  );
}
function isCurrentMonthExpense(dateString: string) {
  return isCurrentMonth(dateString);
}

function isUpcomingExpense(row: Row) {
  const status = normalizeStatus(row.status || "");
  return status === "upcoming";
}

function sumExpensesMTD(rows: Row[]) {
  return rows
    .filter((row) => isCurrentMonthExpense(row.due_date || ""))
    .reduce((sum, row) => sum + parseNumber(row.amount || ""), 0);
}

function sortExpensesByDate(rows: Row[]) {
  return [...rows].sort((a, b) => {
    const aDate = parseMonthDayYear(a.due_date || "")?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDate = parseMonthDayYear(b.due_date || "")?.getTime() ?? Number.POSITIVE_INFINITY;
    return aDate - bDate;
  });
}

function formatAnniversaryFull(dateString: string) {
  if (!dateString) return "";

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return dateString;

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatYearsLabel(years: number | null) {
  if (years === null) return "";
  return `${years} year${years === 1 ? "" : "s"}`;
}
function getUpcomingAnniversaryYears(dateString: string) {
  if (!dateString) return null;

  const start = new Date(dateString);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();

  let years = now.getFullYear() - start.getFullYear();

  const thisYearAnniversary = new Date(
    now.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  // If anniversary already passed this year → next one is +1
  if (thisYearAnniversary < now) {
    years += 1;
  }

  return years;
}
function getTaskState(row: Row) {
  const raw = (
    row.task_status ||
    row.status ||
    ""
  ).toLowerCase().trim();

  if (
    raw.includes("complete") ||
    raw.includes("completed") ||
    raw === "done"
  ) {
    return "completed";
  }

  return "open";
}

function getTaskNote(row: Row) {
  return row.status_note || row.status || "";
}

function formatTaskDue(value: string) {
  if (!value) return "";
  if (value.toLowerCase() === "complete") return "";
  return value;
}
function rowNeedsAttention(row: Row) {
  const text = `${row.task_status || ""} ${row.status_note || ""} ${row.status || ""} ${row.due || ""}`.toLowerCase();
  return (
    text.includes("pending") ||
    text.includes("follow up") ||
    text.includes("confirm") ||
    text.includes("urgent")
  );
}

function inquiryNeedsAttention(row: Row) {
  const text = `${row.status || ""} ${row.next_follow_up || ""}`.toLowerCase();
  return (
    text.includes("pending") ||
    text.includes("follow up") ||
    text.includes("hold") ||
    text.includes("scheduled")
  );
}
export default function DashboardClient() {
  const [data, setData] = useState<DataState | null>(null);
  const [loadError, setLoadError] = useState("");
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    async function loadData() {
      try {
        const response = await fetch("/api/dashboard");
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Failed to load dashboard data");
        }

        setData(json);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unknown error");
      }
    }

    loadData();
  }, []);

  if (!data && !loadError) {
    return <div style={{ padding: 24 }}>Loading dashboard...</div>;
  }

  if (loadError) {
    return <div style={{ padding: 24 }}>Error: {loadError}</div>;
  }

  const safeData = data as DataState;
  const billingCards = getBillingCards(safeData.billing);
  const upcomingEmployeeEvents = getUpcomingEmployeeEvents(safeData.employees, 45);

  const openTasks = safeData.tasks.filter((row) => getTaskState(row) === "open");
const completedTasks = safeData.tasks.filter(
  (row) => getTaskState(row) === "completed"
);

const attentionTasks = openTasks.filter(rowNeedsAttention).slice(0, 3);
const attentionInquiries = safeData.calls.filter(inquiryNeedsAttention).slice(0, 3);

  const callBuckets = safeData.calls.reduce(
    (acc, row) => {
      if (isCurrentMonth(row.call_date || "")) {
        acc.newCount += 1;
      }

      const status = row.status || "";

      if (isScheduledAssessment(status)) {
        acc.scheduledCount += 1;
      }

      if (isCompletedAssessment(status)) {
        acc.completedCount += 1;
      }

      if (!isCompletedAssessment(status) && !normalizeStatus(status).includes("declined")) {
        acc.pipelineCount += 1;
      }

      return acc;
    },
    {
      newCount: 0,
      scheduledCount: 0,
      completedCount: 0,
      pipelineCount: 0,
    }
  );

  const collectedMTD =
    billingCards.find((card) => normalizeStatus(card.label).includes("collected (mtd)"))?.value ||
    "—";

  const lastMonthCollected =
    billingCards.find((card) => normalizeStatus(card.label).includes("last month"))?.value || "—";

const expensesMTD = sumExpensesMTD(safeData.expenses || []);
const netMTD = parseNumber(String(collectedMTD)) - expensesMTD;

const upcomingExpenses = sortExpensesByDate(
  (safeData.expenses || []).filter(isUpcomingExpense)
).slice(0, 5);

 const dailyRows = sortProductivityRows(
  safeData.dailyProductivity.filter(isProductivityDataRow)
);

const monthlyRows = sortProductivityRows(
  safeData.monthlyProductivity.filter(isProductivityDataRow)
);

const dailyTotals = {
  charges: sumCharges(dailyRows),
  visits: sumVisits(dailyRows),
  duration: sumDurations(dailyRows),
};

const monthlyTotals = {
  charges: sumCharges(monthlyRows),
  visits: sumVisits(monthlyRows),
  duration: sumDurations(monthlyRows),
};
  return (
    <>
      <style>{`
.attention-card {
  padding: 18px 20px;
  border-radius: 22px;
  background: linear-gradient(180deg, #fff7f7 0%, #fffdfd 100%);
  border: 1px solid #f3d6d6;
  box-shadow: none;
}

.attention-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.attention-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid #f1e5e5;
}

.attention-main {
  min-width: 0;
}

.attention-title {
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  line-height: 1.35;
}

.attention-meta {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.4;
}

.attention-badge {
  flex-shrink: 0;
  padding: 7px 10px;
  border-radius: 999px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
        
.tasks-section-stack {
  display: grid;
  gap: 18px;
}

.tasks-subsection {
  display: grid;
  gap: 12px;
}

.tasks-subheading {
  font-size: 12px;
  font-weight: 800;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.task-card-modern {
  padding: 16px 18px;
  border: 1px solid #eceff3;
  border-radius: 18px;
  background: #ffffff;
  display: grid;
  gap: 10px;
}

.task-card-modern.completed {
  background: #fafafa;
  border-color: #e5e7eb;
}

.task-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.task-title-modern {
  font-size: 17px;
  font-weight: 800;
  color: #111827;
  line-height: 1.35;
}

.task-check {
  font-size: 16px;
  color: #15803d;
  flex-shrink: 0;
  margin-top: 2px;
}

.task-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.task-chip {
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.task-chip.owner {
  background: #f3f4f6;
  color: #111827;
}

.task-chip.due {
  background: #fef2f2;
  color: #991b1b;
}

.task-chip.complete {
  background: #ecfdf3;
  color: #166534;
}

.task-note {
  font-size: 13px;
  line-height: 1.5;
  color: #6b7280;
  background: #faf7f2;
  border: 1px solid #f3eadf;
  border-radius: 14px;
  padding: 10px 12px;
}

.task-note.completed {
  background: #f8fafc;
  border-color: #e5e7eb;
  color: #64748b;
}

.completed-list {
  display: grid;
  gap: 10px;
}

.completed-task-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #eceff3;
  border-radius: 16px;
  background: #fcfcfd;
}

.completed-task-main {
  display: grid;
  gap: 6px;
}

.completed-task-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
}

.completed-task-meta {
  font-size: 13px;
  color: #6b7280;
}

.completed-task-date {
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  white-space: nowrap;
}

.dashboard-shell {
          padding: 28px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%);
          min-height: 100vh;
          color: #111827;
        }

        .dashboard-header {
          display: flex;
          align-items: flex-start;
          gap: 18px;
          margin-bottom: 28px;
        }

        .logo-wrap {
          width: 72px;
          height: 72px;
          border-radius: 22px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          box-shadow: 0 10px 30px rgba(17,24,39,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .dashboard-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.6fr;
  gap: 20px;
  align-items: start;
}

        .left-column,
        .right-column {
          display: grid;
          gap: 20px;
        }

        .kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 18px;
}

        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          box-shadow: 0 10px 28px rgba(17,24,39,0.05);
          transition: all 0.2s ease;
        }

        .card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 36px rgba(17,24,39,0.08);
        }

        .kpi-card {
  padding: 12px 14px;
  min-height: 92px;
  border-radius: 16px;
  background: #fcfcfd;
  border: 1px solid #eceff3;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

        .section-card {
          padding: 22px;
        }

        .section-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .section-title {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.02em;
        }

        .section-subtitle {
          margin: 6px 0 0 0;
          font-size: 13px;
          color: #6b7280;
        }

        .kpi-label {
  font-size: 11px;
  font-weight: 800;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 1.2;
}

.kpi-value {
  font-size: clamp(22px, 2.4vw, 30px);
  line-height: 1.05;
  font-weight: 900;
  margin-top: 6px;
}

        .kpi-value.red {
          color: #b91c1c;
        }

        .kpi-value.green {
          color: #15803d;
        }

        .kpi-value.blue {
          color: #1d4ed8;
        }

        .inquiry-list,
        .task-list,
        .employee-list {
          display: grid;
          gap: 14px;
        }

        .inquiry-card {
          padding: 18px;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          background: #fcfcfd;
        }

        .inquiry-top {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }

        .inquiry-name {
          font-size: 30px;
          font-weight: 800;
          color: #111827;
          line-height: 1.1;
        }

        .inquiry-contact {
          margin-top: 6px;
          font-size: 18px;
          color: #6b7280;
        }

        .status-wrap {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .status-pill {
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 800;
          border: 1px solid;
          white-space: nowrap;
        }

        .status-detail {
          font-size: 13px;
          color: #6b7280;
          text-align: right;
        }

        .inquiry-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 18px;
          margin-top: 14px;
          font-size: 15px;
          color: #374151;
        }

        .inquiry-grid strong {
          color: #111827;
        }

        .task-card {
          padding: 16px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          background: #fffdfd;
          border-left: 5px solid #b91c1c;
        }

        .task-title {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          line-height: 1.3;
        }

        .task-meta {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
        }

        .tag.owner {
          background: #f3f4f6;
          color: #111827;
        }

        .tag.due {
          background: #fef2f2;
          color: #991b1b;
        }

        .tag.status {
          background: #fff7ed;
          color: #9a3412;
        }

        .billing-stack {
          display: grid;
          gap: 12px;
        }

        .billing-hero {
          padding: 18px;
          border-radius: 20px;
          background: linear-gradient(135deg, #111827 0%, #000000 100%);
          color: #ffffff;
        }

        .billing-hero-label {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.85;
        }

        .billing-hero-value {
          font-size: 40px;
          font-weight: 800;
          margin-top: 10px;
          line-height: 1;
        }

        .billing-secondary {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .billing-item {
          padding: 14px 16px;
          border-radius: 18px;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
        }

        .billing-item-label {
          font-size: 13px;
          color: #6b7280;
          font-weight: 700;
        }

        .billing-item-value {
          font-size: 24px;
          font-weight: 800;
          color: #111827;
          margin-top: 6px;
        }

        .milestone-feature {
          padding: 18px;
          border-radius: 20px;
          background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
          color: #ffffff;
          margin-bottom: 14px;
        }

        .milestone-feature-label {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.75;
        }

        .milestone-feature-name {
          margin-top: 10px;
          font-size: 24px;
          font-weight: 800;
        }

        .milestone-feature-role {
          margin-top: 4px;
          font-size: 14px;
          opacity: 0.8;
        }

        .milestone-feature-event {
          margin-top: 12px;
          font-size: 16px;
          font-weight: 700;
        }

     .employee-card {
  padding: 18px 18px 16px;
  border: 1px solid #eceff3;
  border-radius: 22px;
  background: #ffffff;
}

        .employee-name {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
  line-height: 1.2;
}

        .employee-role {
  margin-top: 8px;
  font-size: 16px;
  color: #6b7280;
  font-weight: 500;
}

        .employee-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

        .soft-note {
          color: #9ca3af;
          font-size: 15px;
          font-style: italic;
        }

.productivity-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.productivity-stat {
  padding: 14px 16px;
  border-radius: 16px;
  background: #fcfcfd;
  border: 1px solid #eceff3;
}

.productivity-stat-label {
  font-size: 11px;
  font-weight: 800;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.productivity-stat-value {
  margin-top: 8px;
  font-size: 24px;
  line-height: 1;
  font-weight: 900;
  color: #111827;
}

.productivity-list {
  display: grid;
  gap: 10px;
}

.productivity-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) repeat(3, minmax(88px, 110px));
  gap: 16px;
  align-items: center;
  padding: 16px 18px;
  border: 1px solid #eceff3;
  border-radius: 18px;
  background: #ffffff;
}

.productivity-person {
  min-width: 0;
}

.productivity-name {
  font-size: 15px;
  font-weight: 800;
  color: #111827;
  line-height: 1.3;
  word-break: break-word;
}

.productivity-meta {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
}

.productivity-metric {
  text-align: right;
}

.productivity-metric-label {
  font-size: 10px;
  font-weight: 800;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.productivity-metric-value {
  margin-top: 4px;
  font-size: 16px;
  font-weight: 800;
  color: #111827;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .productivity-summary {
    grid-template-columns: 1fr;
  }

  .productivity-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .productivity-metric {
    text-align: left;
        
        }

        .lower-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }

          .kpi-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .lower-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 1200px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .productivity-summary {
    grid-template-columns: 1fr;
  }

  .productivity-row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .productivity-metric {
    text-align: left;
  }
}

@media (max-width: 760px) {
  .dashboard-shell {
    padding: 18px;
  }

  .dashboard-header {
    align-items: flex-start;
  }

  .kpi-row,
  .lower-grid {
    grid-template-columns: 1fr;
  }

  .inquiry-grid {
    grid-template-columns: 1fr;
  }

  .inquiry-name {
    font-size: 24px;
  }
}

@media (max-width: 640px) {
  .kpi-row {
    grid-template-columns: 1fr;
  }

  .kpi-card {
    min-height: 84px;
  }
}
      `}</style>

      <div className="dashboard-shell">
        <div className="dashboard-header">
          <div className="logo-wrap">
            <Image src="/logo.png" alt="LKS Logo" width={52} height={52} />
          </div>

          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 64,
                lineHeight: 1,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "#0f172a",
              }}
            >
              LKS Operations Dashboard
            </h1>

            <p style={{ marginTop: 14, color: "#64748b", fontSize: 24 }}>
              An overview of client inquiries, billing, tasks, and team
            </p>

            <p style={{ marginTop: 10, color: "#9ca3af", fontSize: 14, fontWeight: 600 }}>
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>

       <div className="kpi-row">
  
  <KpiCard label="Revenue (MTD)" value={String(collectedMTD)} accent="red" isMoney />
  <KpiCard
    label="Net (MTD)"
    value={new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(netMTD)}
    accent={netMTD >= 0 ? "green" : "red"}
    isMoney
  />
<KpiCard label="New Inquiries (MTD)" value={String(callBuckets.newCount)} accent="blue" />
  <KpiCard label="Scheduled" value={String(callBuckets.scheduledCount)} accent="blue" />
  <KpiCard label="Completed" value={String(callBuckets.completedCount)} accent="green" />
</div>
<div className="dashboard-grid">
  <div className="left-column">
    <section className="card attention-card">
      <div className="section-heading" style={{ marginBottom: 0 }}>
        <div>
          <h2 className="section-title">Needs Attention</h2>
          <p className="section-subtitle">
            Immediate follow-up items across tasks and inquiries
          </p>
        </div>
      </div>

      <div className="attention-list">
        {[...attentionTasks, ...attentionInquiries].slice(0, 5).map((row, i) => (
          <div key={i} className="attention-row">
            <div className="attention-main">
              <div className="attention-title">
                {row.task || row.client_name || "Action item"}
              </div>
              <div className="attention-meta">
                {row.status_note ||
                  row.next_follow_up ||
                  row.status ||
                  "Needs review"}
              </div>
            </div>

            <div className="attention-badge">Action</div>
          </div>
        ))}

        {!attentionTasks.length && !attentionInquiries.length ? (
          <div className="soft-note">No urgent items flagged right now.</div>
        ) : null}
      </div>
    </section>

    <section className="card section-card">
      <div className="section-heading">
        <div>
          <h2 className="section-title">Open Tasks</h2>
          <p className="section-subtitle">
            Current action items and recent completions
          </p>
        </div>
      </div>

      <div className="tasks-section-stack">
        <div className="tasks-subsection">
          <div className="tasks-subheading">Active Tasks</div>

          {openTasks.length ? (
            openTasks.map((row, i) => (
              <div key={i} className="task-card-modern">
                <div className="task-top-row">
                  <div className="task-title-modern">
                    {row.task || "Untitled task"}
                  </div>
                </div>

                <div className="task-meta-row">
                  {row.owner ? (
                    <span className="task-chip owner">Owner: {row.owner}</span>
                  ) : null}

                  {formatTaskDue(row.due || "") ? (
                    <span className="task-chip due">
                      Due: {formatTaskDue(row.due || "")}
                    </span>
                  ) : null}
                </div>

                {getTaskNote(row) ? (
                  <div className="task-note">{getTaskNote(row)}</div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="soft-note">No active tasks found.</div>
          )}
        </div>

        <div className="tasks-subsection">
          <div className="tasks-subheading">Recently Completed</div>

          {completedTasks.length ? (
            <div className="completed-list">
              {completedTasks.slice(0, 4).map((row, i) => (
                <div key={i} className="completed-task-row">
                  <div className="completed-task-main">
                    <div className="completed-task-title">
                      ✓ {row.task || "Completed task"}
                    </div>

                    <div className="completed-task-meta">
                      {[row.owner ? `Owner: ${row.owner}` : "", getTaskNote(row)]
                        .filter(Boolean)
                        .join(" • ")}
                    </div>
                  </div>

                  <div className="completed-task-date">
                    {row.completed_date || "Completed"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="soft-note">No completed tasks yet.</div>
          )}
        </div>
      </div>
    </section>

<section className="card section-card">
      <div className="section-heading">
        <div>
          <h2 className="section-title">Financial Snapshot</h2>
          <p className="section-subtitle">
            Month-to-date collections, expenses, and upcoming obligations
          </p>
        </div>
      </div>

      <div className="billing-stack">
        <div className="billing-hero">
          <div className="billing-hero-label">Net (MTD)</div>
          <div className="billing-hero-value">
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(netMTD)}
          </div>
        </div>

        <div className="billing-secondary">
          <div className="billing-item">
            <div className="billing-item-label">Collected (MTD)</div>
            <div className="billing-item-value">{collectedMTD}</div>
          </div>

          <div className="billing-item">
            <div className="billing-item-label">Expenses (MTD)</div>
            <div className="billing-item-value">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(expensesMTD)}
            </div>
          </div>

          <div className="billing-item">
            <div className="billing-item-label">Projected Month Total</div>
            <div className="billing-item-value">
              {billingCards.find((card) =>
                normalizeStatus(card.label).includes("projected month total")
              )?.value || "—"}
            </div>
          </div>

          <div className="billing-item">
            <div className="billing-item-label">Last Month (Collected)</div>
            <div className="billing-item-value">{lastMonthCollected}</div>
          </div>
        </div>

        <div className="billing-item" style={{ background: "#fafafa" }}>
          <div className="billing-item-label" style={{ marginBottom: 10 }}>
            Upcoming Expenses
          </div>

          {upcomingExpenses.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {upcomingExpenses.map((row, i) => {
                const dueDate = parseMonthDayYear(row.due_date || "");
                const isSoon =
                  dueDate &&
                  dueDate.getTime() - Date.now() < 1000 * 60 * 60 * 24 * 5;

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      borderBottom:
                        i !== upcomingExpenses.length - 1
                          ? "1px solid #e5e7eb"
                          : "none",
                      paddingBottom:
                        i !== upcomingExpenses.length - 1 ? 10 : 0,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#111827" }}>
                        {row.expense_name || "Expense"}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#6b7280",
                          marginTop: 2,
                        }}
                      >
                        {[row.category, row.due_date].filter(Boolean).join(" • ")}
                      </div>
                    </div>

                    <div
                      style={{
                        fontWeight: 800,
                        color: isSoon ? "#b91c1c" : "#991b1b",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.amount
                        ? new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD",
                            maximumFractionDigits: 0,
                          }).format(parseNumber(row.amount))
                        : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="soft-note">No upcoming expenses listed.</div>
          )}
        </div>
      </div>
    </section>
<section className="card section-card">
  <div className="section-heading">
    <div>
      <h2 className="section-title">Team & Milestones</h2>
      <p className="section-subtitle">Upcoming celebrations and key dates</p>
    </div>
  </div>

  {upcomingEmployeeEvents.length ? (
    <div className="milestone-feature">
      <div className="milestone-feature-label">Upcoming (Next 45 Days)</div>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {upcomingEmployeeEvents.map((event, i) => (
          <div
            key={`${event.employee}-${event.type}-${i}`}
            style={{
              paddingBottom: i !== upcomingEmployeeEvents.length - 1 ? 12 : 0,
              borderBottom:
                i !== upcomingEmployeeEvents.length - 1
                  ? "1px solid #e5e7eb"
                  : "none",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#f4ecea",
              }}
            >
              {event.employee}
            </div>

            <div
              style={{
                marginTop: 2,
                fontSize: 14,
                color: "#f59fb9",
              }}
            >
              {event.role}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 15,
                fontWeight: 600,
                color: "#f4ecea",
              }}
            >
              {event.type === "birthday"
                ? `🧁 Birthday — ${event.label}`
                : `🎉 ${event.years ?? 0} Year Anniversary — ${event.label}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null}

  {safeData.employees.length ? (
    <div className="employee-list">
      {safeData.employees.map((row, i) => {
        const years = getWorkAnniversaryYears(row.work_anniversary);

        return (
          <div key={i} className="employee-card">
            <div className="employee-name">
              {row.employee || "Unknown Employee"}
            </div>

            <div className="employee-role">{row.role || ""}</div>

            <div className="employee-tags">
              {row.birthday ? (
                <div
                  className="tag"
                  style={{
                    background: "#e9a9bf",
                    color: "#fff",
                    padding: "10px 16px",
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  🧁 {formatMonthDayOnly(row.birthday)}
                </div>
              ) : null}

              {row.work_anniversary ? (
                <div
                  className="tag"
                  style={{
                    background: "#f8fafc",
                    border: ".5px solid #f1d5db",
                    color: "#111827",
                    padding: "10px 16px",
                    borderRadius: 999,
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ color: "#e9a9bf" }}>🎉</span>{" "}
                  {formatAnniversaryFull(row.work_anniversary)} —{" "}
                  {formatYearsLabel(years)}
                </div>
              ) : null}
            </div>

            {row.license || row.npi ? (
              <div
                style={{
                  marginTop: 16,
                  fontSize: 15,
                  color: "#111827",
                  fontWeight: 500,
                }}
              >
                {row.license ? <span>LICENSE: {row.license}</span> : null}

                {row.license && row.npi ? (
                  <span style={{ color: "#e9a9bf", margin: "0 8px" }}>•</span>
                ) : null}

                {row.npi ? <span>NPI: {row.npi}</span> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  ) : (
    <div className="soft-note">No employee data found.</div>
  )}
</section>

</div>
  <div className="right-column">
  <section className="card section-card">
    <div className="section-heading">
      <div>
        <h2 className="section-title">Inquiry Pipeline</h2>
        <p className="section-subtitle">
          Active inquiries, follow-up flow, and current status
        </p>
      </div>
    </div>

    {safeData.calls.length ? (
      <div className="inquiry-list">
        {safeData.calls.slice(0, 6).map((row, i) => {
          const colors = statusColor(row.status || "");
          return (
            <div key={i} className="inquiry-card">
              <div className="inquiry-top">
                <div>
                  <div className="inquiry-name">
                    {row.client_name || "New Inquiry"}
                  </div>
                  <div className="inquiry-contact">
                    {row.contact_name || row.parent_name || "No contact listed"}
                  </div>
                </div>

                {row.status ? (
                  <div className="status-wrap">
                    <span
                      className="status-pill"
                      style={{
                        background: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                      }}
                    >
                      {getStatusLabel(row.status)}
                    </span>

                    {getStatusDetail(row.status) ? (
                      <div className="status-detail">{getStatusDetail(row.status)}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="inquiry-grid">
                {row.call_date ? (
                  <div>
                    <strong>Date:</strong> {row.call_date}
                  </div>
                ) : null}
                {row.age ? (
                  <div>
                    <strong>Age:</strong> {row.age}
                  </div>
                ) : null}
                {row.service_needed ? (
                  <div>
                    <strong>Service:</strong> {row.service_needed}
                  </div>
                ) : null}
                {row.assigned_to ? (
                  <div>
                    <strong>Assigned:</strong> {row.assigned_to}
                  </div>
                ) : null}
                {row["source (referral, google, etc.)"] ? (
                  <div>
                    <strong>Source:</strong> {row["source (referral, google, etc.)"]}
                  </div>
                ) : null}
                {row.next_follow_up ? (
                  <div>
                    <strong>Follow-Up:</strong> {row.next_follow_up}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="soft-note">No inquiries found.</div>
    )}
  </section>

  <div className="lower-grid">
  <section className="card section-card">
    <div className="section-heading">
      <div>
        <h2 className="section-title">Daily Productivity</h2>
        <p className="section-subtitle">Today’s therapist totals</p>
      </div>
    </div>

    {dailyRows.length ? (
      <>
        <div className="productivity-summary">
          <div className="productivity-stat">
            <div className="productivity-stat-label">Charges</div>
            <div className="productivity-stat-value">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(dailyTotals.charges)}
            </div>
          </div>

          <div className="productivity-stat">
            <div className="productivity-stat-label">Visits</div>
            <div className="productivity-stat-value">{dailyTotals.visits}</div>
          </div>

          <div className="productivity-stat">
            <div className="productivity-stat-label">Duration</div>
            <div className="productivity-stat-value">{dailyTotals.duration}</div>
          </div>
        </div>

        <div className="productivity-list">
          {dailyRows.map((row, i) => (
            <div key={i} className="productivity-row">
              <div className="productivity-person">
                <div className="productivity-name">
                  {row.therapist || "Unknown Therapist"}
                </div>
                <div className="productivity-meta">
                  {[row.service, row.location].filter(Boolean).join(" • ")}
                </div>
              </div>

              <div className="productivity-metric">
                <div className="productivity-metric-label">Duration</div>
                <div className="productivity-metric-value">{row.duration || "—"}</div>
              </div>

              <div className="productivity-metric">
                <div className="productivity-metric-label">Charges</div>
                <div className="productivity-metric-value">
                  {row.charges
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 0,
                      }).format(parseNumber(row.charges))
                    : "—"}
                </div>
              </div>

              <div className="productivity-metric">
                <div className="productivity-metric-label">Visits</div>
                <div className="productivity-metric-value">{row.visits || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </>
    ) : (
      <div className="soft-note">No daily productivity data found.</div>
    )}
  </section>

  <section className="card section-card">
    <div className="section-heading">
      <div>
        <h2 className="section-title">Monthly Productivity</h2>
        <p className="section-subtitle">Month-to-date therapist totals</p>
      </div>
    </div>

    {monthlyRows.length ? (
      <>
        <div className="productivity-summary">
          <div className="productivity-stat">
            <div className="productivity-stat-label">Charges</div>
            <div className="productivity-stat-value">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(monthlyTotals.charges)}
            </div>
          </div>

          <div className="productivity-stat">
            <div className="productivity-stat-label">Visits</div>
            <div className="productivity-stat-value">{monthlyTotals.visits}</div>
          </div>

          <div className="productivity-stat">
            <div className="productivity-stat-label">Duration</div>
            <div className="productivity-stat-value">{monthlyTotals.duration}</div>
          </div>
        </div>

        <div className="productivity-list">
          {monthlyRows.map((row, i) => (
            <div key={i} className="productivity-row">
              <div className="productivity-person">
                <div className="productivity-name">
                  {row.therapist || "Unknown Therapist"}
                </div>
                <div className="productivity-meta">
                  {[row.service, row.location].filter(Boolean).join(" • ")}
                </div>
              </div>

              <div className="productivity-metric">
                <div className="productivity-metric-label">Duration</div>
                <div className="productivity-metric-value">{row.duration || "—"}</div>
              </div>

              <div className="productivity-metric">
                <div className="productivity-metric-label">Charges</div>
                <div className="productivity-metric-value">
                  {row.charges ? formatValue("charges", row.charges) : "—"}
                </div>
              </div>

              <div className="productivity-metric">
                <div className="productivity-metric-label">Visits</div>
                <div className="productivity-metric-value">{row.visits || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      </>
    ) : (
      <div className="soft-note">No monthly productivity data found.</div>
    )}
  </section>

  <section className="card section-card" style={{ gridColumn: "1 / -1" }}>
    <div className="section-heading">
      <div>
        <h2 className="section-title">Capacity, Cancellations & Rescheduling</h2>
        <p className="section-subtitle">Scheduling and therapist availability</p>
      </div>
    </div>

    {safeData.capacity.length ? (
      <div className="employee-list">
        {safeData.capacity.slice(0, 4).map((row, i) => (
          <div key={i} className="employee-card">
            <div className="employee-name">{row.therapist || "Unknown Therapist"}</div>
            <div className="employee-role">
              {[
                row.booked_percent ? `${row.booked_percent}% booked` : "",
                row.open_slots ? `Open slots: ${row.open_slots}` : "",
                row.revenue_gap
                  ? `Gap: ${formatValue("revenue_gap", row.revenue_gap)}`
                  : "",
              ]
                .filter(Boolean)
                .join(" • ")}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="soft-note">No capacity data found.</div>
    )}
  </section>
</div>

  
  </div>


</div>
</div>
    </>
  );
}

function KpiCard({
  label,
  value,
  accent,
  isMoney = false,
}: {
  label: string;
  value: string;
  accent: "red" | "green" | "blue";
  isMoney?: boolean;
}) {
  const accentClass =
    accent === "red" ? "red" : accent === "green" ? "green" : "blue";

  return (
    <div className="card kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${accentClass}`}>
        {isMoney ? value : value}
      </div>
    </div>
  );
}