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
    /collected|expected|projected|revenue|amount|billed|pending|salary|cost|income|gap|balance|total|expenses|net|remaining/.test(
      l
    ) && isNumeric
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatValue(label: string, value: string) {
  if (!value) return "—";

  if (looksLikeMoney(label, value)) {
    const num = Number(String(value).replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(num)) return value;
    return formatMoney(num);
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

function parseNumber(value: string) {
  if (!value) return 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const num = Number(cleaned);
  return Number.isNaN(num) ? 0 : num;
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

function isCurrentMonthExpense(dateString: string) {
  return isCurrentMonth(dateString);
}

function isUpcomingExpense(row: Row) {
  const status = normalizeStatus(row.status || "");
  return status === "upcoming";
}

function sortExpensesByDate(rows: Row[]) {
  return [...rows].sort((a, b) => {
    const aDate =
      parseMonthDayYear(a.due_date || "")?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDate =
      parseMonthDayYear(b.due_date || "")?.getTime() ?? Number.POSITIVE_INFINITY;
    return aDate - bDate;
  });
}

function sumExpensesMTD(rows: Row[]) {
  return rows
    .filter((row) => isCurrentMonthExpense(row.due_date || ""))
    .reduce((sum, row) => sum + parseNumber(row.amount || ""), 0);
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
    rawLabel: label,
    value: formatValue(label, value),
    rawValue: value,
  }));
}

function getBillingAmountByLabel(billingRows: Row[], matchers: string[]) {
  const firstRow = billingRows[0];
  if (!firstRow) return 0;

  const entry = Object.entries(firstRow).find(([label]) => {
    const normalized = normalizeStatus(label);
    return matchers.some((matcher) => normalized.includes(normalizeStatus(matcher)));
  });

  return entry ? parseNumber(entry[1]) : 0;
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

function getTaskState(row: Row) {
  const raw = (row.task_status || row.status || "").toLowerCase().trim();

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

  if (thisYearAnniversary < now) {
    years += 1;
  }

  return years;
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

function getDaysInMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export default function DashboardClient() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [data, setData] = useState<DataState | null>(null);
  const [loadError, setLoadError] = useState("");
  const hasLoaded = useRef(false);

const [showDaily, setShowDaily] = useState(false);

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

    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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

  const activeInquiries = safeData.calls
    .filter((row) => {
      const status = normalizeStatus(row.status || "");
      const completed = isCompletedAssessment(row.status || "");
      const declined = status.includes("declined");
      const hasRecommendations = Boolean(
        (
          row.recommendations ||
          row.recommendation ||
          row.recommendations_filled ||
          row.next_steps ||
          ""
        ).trim()
      );

      return !declined && !(completed && hasRecommendations);
    })
    .sort((a, b) => {
      const aDate = parseMonthDayYear(a.call_date || "")?.getTime() ?? 0;
      const bDate = parseMonthDayYear(b.call_date || "")?.getTime() ?? 0;
      return bDate - aDate;
    });

  const attentionInquiries = activeInquiries
    .filter(inquiryNeedsAttention)
    .slice(0, 3);

  const callBuckets = safeData.calls.reduce(
    (acc, row) => {
      if (isCurrentMonth(row.call_date || "")) {
        acc.newCount += 1;
      }

      const status = row.status || "";

      if (isScheduledAssessment(status)) acc.scheduledCount += 1;
      if (isCompletedAssessment(status)) acc.completedCount += 1;
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

  const cashCollectedMTD = getBillingAmountByLabel(safeData.billing, [
    "collected (mtd)",
    "collected mtd",
    "collections",
  ]);

  // Current billed value represents services performed this month.
  const billedServicesMTD = Math.max(sumCharges(safeData.monthlyProductivity || []), 0);

  // Until payments are tagged by service month, service-month collections are estimated.
  const collectedForCurrentServiceMonth = Math.min(cashCollectedMTD, billedServicesMTD);

  const projectedMonthTotal = getBillingAmountByLabel(safeData.billing, [
    "projected month total",
    "projected total",
  ]);

  const remainingToCollect = Math.max(
    billedServicesMTD - collectedForCurrentServiceMonth,
    0
  );
  

  const expensesMTD = sumExpensesMTD(safeData.expenses || []);
  const netMTD = cashCollectedMTD - expensesMTD;

  const now = new Date();
  const dayOfMonth = now.getDate();
const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
const nextMonthName = nextMonthDate.toLocaleString("en-US", {
  month: "long",
});
const collectionWindowText = `${nextMonthName} 1–10`;
  const daysInMonth = getDaysInMonth(now);
  const currentPace = dayOfMonth > 0 ? cashCollectedMTD / dayOfMonth : 0;
  const projectedCollections = currentPace * daysInMonth;
  const gapToProjection = Math.max(projectedCollections - cashCollectedMTD, 0);

  const allUpcomingExpenses = sortExpensesByDate(
  (safeData.expenses || []).filter(isUpcomingExpense)
);

const upcomingExpensesTotal = allUpcomingExpenses.reduce(
  (sum, row) => sum + parseNumber(row.amount || ""),
  0
);

const upcomingExpenses = allUpcomingExpenses.slice(0, 5);

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

  const underutilizedCapacity = (safeData.capacity || [])
    .filter((row) => parseNumber(row.booked_percent || "") > 0)
    .filter((row) => parseNumber(row.booked_percent || "") < 70)
    .sort(
      (a, b) =>
        parseNumber(a.booked_percent || "") - parseNumber(b.booked_percent || "")
    )
    .slice(0, 3);

  const scrollToTop = () => {
    const root = document.scrollingElement || document.documentElement || document.body;

    try {
      root.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      root.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  return (
    <>
      <style>{`
        .dashboard-shell {
          padding: 28px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: linear-gradient(180deg, #f8fafc 0%, #f3f4f6 100%);
          min-height: 100vh;
          color: #111827;
        }
.financial-stat-note {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.35;
  color: rgba(255,255,255,0.68);
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
          grid-template-columns: 1.15fr 1.25fr;
          gap: 20px;
          align-items: start;
        }

        .left-column,
        .right-column {
          display: grid;
          gap: 20px;
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

        .soft-note {
          color: #9ca3af;
          font-size: 15px;
          font-style: italic;
        }

        .hero-grid {
          display: grid;
          grid-template-columns: 1.25fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        .financial-hero {
          padding: 22px;
          border-radius: 24px;
          background: linear-gradient(135deg, #111827 0%, #0f172a 100%);
          color: #ffffff;
          display: grid;
          gap: 18px;
        }

        .financial-hero-label {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.75;
        }

        .financial-hero-value {
          font-size: clamp(34px, 4vw, 54px);
          line-height: 1;
          font-weight: 900;
        }

        .financial-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .financial-stat {
          padding: 14px 16px;
          border-radius: 18px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .financial-stat-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.72);
        }

        .financial-stat-value {
          margin-top: 8px;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 900;
          color: #ffffff;
        }


        .financial-overview-card {
          padding: 22px;
          background: linear-gradient(135deg, #111827 0%, #0f172a 100%);
          color: #ffffff;
          display: grid;
          gap: 18px;
          margin-bottom: 20px;
        }

        .financial-overview-header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: flex-start;
        }

        .financial-overview-subtitle {
          margin-top: 6px;
          font-size: 13px;
          color: rgba(255,255,255,0.7);
        }

        .financial-net-pill {
          padding: 9px 12px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.16);
          font-size: 13px;
          font-weight: 800;
          white-space: nowrap;
        }

        .financial-overview-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .financial-stat.light {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
        }

        .financial-stat-note {
          margin-top: 5px;
          font-size: 11px;
          line-height: 1.35;
          color: rgba(255,255,255,0.62);
        }
.upcoming-expense-meta {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(255,255,255,0.62);
}

        .upcoming-expenses-compact {
          padding-top: 14px;
          border-top: 1px solid rgba(255,255,255,0.12);
        }

        .upcoming-expense-list {
          display: grid;
          gap: 8px;
          margin-top: 10px;
        }

        .upcoming-expense-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 14px;
          color: rgba(255,255,255,0.88);
        }

        .upcoming-expense-row strong {
          color: #ffffff;
          white-space: nowrap;
        }

        .upcoming-expense-meta {
          display: block;
          margin-top: 2px;
          font-size: 12px;
          color: rgba(255,255,255,0.58);
        }

        .strategy-card {
          padding: 22px;
          display: grid;
          gap: 12px;
          border-radius: 24px;
          background: #ffffff;
        }

        .strategy-item {
          padding: 14px 16px;
          border: 1px solid #eceff3;
          border-radius: 18px;
          background: #fcfcfd;
        }

        .strategy-label {
          font-size: 11px;
          font-weight: 800;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .strategy-value {
          margin-top: 8px;
          font-size: 24px;
          line-height: 1.05;
          font-weight: 900;
          color: #111827;
        }

        .strategy-note {
          margin-top: 5px;
          font-size: 13px;
          color: #6b7280;
          line-height: 1.4;
        }

        .kpi-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .kpi-card {
          padding: 14px 16px;
          min-height: 98px;
          border-radius: 18px;
          background: #fcfcfd;
          border: 1px solid #eceff3;
          box-shadow: none;
          display: flex;
          flex-direction: column;
          justify-content: center;
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
          margin-top: 8px;
        }

        .kpi-value.red { color: #b91c1c; }
        .kpi-value.green { color: #15803d; }
        .kpi-value.blue { color: #1d4ed8; }
        .kpi-value.slate { color: #0f172a; }

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

        .task-card-modern {
          padding: 16px 18px;
          border: 1px solid #eceff3;
          border-radius: 18px;
          background: #ffffff;
          display: grid;
          gap: 10px;
        }

        .tasks-section-stack,
        .tasks-subsection,
        .completed-list,
        .employee-list,
        .inquiry-list,
        .productivity-list,
        .billing-stack {
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

        .task-top-row,
        .completed-task-row,
        .inquiry-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .task-title-modern,
        .completed-task-title {
          font-size: 17px;
          font-weight: 800;
          color: #111827;
          line-height: 1.35;
        }

        .task-meta-row,
        .employee-tags,
        .task-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .task-chip,
        .tag {
          display: inline-flex;
          align-items: center;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
        }

        .task-chip.owner,
        .tag.owner {
          background: #f3f4f6;
          color: #111827;
        }

        .task-chip.due,
        .tag.due {
          background: #fef2f2;
          color: #991b1b;
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

        .completed-task-row {
          padding: 14px 16px;
          border: 1px solid #eceff3;
          border-radius: 16px;
          background: #fcfcfd;
        }

        .completed-task-main {
          display: grid;
          gap: 6px;
        }

        .completed-task-meta,
        .completed-task-date,
        .status-detail,
        .employee-role,
        .inquiry-contact,
        .productivity-meta {
          font-size: 13px;
          color: #6b7280;
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

        .employee-card,
        .inquiry-card,
        .productivity-row,
        .capacity-card {
          padding: 18px;
          border: 1px solid #eceff3;
          border-radius: 20px;
          background: #ffffff;
        }

        .employee-name,
        .productivity-name {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
          line-height: 1.2;
        }

        .inquiry-name {
          font-size: 28px;
          font-weight: 800;
          color: #111827;
          line-height: 1.1;
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

        .productivity-stat-label,
        .productivity-metric-label {
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

        .productivity-row {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) repeat(3, minmax(88px, 110px));
          gap: 16px;
          align-items: center;
        }

        .productivity-person {
          min-width: 0;
        }

        .productivity-metric {
          text-align: right;
        }

        .productivity-metric-value {
          margin-top: 4px;
          font-size: 16px;
          font-weight: 800;
          color: #111827;
          white-space: nowrap;
        }

        .lower-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        @media (max-width: 1200px) {
          .hero-grid,
          .dashboard-grid,
          .lower-grid {
            grid-template-columns: 1fr;
          }

          .kpi-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .financial-grid,
          .productivity-summary,
          .inquiry-grid {
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
            padding: 12px;
          }

          .dashboard-header {
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 16px;
          }

          .logo-wrap {
            width: 48px;
            height: 48px;
            border-radius: 16px;
          }

          .dashboard-header h1 {
            font-size: 34px !important;
            line-height: 0.95 !important;
          }

          .dashboard-header p {
            font-size: 14px !important;
            margin-top: 8px !important;
          }

          .financial-overview-card,
          .section-card,
          .strategy-card,
          .financial-hero {
            padding: 14px;
            border-radius: 18px;
          }

          .financial-overview-card {
            gap: 14px;
          }

          .financial-overview-header {
            flex-direction: column;
            gap: 10px;
          }

          .financial-overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .financial-stat {
            padding: 10px;
            border-radius: 14px;
          }

          .financial-stat-value {
            font-size: 18px;
          }

          .financial-net-pill {
            width: fit-content;
          }

          .kpi-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
          }

          .kpi-card {
            min-height: 74px;
            padding: 10px;
            border-radius: 14px;
          }

          .kpi-label {
            font-size: 9px;
          }

          .kpi-value {
            font-size: 22px;
          }

          .section-title {
            font-size: 20px;
          }

          .section-subtitle {
            font-size: 12px;
            margin-top: 3px;
          }

          .card {
            border-radius: 18px;
          }

          .billing-item,
          .employee-card,
          .inquiry-card,
          .productivity-row,
          .capacity-card,
          .task-card-modern,
          .attention-row {
            padding: 12px;
            border-radius: 14px;
          }

          .inquiry-name {
            font-size: 20px;
          }

          .inquiry-grid {
            gap: 6px;
            font-size: 13px;
          }

          .status-pill {
            padding: 6px 10px;
            font-size: 11px;
          }

          .productivity-stat {
            padding: 10px 12px;
          }

          .productivity-stat-value {
            font-size: 20px;
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
              LKS and Associates
            </h1>

          

            <p style={{ marginTop: 10, color: "#9ca3af", fontSize: 14, fontWeight: 600 }}>
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        <section className="card financial-overview-card">
          <div className="financial-overview-header">
            <div>
              <div className="financial-hero-label">Financial Overview</div>
              <div className="financial-hero-value">{formatMoney(cashCollectedMTD)}</div>
              <div className="financial-overview-subtitle">Cash Collected MTD</div>
            </div>

            <div className="financial-net-pill">
              Net Cash: {formatMoney(netMTD)}
            </div>
          </div>

          <div className="financial-overview-grid">
            <div className="financial-stat light">
              <div className="financial-stat-label">Billed Services</div>
              <div className="financial-stat-value">{formatMoney(billedServicesMTD)}</div>
            </div>

            <div className="financial-stat light">
  <div className="financial-stat-label">Expenses MTD</div>
  <div className="financial-stat-value">{formatMoney(expensesMTD)}</div>
</div>

<div className="financial-stat light">
  <div className="financial-stat-label">Upcoming Expenses</div>
  <div className="financial-stat-value">{formatMoney(upcomingExpensesTotal)}</div>
  <div className="financial-stat-note">Next 30 days / pending bills</div>
</div>

            <div className="financial-stat light">
              <div className="financial-stat-label">Cash Pace</div>
              <div className="financial-stat-value">{formatMoney(currentPace)}/day</div>
              <div className="financial-stat-note">Day {dayOfMonth} of {daysInMonth}</div>
            </div>

            <div className="financial-stat light">
              <div className="financial-stat-label">Projected Month-End</div>
              <div className="financial-stat-value">
                {formatMoney(projectedMonthTotal || projectedCollections)}
              </div>
            </div>

          

            <div className="financial-stat light">
  <div className="financial-stat-label">Outstanding Current Month Services</div>
  <div className="financial-stat-value">{formatMoney(remainingToCollect)}</div>
  <div className="financial-stat-note">
    Expected collection: {collectionWindowText}
  </div>
</div>

            <div className="financial-stat light">
              <div className="financial-stat-label">Projected Gap</div>
              <div className="financial-stat-value">{formatMoney(gapToProjection)}</div>
            </div>

            <div className="financial-stat light">
              <div className="financial-stat-label">Source Note</div>
              <div className="financial-stat-note">
                Cash may include payments for prior-month services.
              </div>
            </div>
          </div>

          <div className="upcoming-expenses-compact">
  <div className="financial-stat-label">Upcoming Bills</div>

  {upcomingExpenses.length ? (
    <div className="upcoming-expense-list">
      {upcomingExpenses.map((row, i) => (
        <div key={i} className="upcoming-expense-row">
          <div>
            <span>{row.expense_name || "Expense"}</span>
            <div className="upcoming-expense-meta">
              {[row.category, row.due_date].filter(Boolean).join(" • ")}
            </div>
          </div>

          <strong>
            {row.amount ? formatMoney(parseNumber(row.amount)) : "—"}
          </strong>
        </div>
      ))}
    </div>
  ) : (
    <div className="soft-note">No upcoming expenses listed.</div>
  )}
</div>
        </section>

        <div className="kpi-row inquiry-kpi-row">
          <KpiCard label="New Inquiries (MTD)" value={String(callBuckets.newCount)} accent="blue" />
          <KpiCard label="Scheduled" value={String(callBuckets.scheduledCount)} accent="blue" />
          <KpiCard label="Completed" value={String(callBuckets.completedCount)} accent="green" />
        </div>

        <div className="dashboard-grid">
          <div className="left-column">
            <section className="card attention-card">
              <div className="section-heading" style={{ marginBottom: 0 }}>
                <div>
                  <h2 className="section-title">What Needs Attention Today</h2>
                  <p className="section-subtitle">
                    Revenue, follow-up, and utilization items that may need action
                  </p>
                </div>
              </div>

              <div className="attention-list">
                {remainingToCollect > 0 ? (
                  <div className="attention-row">
                    <div className="attention-main">
                      <div className="attention-title">Current month services still have expected collections pending</div>
                      <div className="attention-meta">
                        {formatMoney(remainingToCollect)} expected during the {collectionWindowText} billing window
                      </div>
                    </div>
                    <div className="attention-badge">Revenue</div>
                  </div>
                ) : null}

                {underutilizedCapacity.map((row, i) => (
                  <div key={`${row.therapist}-${i}`} className="attention-row">
                    <div className="attention-main">
                      <div className="attention-title">
                        {row.therapist || "Therapist"} under 70% booked
                      </div>
                      <div className="attention-meta">
                        {[row.booked_percent ? `${row.booked_percent}% booked` : "", row.open_slots ? `Open slots: ${row.open_slots}` : ""]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    </div>
                    <div className="attention-badge">Capacity</div>
                  </div>
                ))}

                {[...attentionTasks, ...attentionInquiries].slice(0, 4).map((row, i) => (
                  <div key={i} className="attention-row">
                    <div className="attention-main">
                      <div className="attention-title">
                        {row.task || row.client_name || "Action item"}
                      </div>
                      <div className="attention-meta">
                        {row.status_note || row.next_follow_up || row.status || "Needs review"}
                      </div>
                    </div>
                    <div className="attention-badge">Action</div>
                  </div>
                ))}

                {remainingToCollect <= 0 &&
                !underutilizedCapacity.length &&
                !attentionTasks.length &&
                !attentionInquiries.length ? (
                  <div className="soft-note">No urgent items flagged right now.</div>
                ) : null}
              </div>
            </section>

            <section className="card section-card">
              <div className="section-heading">
                <div>
                  <h2 className="section-title">Inquiry Pipeline</h2>
                  <p className="section-subtitle">
                    Active inquiries, follow-up flow, and current status
                  </p>
                </div>
              </div>

              {activeInquiries.length ? (
                <div className="inquiry-list">
                  {activeInquiries.slice(0, 8).map((row, i) => {
                    const colors = statusColor(row.status || "");
                    return (
                      <div key={i} className="inquiry-card">
                        <div className="inquiry-top">
                          <div>
                            <div className="inquiry-name">{row.client_name || "New Inquiry"}</div>
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
                <div className="soft-note">No active inquiries found.</div>
              )}
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
                          <div className="task-title-modern">{row.task || "Untitled task"}</div>
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

                        {getTaskNote(row) ? <div className="task-note">{getTaskNote(row)}</div> : null}
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
                            <div className="completed-task-title">✓ {row.task || "Completed task"}</div>
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

          </div>

          <div className="right-column">
           <section className="card section-card">
  <div className="section-heading">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <div>
        <h2 className="section-title">Today’s Activity</h2>
        <p className="section-subtitle">Therapist activity for today</p>
      </div>

      <button
        type="button"
        onClick={() => setShowDaily(!showDaily)}
        style={{
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        {showDaily ? "Hide" : "View"}
      </button>
    </div>
  </div>

  {!showDaily && (
    <div style={{ fontSize: 14, color: "#6b7280", marginTop: 6 }}>
      Tap “View” to see today’s therapist activity
    </div>
  )}

  {showDaily && (
    dailyRows.length ? (
      <>
        <div className="productivity-summary">
          <div className="productivity-stat">
            <div className="productivity-stat-label">Charges</div>
            <div className="productivity-stat-value">
              {formatMoney(dailyTotals.charges)}
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
                  {row.charges ? formatMoney(parseNumber(row.charges)) : "—"}
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
    )
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
                        <div className="productivity-stat-value">{formatMoney(monthlyTotals.charges)}</div>
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
                            <div className="productivity-name">{row.therapist || "Unknown Therapist"}</div>
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
                              {row.charges ? formatMoney(parseNumber(row.charges)) : "—"}
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
                            i !== upcomingEmployeeEvents.length - 1 ? "1px solid #334155" : "none",
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
                          {event.employee}
                        </div>

                        <div style={{ marginTop: 2, fontSize: 14, color: "#cbd5e1" }}>
                          {event.role}
                        </div>

                        <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: "#f8fafc" }}>
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
                        <div className="employee-name">{row.employee || "Unknown Employee"}</div>
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
                              <span style={{ color: "#e9a9bf" }}>🎉</span>&nbsp;
                              {formatAnniversaryFull(row.work_anniversary)} — {formatYearsLabel(years)}
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
                      <div key={i} className="capacity-card">
                        <div className="employee-name">{row.therapist || "Unknown Therapist"}</div>
                        <div className="employee-role">
                          {[
                            row.booked_percent ? `${row.booked_percent}% booked` : "",
                            row.open_slots ? `Open slots: ${row.open_slots}` : "",
                            row.revenue_gap ? `Gap: ${formatValue("revenue_gap", row.revenue_gap)}` : "",
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
    </>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "red" | "green" | "blue" | "slate";
}) {
  return (
    <div className="card kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${accent}`}>{value}</div>
    </div>
  );
}