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
  const s = normalizeStatus(status);
  return s.includes("assessment scheduled");
}

function isCompletedAssessment(status: string) {
  const s = normalizeStatus(status);
  return s.includes("assessment completed");
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

function getUpcomingEmployeeEvent(employees: Row[]) {
  const events: {
    employee: string;
    role: string;
    type: "birthday" | "anniversary";
    label: string;
    years?: number | null;
    timestamp: number;
  }[] = [];

  employees.forEach((row) => {
    const employee = row.employee || "Unknown Employee";
    const role = row.role || "";

    if (row.birthday) {
      const next = getNextOccurrence(row.birthday);
      if (next) {
        events.push({
          employee,
          role,
          type: "birthday",
          label: formatMonthDayOnly(row.birthday),
          timestamp: next.getTime(),
        });
      }
    }

    if (row.work_anniversary) {
      const next = getNextOccurrence(row.work_anniversary);
      if (next) {
        events.push({
          employee,
          role,
          type: "anniversary",
          label: formatMonthDayOnly(row.work_anniversary),
          years: getWorkAnniversaryYears(row.work_anniversary),
          timestamp: next.getTime(),
        });
      }
    }
  });

  return events.sort((a, b) => a.timestamp - b.timestamp)[0] || null;
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
  const upcomingEmployeeEvent = getUpcomingEmployeeEvent(safeData.employees);

  const openTasks = safeData.tasks.filter((row) => isTaskOpen(row.status || ""));

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
          grid-template-columns: 2fr 1fr;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
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
          padding: 18px 20px;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
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
          font-size: 14px;
          font-weight: 700;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .kpi-value {
          font-size: 44px;
          line-height: 1;
          font-weight: 800;
          margin-top: 16px;
          color: #111827;
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
          background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%);
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
          padding: 16px 18px;
          border: 1px solid #e5e7eb;
          border-radius: 20px;
          background: #ffffff;
        }

        .employee-name {
          font-size: 18px;
          font-weight: 800;
          color: #111827;
        }

        .employee-role {
          margin-top: 4px;
          font-size: 14px;
          color: #6b7280;
        }

        .employee-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 12px;
        }

        .soft-note {
          color: #9ca3af;
          font-size: 15px;
          font-style: italic;
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
              An overview of client inquiries, billing, tasks, and the team
            </p>

            <p style={{ marginTop: 10, color: "#9ca3af", fontSize: 14, fontWeight: 600 }}>
              Last updated: {new Date().toLocaleString()}
            </p>
          </div>
        </div>

        <div className="kpi-row" style={{ marginBottom: 22 }}>
          <KpiCard label="New Inquiries (MTD)" value={String(callBuckets.newCount)} accent="blue" />
          <KpiCard label="Scheduled" value={String(callBuckets.scheduledCount)} accent="blue" />
          <KpiCard label="Completed" value={String(callBuckets.completedCount)} accent="green" />
          <KpiCard label="Collected (MTD)" value={String(collectedMTD)} accent="red" isMoney />
        </div>

        <div className="dashboard-grid">
          <div className="left-column">
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
                    <p className="section-subtitle">Phase 2 integration</p>
                  </div>
                </div>
                <div className="soft-note">Data integration in progress.</div>
              </section>

              <section className="card section-card">
                <div className="section-heading">
                  <div>
                    <h2 className="section-title">Monthly Productivity</h2>
                    <p className="section-subtitle">Phase 2 integration</p>
                  </div>
                </div>
                <div className="soft-note">Data integration in progress.</div>
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

          <div className="right-column">
            <section className="card section-card">
              <div className="section-heading">
                <div>
                  <h2 className="section-title">Open Tasks</h2>
                  <p className="section-subtitle">Current action items and owners</p>
                </div>
              </div>

              {openTasks.length ? (
                <div className="task-list">
                  {openTasks.map((row, i) => (
                    <div key={i} className="task-card">
                      <div className="task-title">{row.task || "Untitled task"}</div>

                      <div className="task-meta">
                        {row.owner ? <span className="tag owner">Owner: {row.owner}</span> : null}
                        {row.due ? <span className="tag due">Due: {row.due}</span> : null}
                        {row.status ? <span className="tag status">{row.status}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="soft-note">No open tasks found.</div>
              )}
            </section>

            <section className="card section-card">
              <div className="section-heading">
                <div>
                  <h2 className="section-title">Billing Snapshot</h2>
                  <p className="section-subtitle">Month-to-date financial view</p>
                </div>
              </div>

              <div className="billing-stack">
                <div className="billing-hero">
                  <div className="billing-hero-label">Collected (MTD)</div>
                  <div className="billing-hero-value">{collectedMTD}</div>
                </div>

                <div className="billing-secondary">
                  {billingCards
                    .filter((card) => !normalizeStatus(card.label).includes("collected (mtd)"))
                    .map((card, i) => (
                      <div key={i} className="billing-item">
                        <div className="billing-item-label">{card.label}</div>
                        <div className="billing-item-value">{card.value}</div>
                      </div>
                    ))}
                </div>

                <div className="billing-item" style={{ background: "#fafafa" }}>
                  <div className="billing-item-label">Reference Point</div>
                  <div className="billing-item-value">{lastMonthCollected}</div>
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

              {upcomingEmployeeEvent ? (
                <div className="milestone-feature">
                  <div className="milestone-feature-label">Upcoming</div>
                  <div className="milestone-feature-name">{upcomingEmployeeEvent.employee}</div>
                  <div className="milestone-feature-role">{upcomingEmployeeEvent.role}</div>
                  <div className="milestone-feature-event">
                    {upcomingEmployeeEvent.type === "birthday"
                      ? `🧁 Birthday — ${upcomingEmployeeEvent.label}`
                      : `🎉 ${upcomingEmployeeEvent.years ?? 0}y Anniversary — ${upcomingEmployeeEvent.label}`}
                  </div>
                </div>
              ) : null}

              {safeData.employees.length ? (
                <div className="employee-list">
                  {safeData.employees.map((row, i) => (
                    <div key={i} className="employee-card">
                      <div className="employee-name">{row.employee || "Unknown Employee"}</div>
                      <div className="employee-role">{row.role || ""}</div>

                      <div className="employee-tags">
                        {row.birthday ? (
                          <div
                            className="tag"
                            style={{ background: "#fff7ed", color: "#9a3412" }}
                          >
                            🧁 {formatMonthDayOnly(row.birthday)}
                          </div>
                        ) : null}

                        {row.work_anniversary ? (
                          <div
                            className="tag"
                            style={{ background: "#fef2f2", color: "#991b1b" }}
                          >
                            🎉 {getWorkAnniversaryYears(row.work_anniversary)}y —{" "}
                            {formatMonthDayOnly(row.work_anniversary)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="soft-note">No employee dates found.</div>
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