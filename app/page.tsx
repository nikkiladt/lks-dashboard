"use client";

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

function parseCSV(text: string) {
  if (!text || !text.trim()) return [];

  const rows = text
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

function formatMoney(value: string) {
  const num = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

function statusColor(status: string) {
  const s = status?.toLowerCase() || "";

  if (s.includes("new")) return "#fff3cd";
  if (s.includes("contacted")) return "#d1ecf1";
  if (s.includes("scheduled")) return "#d4edda";
  if (s.includes("waitlist")) return "#f8d7da";
  if (s.includes("not")) return "#e2e3e5";
  if (s.includes("done")) return "#d4edda";
  if (s.includes("open")) return "#fff3cd";
  if (s.includes("pending")) return "#d1ecf1";

  return "#f4f4f4";
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loadError, setLoadError] = useState<string>("");
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;

    async function safeFetch(name: string, url: string) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`${name} failed with status ${res.status}`);
          return { name, text: "", failed: true };
        }
        const text = await res.text();
        return { name, text, failed: false };
      } catch {
        console.warn(`${name} failed to fetch`);
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

      const billing = results[0].text;
      const capacity = results[1].text;
      const employees = results[2].text;
      const tasks = results[3].text;
      const calls = results[4].text;

      const parsed = {
        billing: billing ? parseCSV(billing) : [],
        capacity: capacity ? parseCSV(capacity) : [],
        employees: employees ? parseCSV(employees) : [],
        tasks: tasks ? parseCSV(tasks) : [],
        calls: calls ? parseCSV(calls) : [],
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
        setLoadError(`Some sources failed to load: ${failed.join(", ")}`);
      }

      setData(parsed);
    }

    loadData();
  }, []);

  if (!data) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        Loading dashboard...
      </div>
    );
  }

  const latestBilling = data.billing[0] || {};
  const openTasks = data.tasks.filter(
    (t: any) => (t.status || "").toLowerCase() !== "done"
  );
  const activeCalls = data.calls.filter(
    (c: any) =>
      !["not_interested", "not interested"].includes(
        (c.status || "").toLowerCase()
      )
  );

  return (
    <div
      style={{
        padding: 30,
        fontFamily: "Arial, sans-serif",
        background: "#f7f8fa",
        minHeight: "100vh",
        color: "#222",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>LKS Operations Dashboard</h1>
      <p style={{ marginTop: 0, color: "#666" }}>
        Billing, capacity, employees, tasks, and new calls in one place.
      </p>

      {loadError ? (
        <div
          style={{
            background: "#fff3cd",
            border: "1px solid #ffe69c",
            color: "#664d03",
            padding: 12,
            borderRadius: 10,
            marginTop: 16,
            marginBottom: 20,
          }}
        >
          {loadError}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <div style={card}>
          <h3 style={cardTitle}>Collected</h3>
          <p style={cardValue}>{formatMoney(latestBilling.collected || "0")}</p>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Pending</h3>
          <p style={cardValue}>{formatMoney(latestBilling.pending || "0")}</p>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Expected This Week</h3>
          <p style={cardValue}>
            {formatMoney(latestBilling.expected_this_week || "0")}
          </p>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Open Tasks</h3>
          <p style={cardValue}>{openTasks.length}</p>
        </div>

        <div style={card}>
          <h3 style={cardTitle}>Active Calls</h3>
          <p style={cardValue}>{activeCalls.length}</p>
        </div>
      </div>

      <Section title="New Calls">
        {data.calls.length ? (
          data.calls.map((row: any, i: number) => (
            <div key={i} style={rowStyle}>
              <div>
                <strong>{row.parent_name || "Unknown Parent"}</strong>
                {row.child_name ? ` — ${row.child_name}` : ""}
              </div>
              <div style={subText}>
                Date: {row.date || ""} | Phone: {row.phone || ""} | Service needed:{" "}
                {row.service_needed || ""}
              </div>
              <div style={subText}>
                Source: {row.source || ""} | Assigned to: {row.assigned_to || ""} |
                Follow-up: {row.next_follow_up || ""}
              </div>

              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    ...pill,
                    background: statusColor(row.status || ""),
                  }}
                >
                  {row.status || "unknown"}
                </span>
              </div>

              {row.notes ? <div style={{ marginTop: 8 }}>{row.notes}</div> : null}
            </div>
          ))
        ) : (
          <div style={emptyText}>No calls found.</div>
        )}
      </Section>

      <Section title="Tasks">
        {data.tasks.length ? (
          data.tasks.map((row: any, i: number) => (
            <div key={i} style={rowStyle}>
              <div>
                <strong>{row.task || "Untitled task"}</strong>
              </div>
              <div style={subText}>
                Owner: {row.owner || ""} | Due: {row.due || ""}
              </div>
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    ...pill,
                    background: statusColor(row.status || ""),
                  }}
                >
                  {row.status || "unknown"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div style={emptyText}>No tasks found.</div>
        )}
      </Section>

      <Section title="Capacity">
        {data.capacity.length ? (
          data.capacity.map((row: any, i: number) => (
            <div key={i} style={rowStyle}>
              <div>
                <strong>{row.therapist || "Unknown therapist"}</strong>
              </div>
              <div style={subText}>
                {row.booked_percent || "0"}% booked | Open slots: {row.open_slots || "0"}
              </div>
              <div style={subText}>
                Possible weekly revenue: {formatMoney(row.potential_weekly_revenue || "0")} |
                Actual: {formatMoney(row.actual_weekly_revenue || "0")} | Gap:{" "}
                {formatMoney(row.revenue_gap || "0")}
              </div>
              {row.notes ? <div style={{ marginTop: 6 }}>{row.notes}</div> : null}
            </div>
          ))
        ) : (
          <div style={emptyText}>No capacity data found.</div>
        )}
      </Section>

      <Section title="Employees">
        {data.employees.length ? (
          data.employees.map((row: any, i: number) => (
            <div key={i} style={rowStyle}>
              <div>
                <strong>{row.employee || "Unknown employee"}</strong>
                {row.role ? ` — ${row.role}` : ""}
                {row.status ? ` | ${row.status}` : ""}
              </div>
              <div style={subText}>
                Utilization: {row.utilization_percent || "0"}% | Weekly sessions:{" "}
                {row.weekly_sessions || "0"} | Weekly revenue:{" "}
                {formatMoney(row.weekly_revenue_generated || "0")}
              </div>
              <div style={subText}>
                Salary: {formatMoney(row.salary || "0")} | Cost to company:{" "}
                {formatMoney(row.cost_to_company || "0")}
              </div>
              {row.work_anniversary ? (
                <div style={subText}>Work anniversary: {row.work_anniversary}</div>
              ) : null}
              {row.strengths ? <div style={subText}>Strengths: {row.strengths}</div> : null}
              {row.areas_for_growth ? (
                <div style={subText}>Areas for growth: {row.areas_for_growth}</div>
              ) : null}
              {row.recent_notes ? (
                <div style={{ marginTop: 6 }}>
                  <span
                    style={{
                      ...pill,
                      background: statusColor(row.priority || ""),
                    }}
                  >
                    {row.priority || "note"}
                  </span>{" "}
                  {row.recent_notes}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div style={emptyText}>No employee data found.</div>
        )}
      </Section>

      <Section title="Billing">
        {data.billing.length ? (
          data.billing.map((row: any, i: number) => (
            <div key={i} style={rowStyle}>
              <strong>{row.month || "Unknown month"}</strong> — Billed{" "}
              {formatMoney(row.billed || "0")} | Collected{" "}
              {formatMoney(row.collected || "0")} | Pending{" "}
              {formatMoney(row.pending || "0")}
            </div>
          ))
        ) : (
          <div style={emptyText}>No billing data found.</div>
        )}
      </Section>

      {failedSources.length ? (
        <div style={{ marginTop: 30, color: "#666", fontSize: 12 }}>
          Failed sources: {failedSources.join(", ")}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginTop: 30 }}>
      <h2>{title}</h2>
      <div>{children}</div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#ffffff",
  padding: 16,
  borderRadius: 12,
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: "#666",
};

const cardValue: React.CSSProperties = {
  margin: "8px 0 0 0",
  fontSize: 28,
  fontWeight: 700,
};

const rowStyle: React.CSSProperties = {
  padding: "12px 0",
  borderBottom: "1px solid #ddd",
};

const subText: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginTop: 4,
};

const pill: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 20,
  fontSize: 12,
  display: "inline-block",
};

const emptyText: React.CSSProperties = {
  color: "#666",
  fontStyle: "italic",
};