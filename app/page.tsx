"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const defaultSources = {
  billingUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpZK1Lo3SGoWaayUtjXt7BpSmoNSTgtbGe89Zo8vAGmvFJ0OColgr1iP8KXFHrPO9_22cTHyF5BuNP/pub?gid=0&single=true&output=csv",
  capacityUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpZK1Lo3SGoWaayUtjXt7BpSmoNSTgtbGe89Zo8vAGmvFJ0OColgr1iP8KXFHrPO9_22cTHyF5BuNP/pub?gid=285200383&single=true&output=csv",
  employeesUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpZK1Lo3SGoWaayUtjXt7BpSmoNSTgtbGe89Zo8vAGmvFJ0OColgr1iP8KXFHrPO9_22cTHyF5BuNP/pub?gid=634997123&single=true&output=csv",
  tasksUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpZK1Lo3SGoWaayUtjXt7BpSmoNSTgtbGe89Zo8vAGmvFJ0OColgr1iP8KXFHrPO9_22cTHyF5BuNP/pub?gid=1266770258&single=true&output=csv",
  callsUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTpZK1Lo3SGoWaayUtjXt7BpSmoNSTgtbGe89Zo8vAGmvFJ0OColgr1iP8KXFHrPO9_22cTHyF5BuNP/pub?gid=1410625520&single=true&output=csv",
};

type Row = Record<string, string>;
type DataState = {
  billing: Row[];
  capacity: Row[];
  employees: Row[];
  tasks: Row[];
  calls: Row[];
};

function parseCSV(text: string) {
  if (!text || !text.trim()) return [];

  const rows = text
    .replace(/\r/g, "")
    .trim()
    .split("\n")
    .map((row) =>
      row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((cell) =>
        cell.replace(/^"|"$/g, "").trim()
      )
    );

  if (!rows.length) return [];
  const headers = rows[0] || [];

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell && cell.trim() !== ""))
    .map((row) =>
      Object.fromEntries(headers.map((h, i) => [h.trim(), row[i] || ""]))
    );
}

function isNumericLike(value: string) {
  const cleaned = String(value || "").replace(/[$,%\s,]/g, "");
  return cleaned !== "" && !Number.isNaN(Number(cleaned));
}

function looksLikeMoney(label: string, value: string) {
  const l = label.toLowerCase();
  return (
    /collected|expected|projected|revenue|amount|billed|pending|salary|cost|income|gap|balance|total/.test(
      l
    ) && isNumericLike(value)
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

  if (s.includes("scheduled")) return { bg: "#dcfce7", text: "#166534" };
  if (s.includes("assessment")) return { bg: "#dcfce7", text: "#166534" };
  if (s.includes("new")) return { bg: "#fef3c7", text: "#92400e" };
  if (s.includes("contacted")) return { bg: "#dbeafe", text: "#1d4ed8" };
  if (s.includes("progress")) return { bg: "#dbeafe", text: "#1d4ed8" };
  if (s.includes("pending")) return { bg: "#e0e7ff", text: "#4338ca" };
  if (s.includes("waitlist")) return { bg: "#fee2e2", text: "#991b1b" };
  if (s.includes("done")) return { bg: "#dcfce7", text: "#166534" };
  if (s.includes("high")) return { bg: "#fee2e2", text: "#991b1b" };
  if (s.includes("medium")) return { bg: "#fef3c7", text: "#92400e" };
  if (s.includes("low")) return { bg: "#dcfce7", text: "#166534" };

  return { bg: "#f3f4f6", text: "#374151" };
}

function getBillingCards(billingRows: Row[]) {
  const firstRow = billingRows[0];
  if (!firstRow) return [];

  return Object.entries(firstRow)
    .slice(1)
    .map(([label, value]) => ({
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

export default function Dashboard() {
  const [data, setData] = useState<DataState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    async function safeFetch(name: string, url: string) {
      try {
        const res = await fetch(url);
        if (!res.ok) return { name, text: "", failed: true };
        const text = await res.text();
        return { name, text, failed: false };
      } catch {
        return { name, text: "", failed: true };
      }
    }

    async function loadData() {
      setLoadError("");
      setFailedSources([]);

      const results = await Promise.all([
        safeFetch("Billing", defaultSources.billingUrl),
        safeFetch("Capacity", defaultSources.capacityUrl),
        safeFetch("Employees", defaultSources.employeesUrl),
        safeFetch("Tasks", defaultSources.tasksUrl),
        safeFetch("Calls", defaultSources.callsUrl),
      ]);

      const failed = results.filter((r) => r.failed).map((r) => r.name);
      setFailedSources(failed);

      const parsed = {
        billing: results[0].text ? parseCSV(results[0].text) : [],
        capacity: results[1].text ? parseCSV(results[1].text) : [],
        employees: results[2].text ? parseCSV(results[2].text) : [],
        tasks: results[3].text ? parseCSV(results[3].text) : [],
        calls: results[4].text ? parseCSV(results[4].text) : [],
      };

      if (
        !parsed.billing.length &&
        !parsed.capacity.length &&
        !parsed.employees.length &&
        !parsed.tasks.length &&
        !parsed.calls.length
      ) {
        setLoadError("No data loaded. Check your published sheet links and headers.");
      } else if (failed.length) {
        setLoadError(`Some sections could not load: ${failed.join(", ")}`);
      }

      setData(parsed);
    }

    loadData();
  }, []);

  if (!data) {
    return <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>Loading dashboard...</div>;
  }

  const billingCards = getBillingCards(data.billing);

  const openTasks = data.tasks.filter((row) => {
    const status = normalizeStatus(row.status || "");
    return status !== "done";
  });

  const callBuckets = data.calls.reduce(
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
        .span-4 { grid-column: span 4 / span 4; }
        .span-6 { grid-column: span 6 / span 6; }
        .span-12 { grid-column: span 12 / span 12; }

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
          .span-3, .span-4 { grid-column: span 6 / span 6; }
          .span-6 { grid-column: span 12 / span 12; }
        }

        @media (max-width: 700px) {
          .dashboard-shell {
            padding: 18px;
          }

          .dashboard-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .span-3, .span-4, .span-6, .span-12 {
            grid-column: span 1 / span 1;
          }

          .header-wrap {
            align-items: flex-start;
          }

          .header-wrap h1 {
            font-size: 28px !important;
          }

          .metrics-grid,
          .calls-grid {
            grid-template-columns: 1fr;
          }
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

        {loadError ? (
          <div
            style={{
              background: "#fff7ed",
              border: "1px solid #fdba74",
              color: "#9a3412",
              padding: 14,
              borderRadius: 16,
              marginBottom: 24,
              fontSize: 14,
            }}
          >
            {loadError}
          </div>
        ) : null}

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

          <Panel title="High-Level Billing Metrics" spanClass="span-6" minHeight={260}>
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
            {data.capacity.length ? (
              <div style={{ width: "100%" }}>
                {data.capacity.slice(0, 4).map((row, i) => (
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
            {data.calls.length ? (
              <div style={{ width: "100%" }}>
                {data.calls.slice(0, 4).map((row, i) => {
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
                            {row.child_name || "New Inquiry"}
                          </div>
                          <div style={{ color: "#64748b", marginTop: 4 }}>
                            {row.parent_name || "No parent listed"}
                          </div>
                        </div>
                        {row.status ? (
                          <span
                            style={{
                              background: colors.bg,
                              color: colors.text,
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.status}
                          </span>
                        ) : null}
                      </div>

                      <div className="calls-grid">
                        {row.phone ? <div><strong>Phone:</strong> {row.phone}</div> : null}
                        {row.service_needed ? <div><strong>Service:</strong> {row.service_needed}</div> : null}
                        {row.assigned_to ? <div><strong>Assigned:</strong> {row.assigned_to}</div> : null}
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
            {data.employees.length ? (
              <div style={{ width: "100%" }}>
                {data.employees.slice(0, 5).map((row, i) => {
                  const colors = statusColor(row.priority || "");
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "14px 0",
                        borderBottom: "1px solid #e5e7eb",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {row.employee || "Unknown Employee"}
                          {row.role ? ` — ${row.role}` : ""}
                        </div>
                        <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                          {row.work_anniversary ? `Anniversary: ${row.work_anniversary}` : ""}
                          {row.utilization_percent ? ` • ${row.utilization_percent}% utilization` : ""}
                        </div>
                        {row.recent_notes ? (
                          <div style={{ color: "#334155", fontSize: 13, marginTop: 6 }}>
                            {row.recent_notes}
                          </div>
                        ) : null}
                      </div>
                      {row.priority ? (
                        <span
                          style={{
                            background: colors.bg,
                            color: colors.text,
                            padding: "6px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            alignSelf: "start",
                          }}
                        >
                          {row.priority}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState text="No employee data found." />
            )}
          </Panel>
        </div>

        {failedSources.length ? (
          <div style={{ marginTop: 24, color: "#64748b", fontSize: 12 }}>
            Could not load: {failedSources.join(", ")}
          </div>
        ) : null}
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