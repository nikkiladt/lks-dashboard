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

function looksLikePercent(label: string, value: string) {
  const l = label.toLowerCase();
  return /percent|percentage|utilization|booked/.test(l) && isNumericLike(value);
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

  if (looksLikePercent(label, value)) {
    const num = Number(String(value).replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(num)) return value;
    return `${num}%`;
  }

  return value;
}

function prettyLabel(label: string) {
  return label
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusColor(status: string) {
  const s = status?.toLowerCase() || "";

  if (s.includes("new")) return "#fff3cd";
  if (s.includes("contacted")) return "#dbeafe";
  if (s.includes("scheduled")) return "#dcfce7";
  if (s.includes("assessment")) return "#dcfce7";
  if (s.includes("waitlist")) return "#fee2e2";
  if (s.includes("not")) return "#e5e7eb";
  if (s.includes("done")) return "#dcfce7";
  if (s.includes("open")) return "#fff3cd";
  if (s.includes("pending")) return "#dbeafe";
  if (s.includes("high")) return "#fee2e2";
  if (s.includes("medium")) return "#fff3cd";
  if (s.includes("low")) return "#dcfce7";

  return "#f3f4f6";
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
        if (!res.ok) {
          return { name, text: "", failed: true };
        }
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
  const activeCalls = data.calls.filter((row) => {
    const status = (row.status || "").toLowerCase();
    return !["not interested", "not_interested"].includes(status);
  });

  const openTasks = data.tasks.filter((row) => {
    const status = (row.status || "").toLowerCase();
    return status !== "done";
  });

  return (
    <div
      style={{
        padding: 32,
        fontFamily: "Arial, sans-serif",
        background: "#f8fafc",
        minHeight: "100vh",
        color: "#111827",
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700 }}>LKS Operations Dashboard</h1>
        <p style={{ marginTop: 8, color: "#6b7280", fontSize: 16 }}>
          A clear view of billing, calls, staffing, and open items.
        </p>
      </div>

      {loadError ? (
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            color: "#92400e",
            padding: 14,
            borderRadius: 14,
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          {loadError}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        {billingCards.map((card, i) => (
          <MetricCard key={i} title={card.label} value={card.value} />
        ))}
        <MetricCard title="Open Tasks" value={String(openTasks.length)} />
        <MetricCard title="Active Calls" value={String(activeCalls.length)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 20, marginBottom: 20 }}>
        <CardSection title="New Calls">
          {data.calls.length ? (
            data.calls.map((row, i) => (
              <div key={i} style={callCard}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>
                      {row.child_name || row.parent_name || "New Inquiry"}
                    </div>
                    <div style={{ color: "#6b7280", marginTop: 4 }}>
                      {row.parent_name || "No parent listed"}
                    </div>
                  </div>
                  {row.status ? (
                    <span style={{ ...pill, background: statusColor(row.status) }}>{row.status}</span>
                  ) : null}
                </div>

                <div style={detailsGrid}>
                  {row.date ? <div><strong>Date:</strong> {row.date}</div> : null}
                  {row.phone ? <div><strong>Phone:</strong> {row.phone}</div> : null}
                  {row.service_needed ? <div><strong>Service:</strong> {row.service_needed}</div> : null}
                  {row.assigned_to ? <div><strong>Assigned:</strong> {row.assigned_to}</div> : null}
                  {row.next_follow_up ? <div><strong>Follow-Up:</strong> {row.next_follow_up}</div> : null}
                  {row.source ? <div><strong>Source:</strong> {row.source}</div> : null}
                </div>

                {row.notes ? (
                  <div style={{ marginTop: 12, color: "#374151" }}>
                    <strong>Notes:</strong> {row.notes}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState text="No calls found." />
          )}
        </CardSection>

        <CardSection title="Tasks">
          {data.tasks.length ? (
            data.tasks.map((row, i) => (
              <div key={i} style={simpleRow}>
                <div>
                  <div style={{ fontWeight: 600 }}>{row.task || "Untitled Task"}</div>
                  <div style={{ color: "#6b7280", fontSize: 13, marginTop: 3 }}>
                    {row.owner ? `Owner: ${row.owner}` : ""}
                    {row.owner && row.due ? " • " : ""}
                    {row.due ? `Due: ${row.due}` : ""}
                  </div>
                </div>
                {row.status ? (
                  <span style={{ ...pill, background: statusColor(row.status) }}>{row.status}</span>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState text="No tasks found." />
          )}
        </CardSection>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <CardSection title="Capacity">
          {data.capacity.length ? (
            data.capacity.map((row, i) => (
              <div key={i} style={simpleRow}>
                <div>
                  <div style={{ fontWeight: 600 }}>{row.therapist || "Unknown Therapist"}</div>
                  <div style={{ color: "#6b7280", fontSize: 13, marginTop: 3 }}>
                    {row.booked_percent ? `${row.booked_percent}% booked` : ""}
                    {row.open_slots ? ` • Open slots: ${row.open_slots}` : ""}
                  </div>
                  <div style={{ color: "#374151", fontSize: 13, marginTop: 6 }}>
                    {row.revenue_gap ? `Revenue gap: ${formatValue("revenue_gap", row.revenue_gap)}` : ""}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState text="No capacity data found." />
          )}
        </CardSection>

        <CardSection title="Employees">
          {data.employees.length ? (
            data.employees.map((row, i) => (
              <div key={i} style={simpleRow}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {row.employee || "Unknown Employee"}
                    {row.role ? ` — ${row.role}` : ""}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13, marginTop: 3 }}>
                    {row.status || ""}
                    {row.utilization_percent ? ` • ${row.utilization_percent}% utilization` : ""}
                  </div>
                  {row.recent_notes ? (
                    <div style={{ color: "#374151", fontSize: 13, marginTop: 6 }}>{row.recent_notes}</div>
                  ) : null}
                </div>
                {row.priority ? (
                  <span style={{ ...pill, background: statusColor(row.priority) }}>{row.priority}</span>
                ) : null}
              </div>
            ))
          ) : (
            <EmptyState text="No employee data found." />
          )}
        </CardSection>
      </div>

      {failedSources.length ? (
        <div style={{ marginTop: 24, color: "#6b7280", fontSize: 12 }}>
          Could not load: {failedSources.join(", ")}
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: 20,
        boxShadow: "0 1px 8px rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ color: "#6b7280", fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ marginTop: 10, fontSize: 30, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function CardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#ffffff",
        borderRadius: 18,
        padding: 20,
        boxShadow: "0 1px 8px rgba(15,23,42,0.06)",
      }}
    >
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 22 }}>{title}</h2>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ color: "#6b7280", fontStyle: "italic" }}>{text}</div>;
}

const pill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  color: "#111827",
  whiteSpace: "nowrap",
};

const simpleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "14px 0",
  borderBottom: "1px solid #e5e7eb",
};

const callCard: React.CSSProperties = {
  padding: 16,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  marginBottom: 14,
  background: "#fcfcfd",
};

const detailsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  marginTop: 14,
  fontSize: 13,
  color: "#374151",
};