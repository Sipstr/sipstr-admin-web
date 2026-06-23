"use client"
import React, { useState, useMemo } from "react";
import { formatISO, startOfDay, endOfDay } from "date-fns";
import type { AuditLog } from "../services/types";
import { apiService } from "../services/apiService";
import { DataTable, ColumnDef, DataTableAction } from "./DataTable";

const EXCLUDED_ENDPOINTS = [
  "/api/audit-logs/me",
  "/api/audit-logs/endpoint",
  "/api/audit-logs/date-range",
  "/api/audit-logs/user/",
];

export function AuditLogsModule() {
  const [fromDate, setFromDate] = useState(() => formatISO(startOfDay(new Date())).slice(0, 19));
  const [toDate, setToDate] = useState(() => formatISO(endOfDay(new Date())).slice(0, 19));
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

  const visibleLogs = useMemo(() => {
    const isExcluded = (endpoint?: string) => {
      if (!endpoint) return false;
      const ep = endpoint.toString().toLowerCase();
      if (EXCLUDED_ENDPOINTS.includes(ep) || ep.startsWith("/api/audit-logs/user/")) return true;
      return false;
    };
    return logs.filter((l) => !isExcluded(l.endpoint));
  }, [logs]);

  const toggle = (id: number) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const AUDIT_COLUMNS: ColumnDef<AuditLog>[] = [
    { key: "createdAt", label: "Timestamp", getValue: (l) => l.createdAt ? new Date(l.createdAt).toLocaleString() : "-" },
    { key: "endpoint", label: "Endpoint", getValue: (l) => l.endpoint ?? "-" },
    { key: "httpMethod", label: "Method", getValue: (l) => l.httpMethod ?? "-", render: (val) => <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">{val}</span> },
    { key: "statusCode", label: "Status", getValue: (l) => l.statusCode ?? "-", render: (val) => { const n = Number(val); const color = n >= 400 ? "bg-red-100 text-red-700" : n >= 300 ? "bg-yellow-100 text-yellow-700" : "bg-emerald-100 text-emerald-700"; return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${color}`}>{val}</span>; } },
    { key: "userEmail", label: "User Email", getValue: (l) => l.userEmail ?? "-" },
  ];

  const actions: DataTableAction<AuditLog>[] = [
    { label: "View", onClick: (l) => toggle(l.id) },
  ];

  return (
    <div className="page-container-sidebar page-content space-y-5">
      <div className="page-header">
        <h2 className="page-title">Audit Logs</h2>
        <p className="page-subtitle">View API audit trails by date range.</p>
      </div>

      {/* Date Range Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              type="datetime-local"
              value={fromDate.slice(0, 19)}
              onChange={(e) => setFromDate(e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              type="datetime-local"
              value={toDate.slice(0, 19)}
              onChange={(e) => setToDate(e.target.value)}
              className="filter-input"
            />
          </div>
          <button onClick={fetchRange} className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors h-10">
            Fetch
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm rounded-lg px-3 py-2 border text-red-700 bg-red-50 border-red-200">{error}</div>
      )}

      {/* DataTable */}
      <DataTable<AuditLog>
        storageKey="audit-logs"
        columns={AUDIT_COLUMNS}
        defaultVisibleColumns={["createdAt", "endpoint", "httpMethod", "statusCode", "userEmail"]}
        data={visibleLogs}
        getRowId={(l) => String(l.id)}
        loading={loading}
        actions={actions}
        searchPlaceholder="Search by endpoint, user email, request/response body..."
        emptyMessage="No audit logs found. Select a date range and click Fetch."
      />

      {/* Expanded detail panels */}
      {Object.entries(expanded).filter(([, v]) => v).map(([id]) => {
        const log = visibleLogs.find((l) => l.id === Number(id));
        if (!log) return null;
        return (
          <div key={id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
                Log #{log.id} — {log.endpoint} [{log.httpMethod}]
              </h4>
              <button onClick={() => toggle(log.id)} className="text-xs text-gray-500 hover:text-gray-700 underline">Close</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Request Body</p>
                <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words border border-gray-100">{pretty(log.requestBody)}</pre>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-600 mb-1">Response Body</p>
                <pre className="bg-gray-50 p-3 rounded-lg text-xs overflow-auto max-h-64 whitespace-pre-wrap break-words border border-gray-100">{pretty(log.responseBody)}</pre>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
