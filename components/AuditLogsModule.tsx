"use client"
import React, { useState, useMemo } from "react";
import { formatISO, startOfDay, endOfDay } from "date-fns";
import type { AuditLog } from "../services/types";
import { apiService } from "../services/apiService";

export function AuditLogsModule() {
  const [fromDate, setFromDate] = useState(() => formatISO(startOfDay(new Date())).slice(0, 19));
  const [toDate, setToDate] = useState(() => formatISO(endOfDay(new Date())).slice(0, 19));
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const fetchRange = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiService.getAuditLogsByDateRange(fromDate, toDate);
      setLogs(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch audit logs");
    } finally {
      setLoading(false);
    }
  };

  const tryParse = (s: any) => {
    if (s == null) return null;
    if (typeof s === "object") return s;
    if (typeof s !== "string") return String(s);
    const cleaned = s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    try {
      return JSON.parse(cleaned);
    } catch {
      return s;
    }
  };

  const pretty = (s: any) => {
    const p = tryParse(s);
    if (p == null) return "";
    if (typeof p === "string") return p;
    try {
      return JSON.stringify(p, null, 2);
    } catch {
      return String(p);
    }
  };

  const excludedEndpoints = [
    "/api/audit-logs/me",
    "/api/audit-logs/endpoint",
    "/api/audit-logs/date-range",
    "/api/audit-logs/user/"
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const isExcluded = (endpoint?: string) => {
      if (!endpoint) return false;
      const ep = endpoint.toString().toLowerCase();
      if (excludedEndpoints.includes(ep) || ep.startsWith("/api/audit-logs/user/")) return true;
      return false;
    };
    const visibleLogs = logs.filter((l) => !isExcluded(l.endpoint));
    if (!q) return visibleLogs;

    return visibleLogs.filter((l) => {
      const rb = (typeof l.requestBody === "string" ? l.requestBody : JSON.stringify(l.requestBody || "")).toLowerCase();
      const resp = (typeof l.responseBody === "string" ? l.responseBody : JSON.stringify(l.responseBody || "")).toLowerCase();
      const endpoint = (l.endpoint || "").toLowerCase();
      const user = (l.userEmail || "").toLowerCase();
      return rb.includes(q) || resp.includes(q) || endpoint.includes(q) || user.includes(q);
    });
  }, [logs, query]);

  const toggle = (id: number) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Audit Logs</h3>

      {/* Filters Section */}
      <div style={{ 
        position: "sticky", 
        top: 0, 
        zIndex: 20, 
        background: "rgb(255,255,255)", 
        padding: 12, 
        borderBottom: "1px solid #ddd", 
        marginTop: 12, 
        display: "flex", 
        gap: 12, 
        flexWrap: "wrap" 
      }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: 12, color: "#666" }}>From</label>
          <input
            type="datetime-local"
            value={fromDate.slice(0, 19)}
            onChange={(e) => setFromDate(e.target.value)}
            style={{ padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ fontSize: 12, color: "#666" }}>To</label>
          <input
            type="datetime-local"
            value={toDate.slice(0, 19)}
            onChange={(e) => setToDate(e.target.value)}
            style={{ padding: 8, borderRadius: 4, border: "1px solid #ddd" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button onClick={fetchRange} style={{ padding: "8px 16px", background: "#FF6600", color: "#fff", border: "none", borderRadius: 6 }}>
            Fetch
          </button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", minWidth: 260 }}>
          <label style={{ fontSize: 12, color: "#666" }}>Search</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: 8, borderRadius: 4, border: "1px solid #123456" }}
          />
        </div>
      </div>

      {/* Table */}
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ background: "#f4f4f4", textAlign: "left" }}>
            <th style={th}>Timestamp</th>
            <th style={th}>Endpoint</th>
            <th style={th}>Method</th>
            <th style={th}>Status</th>
            <th style={th}>User Email</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((l) => (
            <>
              <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={td}>{new Date(l.createdAt || "").toLocaleString()}</td>
                <td style={td}>{l.endpoint}</td>
                <td style={td}>{l.httpMethod}</td>
                <td style={td}>{l.statusCode}</td>
                <td style={td}>{l.userEmail}</td>
                <td style={td}>
                  <button onClick={() => toggle(l.id)} style={expandBtn}>
                    {expanded[l.id] ? "Hide" : "View"}
                  </button>
                </td>
              </tr>

              {expanded[l.id] && (
                <tr>
                  <td colSpan={6} style={{ background: "#fafafa", padding: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <strong>Request Body</strong>
                        <pre style={preStyle}>{pretty(l.requestBody)}</pre>
                      </div>
                      <div>
                        <strong>Response Body</strong>
                        <pre style={preStyle}>{pretty(l.responseBody)}</pre>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Simple Styles
const th: React.CSSProperties = { padding: 10, fontWeight: 600, fontSize: 13, borderBottom: "2px solid #ddd" };
const td: React.CSSProperties = { padding: 10, fontSize: 13, verticalAlign: "top" };
const expandBtn: React.CSSProperties = { padding: "6px 10px", borderRadius: 6, border: "1px solid #ccc", background: "#fff" };
const preStyle: React.CSSProperties = {
  background: "#fff",
  padding: 10,
  borderRadius: 6,
  maxHeight: 300,
  overflow: "auto",
  fontSize: 12,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
