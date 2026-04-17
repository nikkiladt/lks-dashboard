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
    return { bg: "#dcfce7", text: "#166534" };
  }
  if (s.includes("assessment scheduled")) {
    return { bg: "#dbeafe", text: "#1d4ed8" };
  }
  if (s.includes("pending assessment")) {
    return { bg: "#fef3c7", text: "#92400e" };
  }
  if (s.includes("hold")) {
    return { bg: "#fde68a", text: "#92400e" };
  }
  if (s.includes("declined")) {
    return { bg: "#fee2e2", text: "#991b1b" };
  }
  if (s.includes("waitlist")) {
    return { bg: "#ede9fe", text: "#5b21b6" };
  }
  if (s.includes("contacted")) {
    return { bg: "#e0e7ff", text: "#4338ca" };
  }
  if (s.includes("new")) {
    return { bg: "#f3f4f6", text: "#374151" };
  }
  if (s.includes("scheduled")) {
    return { bg: "#dbeafe", text: "#1d4ed8" };
  }
  if (s.includes("completed")) {
    return { bg: "#dcfce7", text: "#166534" };
  }
  if (s.includes("pending")) {
    return { bg: "#fef3c7", text: "#92400e" };
  }
  if (s.includes("done")) {
    return { bg: "#dcfce7", text: "#166534" };
  }
  if (s.includes("high")) {
    return { bg: "#fee2e2", text: "#991b1b" };
  }
  if (s.includes("medium")) {
    return { bg: "#fef3c7", text: "#92400e" };
  }
  if (s.includes("low")) {
    return { bg: "#dcfce7", text: "#166534" };
  }

  return { bg: "#f3f4f6", text: "#374151" };
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

function getBillingCards(billingRows: Row[]) {
  const firstRow = billingRows[0];
  if (!firstRow) return [];

  return Object.entries(firstRow).map(([label, value]) => ({
    label: prettyLabel(label),
    value: formatValue(label, value),
  }));
}

function getCallBucket(status: string) {
  const s = normalizeStatus(status);

  if (!s) return "inProgress";
  if (s.includes("not interested")) return "closed";
  if (s.includes("not_interested")) return "closed";
  if (s.includes("scheduled")) return "scheduled";
  if (s.includes("assessment")) return "scheduled";
  if (s.includes("eval")) return "scheduled";
  if (s.includes("new")) return "new";
  if (s.includes("contacted")) return "inProgress";
  if (s.includes("progress")) return "inProgress";
  if (s.includes("waitlist")) return "inProgress";

  return "inProgress";
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

const upcomingEmployeeEvent = getUpcomingEmployeeEvent(safeData.employees);
const billingCards = getBillingCards(safeData.billing);

const openTasks = safeData.tasks.filter((row) => {
  const status = normalizeStatus(row.status || "");
  return status !== "done";
});

const callBuckets = safeData.calls.reduce(
  (acc, row) => {
    const bucket = getCallBucket(row.status || "");
    if (bucket === "new") acc.newCount += 1;
    if (bucket === "inProgress") acc.inProgressCount += 1;
    if (bucket === "scheduled") acc.scheduledCount += 1;
    return acc;
  },
  { newCount: 0, inProgressCount: 0, scheduledCount: 0 }
);

  return (
    <>
      <style>{`
        .dashboard-shell {
          padding: 32px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: #f6f8fb;
          min-height: 100vh;
          color: #0f172a;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 20px;
        }

        .panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 10px 30px rgba(15,23,42,0.06);
          min-width: 0;
        }

        .span-3 { grid-column: span 3 / span 3; }
        .span-6 { grid-column: span 6 / span 6; }

        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          width: 100%;
        }

        .calls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 12px;
          color: #475569;
          font-size: 13px;
        }

        .header-wrap {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
        }

        .logo-wrap {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(15,23,42,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        @media (max-width: 1100px) {
          .span-3 { grid-column: span 6 / span 6; }
          .span-6 { grid-column: span 12 / span 12; }
        }

        @media (max-width: 700px) {
          .dashboard-shell { padding: 18px; }
          .dashboard-grid { grid-template-columns: 1fr; gap: 16px; }
          .span-3, .span-6 { grid-column: span 1 / span 1; }
          .header-wrap { align-items: flex-start; }
          .header-wrap h1 { font-size: 28px !important; }
          .metrics-grid, .calls-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="dashboard-shell">
        <div className="header-wrap">
          <div className="logo-wrap">
            <Image src="/logo.png" alt="LKS Logo" width={44} height={44} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 38, fontWeight: 750 }}>
              LKS Operations Dashboard
            </h1>
            <p style={{ marginTop: 6, color: "#64748b", fontSize: 16 }}>
              An overview of client inquiries, billing, tasks, and the team
            </p>
          </div>
        </div>

        <div className="dashboard-grid">
          <Panel title="Open Tasks & Assignments" spanClass="span-3" minHeight={160}>
            <BigMetric value={String(openTasks.length)} />
          </Panel>

          <Panel title="Recent & Pending Inquiries" spanClass="span-3" minHeight={160}>
            <BigMetric value={String(callBuckets.newCount + callBuckets.inProgressCount)} />
          </Panel>

          <Panel title="New Inquiries" spanClass="span-3" minHeight={160}>
            <BigMetric value={String(callBuckets.newCount)} />
          </Panel>

          <Panel title="Scheduled" spanClass="span-3" minHeight={160}>
            <BigMetric value={String(callBuckets.scheduledCount)} />
          </Panel>

          <Panel title="Daily Productivity" spanClass="span-6" minHeight={260}>
            <PlaceholderText text="Coming from your daily productivity sheet" />
          </Panel>

          <Panel title="Monthly Productivity" spanClass="span-6" minHeight={260}>
            <PlaceholderText text="Coming from your monthly productivity sheet" />
          </Panel>

          <Panel title="Billing Metrics" spanClass="span-6" minHeight={260}>
            {billingCards.length ? (
              <div className="metrics-grid">
                {billingCards.map((card, i) => (
                  <div
                    key={i}
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 16,
                      padding: 14,
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: 13, fontWeight: 600 }}>
                      {card.label}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700 }}>
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No billing data found." />
            )}
          </Panel>

          <Panel title="Capacity, Cancellations & Rescheduling" spanClass="span-6" minHeight={260}>
            {safeData.capacity.length ? (
              <div style={{ width: "100%" }}>
                {safeData.capacity.slice(0, 4).map((row, i) => (
                  <CompactRow
                    key={i}
                    title={row.therapist || "Unknown Therapist"}
                    subtitle={[
                      row.booked_percent ? `${row.booked_percent}% booked` : "",
                      row.open_slots ? `Open slots: ${row.open_slots}` : "",
                      row.revenue_gap ? `Gap: ${formatValue("revenue_gap", row.revenue_gap)}` : "",
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  />
                ))}
              </div>
            ) : (
              <EmptyState text="No capacity data found." />
            )}
          </Panel>

          <Panel title="Recent & Pending Inquiries" spanClass="span-6" minHeight={340}>
            {safeData.calls.length ? (
              <div style={{ width: "100%" }}>
                {safeData.calls.slice(0, 4).map((row, i) => {
                  const colors = statusColor(row.status || "");
                  return (
                    <div
                      key={i}
                      style={{
                        padding: 16,
                        border: "1px solid #e5e7eb",
                        borderRadius: 16,
                        marginBottom: 12,
                        background: "#fbfdff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          alignItems: "start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>
                            {row.client_name || "New Inquiry"}
                          </div>
                          <div style={{ color: "#64748b", marginTop: 4 }}>
                            {row.contact_name || row.parent_name || "No contact listed"}
                          </div>
                        </div>

                        {row.status ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "flex-end",
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                background: colors.bg,
                                color: colors.text,
                                padding: "6px 12px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getStatusLabel(row.status)}
                            </span>

                            {getStatusDetail(row.status) ? (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#64748b",
                                  textAlign: "right",
                                }}
                              >
                                {getStatusDetail(row.status)}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="calls-grid">
                        {row.call_date ? <div><strong>Date:</strong> {row.call_date}</div> : null}
                        {row.age ? <div><strong>Age:</strong> {row.age}</div> : null}
                        {row.service_needed ? <div><strong>Service:</strong> {row.service_needed}</div> : null}
                        {row.assigned_to ? <div><strong>Assigned:</strong> {row.assigned_to}</div> : null}
                        {row["source (referral, google, etc.)"] ? (
                          <div><strong>Source:</strong> {row["source (referral, google, etc.)"]}</div>
                        ) : null}
                        {row.next_follow_up ? <div><strong>Follow-Up:</strong> {row.next_follow_up}</div> : null}
                      </div>

                      {row.notes ? (
                        <div style={{ marginTop: 10, color: "#334155", fontSize: 13 }}>
                          <strong>Notes:</strong> {row.notes}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No calls found." />
            )}
          </Panel>

          <Panel title="Employees & Key Dates" spanClass="span-6" minHeight={340}>
            <div style={{ width: "100%" }}>
              {upcomingEmployeeEvent ? (
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 18,
                    padding: 18,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      marginBottom: 8,
                    }}
                  >
                    Upcoming
                  </div>

                  <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>
                    {upcomingEmployeeEvent.employee}
                  </div>

                  <div style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>
                    {upcomingEmployeeEvent.role}
                  </div>

                  <div style={{ marginTop: 12, fontSize: 16, color: "#334155", fontWeight: 600 }}>
                    {upcomingEmployeeEvent.type === "birthday"
                      ? `🧁 Birthday — ${upcomingEmployeeEvent.label}`
                      : `🎉 Work Anniversary — ${upcomingEmployeeEvent.label}`}
                  </div>
                </div>
              ) : null}

              {safeData.employees.length ? (
                <div
                  style={{
                    display: "grid",
                    gap: 14,
                  }}
                >
                  {safeData.employees.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        borderRadius: 18,
                        padding: 18,
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                        {row.employee || "Unknown Employee"}
                      </div>

                      <div style={{ color: "#64748b", marginTop: 4, fontSize: 15 }}>
                        {row.role || ""}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          marginTop: 14,
                        }}
                      >
                        {row.birthday ? (
                          <div
                            style={{
                              background: "#fff7ed",
                              color: "#9a3412",
                              borderRadius: 999,
                              padding: "8px 12px",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            🧁 {formatMonthDayOnly(row.birthday)}
                          </div>
                        ) : null}

                        {row.work_anniversary ? (
                          <div
                            style={{
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              borderRadius: 999,
                              padding: "8px 12px",
                              fontSize: 14,
                              fontWeight: 600,
                            }}
                          >
                            🎉 {getWorkAnniversaryYears(row.work_anniversary)}y — {formatMonthDayOnly(row.work_anniversary)}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No employee dates found." />
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Panel({
  title,
  children,
  spanClass,
  minHeight,
}: {
  title: string;
  children: React.ReactNode;
  spanClass: string;
  minHeight: number;
}) {
  return (
    <section className={`panel ${spanClass}`} style={{ minHeight }}>
      <h2
        style={{
          marginTop: 0,
          marginBottom: 18,
          fontSize: 22,
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function BigMetric({ value }: { value: string }) {
  return (
    <div
      style={{
        fontSize: 52,
        fontWeight: 750,
        lineHeight: 1,
        color: "#0f172a",
        marginTop: 18,
      }}
    >
      {value}
    </div>
  );
}

function PlaceholderText({ text }: { text: string }) {
  return (
    <div
      style={{
        color: "#64748b",
        fontSize: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 150,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function CompactRow({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>{subtitle}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ color: "#64748b", fontStyle: "italic" }}>{text}</div>;
}