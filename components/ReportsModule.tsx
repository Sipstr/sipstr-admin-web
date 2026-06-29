// src/components/ReportsModule.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiService } from "@/services/apiService";
import { StoreReportItemDTO, PageResponse } from "@/services/types";
import { PaginationControls } from "./PaginationControls";

/* ------------------ Helpers ------------------ */
function formatDateToDDMMYYYY(isoDate: string) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}

function formatMoney(value?: string | number) {
  if (value === undefined || value === null || value === "") return "-";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ------------------ Toast ------------------ */
function Toast({
  open,
  message,
  type = "info",
  onClose,
}: {
  open: boolean;
  message?: string;
  type?: "info" | "success" | "error";
  onClose: () => void;
}) {
  if (!open || !message) return null;
  const bg = type === "success" ? "#16a34a" : type === "error" ? "#dc2626" : "#0ea5e9";
  return (
    <div
      role="status"
      onClick={onClose}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        background: bg,
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 8,
        boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
        zIndex: 9999,
        cursor: "pointer",
        maxWidth: 420,
      }}
    >
      {message}
    </div>
  );
}

/* ------------------ Component ------------------ */
export function ReportsModule() {
  // store typed name + resolved uuid (uuid kept internal, not shown to user)
  const [storeName, setStoreName] = useState("");
  const [stores, setStores] = useState<{ uuid: string; storeName: string }[]>([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState<string | null>(null);

  // suggestions visibility
  const [showSuggestions, setShowSuggestions] = useState(false);

  // form inputs
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  // results
  const [reports, setReports] = useState<StoreReportItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pagination
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | undefined>();
  const [toastType, setToastType] = useState<"info" | "success" | "error">("info");
  const openToast = (msg: string, type: "info" | "success" | "error" = "info") => {
    setToastMsg(msg);
    setToastType(type);
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 4200);
  };

  // Load stores once (for autocomplete)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await apiService.getStores();
        if (!mounted) return;
        const mapped = (res as any[]).map((s) => ({
          uuid: s.uuid ?? s.storeUuid ?? s.storeId ?? s.id,
          storeName: s.storeName ?? s.name ?? s.store_name ?? s.name ?? "",
        }));
        setStores(mapped.filter((x) => x.storeName));
      } catch (err) {
        console.warn("Failed to load stores for reports autocomplete", err);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // resolve storeName -> uuid whenever storeName changes (exact / prefix)
  useEffect(() => {
    if (!storeName.trim()) {
      setSelectedStoreUuid(null);
      return;
    }
    const lower = storeName.trim().toLowerCase();
    const exact = stores.find((s) => s.storeName.toLowerCase() === lower);
    if (exact) {
      setSelectedStoreUuid(exact.uuid);
      return;
    }
    const prefix = stores.find((s) => s.storeName.toLowerCase().startsWith(lower));
    if (prefix) {
      setSelectedStoreUuid(prefix.uuid);
      return;
    }
    setSelectedStoreUuid(null);
  }, [storeName, stores]);

  const storeSuggestions = useMemo(() => {
    const q = storeName.trim().toLowerCase();
    if (!q) return stores.slice(0, 10);
    return stores.filter((s) => s.storeName.toLowerCase().includes(q)).slice(0, 12);
  }, [storeName, stores]);

  // validation
  const validateForm = () => {
    setError(null);
    if (!selectedStoreUuid) {
      setError("Please select a valid store from suggestions.");
      return false;
    }
    if (!dateRange.start || !dateRange.end) {
      setError("Please provide both start and end dates.");
      return false;
    }
    if (dateRange.start > dateRange.end) {
      setError("Start date must be before or equal to end date.");
      return false;
    }
    return true;
  };

  // generate first page
const generateReport = async () => {
  setError(null);

  // FORM VALIDATION
  if (!validateForm()) {
    openToast("Validation failed", "error");
    return;
  }

  setLoading(true);

  try {
    const start = formatDateToDDMMYYYY(dateRange.start);
    const end = formatDateToDDMMYYYY(dateRange.end);

    const resp = (await apiService.getReports(
      selectedStoreUuid!,
      start,
      end,
      0,
      size
    )) as PageResponse<StoreReportItemDTO>;

    setReports(resp.content ?? []);
    setPage(resp.number ?? 0);
    setTotalPages(resp.totalPages ?? 0);
    setTotalElements(resp.totalElements ?? 0);

  } catch (err: any) {
    console.error("Failed to fetch reports:", err);

    // Extract meaningful error message
    const status = err?.response?.status;
    const backendMsg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message;

    const shortMsg =
      backendMsg ||
      (status ? `Request failed with status ${status}` : "Failed to load reports");

    setError(shortMsg);
    openToast(shortMsg, "error");
    setReports([]);

    // OPTIONALLY log full detail (not shown to user)
    const fullLog = safeStringify(err?.response?.data);
    console.log("Backend error payload:", fullLog);

  } finally {
    setLoading(false);
  }
};

// Helper for safe JSON stringify (avoids crashes)
function safeStringify(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}


  const loadPage = async (pageToLoad: number) => {
    if (!validateForm()) return;
    setLoading(true);
    setError(null);
    try {
      const start = formatDateToDDMMYYYY(dateRange.start);
      const end = formatDateToDDMMYYYY(dateRange.end);
      const resp = (await apiService.getReports(selectedStoreUuid!, start, end, pageToLoad, size)) as PageResponse<
        StoreReportItemDTO
      >;
      setReports(resp.content ?? []);
      setPage(resp.number ?? pageToLoad);
      setTotalPages(resp.totalPages ?? 0);
      setTotalElements(resp.totalElements ?? 0);
    } catch (err: any) {
      console.error("Pagination load failed:", err);
      const msg = (err && (err.message || err?.response?.data?.message)) ?? "Failed to load page";
      setError(String(msg));
      openToast(String(msg), "error");
    } finally {
      setLoading(false);
    }
  };

  // whether generate button should be enabled
  const isFormValid = Boolean(selectedStoreUuid && dateRange.start && dateRange.end && dateRange.start <= dateRange.end);

  return (
    <div className="page-container-sidebar page-content">
      <div className="page-header">
        <h2 className="page-title">Reports</h2>
        <p className="page-subtitle">Generate store-level financial and order status reports.</p>
      </div>

      <div className="page-section">
        <div className="page-section-content">
        <h3 className="text-base font-semibold text-gray-800 mb-4">Generate Store Report</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div style={{ position: "relative" }}>
            <label style={{ display: "block", marginBottom: 5, fontSize: 14, fontWeight: 500 }}>Store Name</label>
            <input
              type="text"
              placeholder="Type store name and pick from suggestions"
              value={storeName}
              onChange={(e) => {
                setStoreName(e.target.value);
                setShowSuggestions(true);
                setError(null);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => {
                // allow click on suggestion
                setTimeout(() => setShowSuggestions(false), 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const candidate =
                    stores.find((s) => s.storeName.toLowerCase() === storeName.trim().toLowerCase()) ??
                    stores.find((s) => s.storeName.toLowerCase().startsWith(storeName.trim().toLowerCase()));
                  if (candidate) {
                    setSelectedStoreUuid(candidate.uuid);
                    setStoreName(candidate.storeName);
                    openToast(`Resolved store "${candidate.storeName}"`, "success");
                  } else {
                    setSelectedStoreUuid(null);
                    openToast("Store not found — please choose from suggestions.", "error");
                  }
                  setShowSuggestions(false);
                }
              }}
              className="filter-input w-full"
            />

            {/* Suggestion dropdown now positioned with calc(100% + small gap) so it won't overlay input */}
            {showSuggestions && storeSuggestions.length > 0 && storeName.trim() !== "" && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "1px solid #ddd",
                  zIndex: 1200,
                  maxHeight: "220px",
                  overflowY: "auto",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
                  borderRadius: 6,
                }}
              >
                {storeSuggestions.map((s, i) => (
                  <div
                    key={i}
                    onMouseDown={(ev) => {
                      // prevent blur -> select safely
                      ev.preventDefault();
                      setStoreName(s.storeName);
                      setSelectedStoreUuid(s.uuid);
                      setShowSuggestions(false);
                      openToast(`Selected "${s.storeName}"`, "success");
                    }}
                    style={{ padding: "8px 10px", cursor: "pointer", borderBottom: "1px solid #f7f7f7" }}
                  >
                    {/* only show store name (no UUID) as requested */}
                    <div style={{ fontSize: 14 }}>{s.storeName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 5, fontSize: 14, fontWeight: 500 }}>Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="filter-input w-full"
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 5, fontSize: 14, fontWeight: 500 }}>End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="filter-input w-full"
            />
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button
            onClick={generateReport}
            disabled={loading || !isFormValid}
            className="primary-btn"
            style={{ cursor: loading || !isFormValid ? "not-allowed" : "pointer", opacity: loading || !isFormValid ? 0.6 : 1 }}
          >
            {loading ? "Generating..." : "Generate Report"}
          </button>
        </div>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: "#fee", color: "#c33", padding: 12, borderRadius: 4, marginBottom: 20 }}>{error}</div>
      )}

      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr className="table-head-row">
              <th className="table-head-cell">Store</th>
              <th className="table-head-cell">Order</th>
              <th className="table-head-cell">Subtotal</th>
              <th className="table-head-cell">Store Total</th>
              <th className="table-head-cell">Net Total</th>
              <th className="table-head-cell">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-gray-500 py-6">
                  Loading...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center text-gray-500 py-6">
                  No reports available
                </td>
              </tr>
            ) : (
              reports.map((r, idx) => (
                <tr key={`${r.orderUuid ?? idx}`} className="table-row table-row-hover">
                  <td className="table-cell">{r.storeName}</td>
                  <td className="table-cell">{r.orderUuid}</td>
                  <td className="table-cell">{formatMoney(r.subtotal)}</td>
                  <td className="table-cell">{formatMoney(r.storeTotal)}</td>
                  <td className="table-cell">{formatMoney(r.netTotal)}</td>
                  <td className="table-cell">{r.storeStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }}>
        <PaginationControls
          page={page + 1}
          totalPages={Math.max(totalPages, 1)}
          totalItems={totalElements}
          pageSize={size}
          onPageChange={(nextPage) => loadPage(nextPage - 1)}
          showPageSize={false}
          disabled={loading}
        />
      </div>

      <Toast open={toastOpen} message={toastMsg} type={toastType} onClose={() => setToastOpen(false)} />
    </div>
  );
}
