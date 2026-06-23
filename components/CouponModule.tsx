"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiService } from "@/services/apiService";
import {
  OfferDetailRequest,
  OfferDetailResponse,
  OfferDetailRequest as OfferDetailRequestType,
} from "@/services/types";
import { PaginationControls } from "./PaginationControls";
import { Pencil, Trash2, ToggleLeft, ToggleRight, Eye } from "lucide-react";

/* ---------- helpers ---------- */
function toBackendDateString(datetimeLocal?: string | null): string {
  if (!datetimeLocal) return "";
  const [datePart, timePartRaw] = datetimeLocal.split("T");
  if (!datePart || !timePartRaw) return datetimeLocal;

  const [year, month, day] = datePart.split("-");

  const timeParts = timePartRaw.split(":");
  const hh = timeParts[0] ?? "00";
  const mm = timeParts[1] ?? "00";
  const ss = timeParts[2] ?? "00";

  return `${pad(day)}-${pad(month)}-${year} ${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function formatDate(dt?: string) {
  if (!dt) return "-";
  try {
    const d = new Date(dt);
    if (isNaN(d.getTime())) return String(dt);
    return d.toLocaleString();
  } catch {
    return String(dt);
  }
}

function pad(s: string | number) {
  const str = String(s);
  return str.length === 1 ? `0${str}` : str;
}

type SortDirection = "asc" | "desc";

function compareValues(a: unknown, b: unknown) {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/* ---------- component ---------- */
export function CouponsModule() {
  const [storeId, setStoreId] = useState<string>("");
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form & Modal
  const [showForm, setShowForm] = useState(false);
  const [isGlobalOffer, setIsGlobalOffer] = useState(false);

  const initialForm: OfferDetailRequestType = {
    offerId: undefined,
    storeId: undefined,
    name: "",
    type: "FLAT",
    method: "COUPON",
    startDateTime: "",
    endDateTime: "",
    discount: 0,
    allowedMaxDiscount: 0,
    minSpendAmount: 0,
    maxTotalUsage: 0,
    requiredVoucherCount: 0,
    description: "",
    couponDetail: null,
  };
  const [form, setForm] = useState<OfferDetailRequestType>(initialForm);
  const [isEditing, setIsEditing] = useState(false);

  // Consumption modal
  const [showConsumption, setShowConsumption] = useState(false);
  const [consumption, setConsumption] = useState<OfferDetailResponse | null>(null);
  const [consumptionLoading, setConsumptionLoading] = useState(false);

  // Pagination
  const [offersPage, setOffersPage] = useState(1);
  const [offersPageSize, setOffersPageSize] = useState(20);
  const [consumptionPage, setConsumptionPage] = useState(1);
  const [consumptionPageSize, setConsumptionPageSize] = useState(10);

  // Search & Sort & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [sortState, setSortState] = useState<{ key: string; dir: SortDirection } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return ["offerId", "name", "method", "type", "couponCode", "discount", "startDateTime", "endDateTime", "status"];
    try {
      const saved = window.localStorage.getItem("offers-visible-columns-v1");
      if (saved) { const p = JSON.parse(saved); if (Array.isArray(p) && p.length > 0) return p; }
    } catch {}
    return ["offerId", "name", "method", "type", "couponCode", "discount", "startDateTime", "endDateTime", "status"];
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("offers-visible-columns-v1", JSON.stringify(visibleColumnKeys)); } catch {}
  }, [visibleColumnKeys]);

  const ALL_COLUMNS = [
    { key: "offerId", label: "ID" },
    { key: "name", label: "Name" },
    { key: "method", label: "Method" },
    { key: "type", label: "Type" },
    { key: "couponCode", label: "Code" },
    { key: "discount", label: "Discount" },
    { key: "startDateTime", label: "Start" },
    { key: "endDateTime", label: "End" },
    { key: "status", label: "Status" },
  ];

  const COLUMNS = useMemo(() => ALL_COLUMNS.filter((c) => visibleColumnKeys.includes(c.key)), [visibleColumnKeys]);

  const toggleColumn = (key: string) => {
    setVisibleColumnKeys((prev) => {
      if (prev.includes(key)) { if (prev.length === 1) return prev; return prev.filter((k) => k !== key); }
      return [...prev, key];
    });
  };

  useEffect(() => {
    if (!error) return;
    setBanner({ type: "error", message: error });
    setError(null);
  }, [error]);

  /* ---------- load offers & normalize ---------- */
  async function loadGlobalOffers() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getAllGlobalOffers();
      const normalized = (Array.isArray(data) ? data : []).map((o: any) => ({
        offerId: o.offerId,
        storeId: o.storeId,
        name: o.offerName ?? o.name ?? "",
        method: o.method,
        type: o.type,
        startDateTime: o.startDateTime,
        endDateTime: o.endDateTime,
        isActive: o.isActive,
        status: o.isActive ? "Active" : "Inactive",
        discount: o.discount ?? null,
        couponCode: o.offerCode ?? (o.coupons?.couponCode ?? null),
        couponId: o.couponId ?? (o.coupons?.couponId ?? null),
        raw: o,
      }));
      setOffers(normalized);
      setOffersPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load global offers");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadOffersForStore(sid?: string) {
    setLoading(true);
    setError(null);
    try {
      const id = sid ?? storeId;
      if (!id) {
        setOffers([]);
        setError("Please enter a store id to search offers.");
        return;
      }
      const parsedId = Number(id);
      const data = await apiService.getAllOffers(parsedId);
      const normalized = (Array.isArray(data) ? data : []).map((o: any) => ({
        offerId: o.offerId,
        storeId: o.storeId,
        name: o.offerName ?? o.name ?? "",
        method: o.method,
        type: o.type,
        startDateTime: o.startDateTime,
        endDateTime: o.endDateTime,
        isActive: o.isActive,
        status: o.isActive ? "Active" : "Inactive",
        discount: o.discount ?? null,
        couponCode: o.offerCode ?? (o.coupons?.couponCode ?? null),
        couponId: o.couponId ?? (o.coupons?.couponId ?? null),
        raw: o,
      }));
      setOffers(normalized);
      setOffersPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offers");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }

  /* ---------- create flow ---------- */
  function openCreate() {
    setForm(initialForm);
    setIsEditing(false);
    setIsGlobalOffer(false);
    setShowForm(true);
  }

  function openSipstrCreate() {
    setForm({ ...initialForm, storeId: undefined });
    setIsEditing(false);
    setIsGlobalOffer(true);
    setShowForm(true);
  }

  /* ---------- edit flow ---------- */
  async function openEdit(offer: any) {
    if (!offer?.offerId) return;
    setEditLoading(true);
    setError(null);
    try {
      const detail = await apiService.getOfferDetailView(offer.offerId);
      const toInputValue = (s?: string | null) => {
        if (!s) return "";
        return s.length >= 16 ? s.slice(0, 16) : s.replace(" ", "T").slice(0, 16);
      };
      const couponObj = detail.coupons ?? detail.coupon ?? null;
      const couponId = couponObj?.couponId ?? detail.couponId ?? undefined;
      const couponCode = couponObj?.couponCode ?? detail.offerCode ?? detail.couponCode ?? "";
      const websiteMsg = couponObj?.websiteDisplayMsg ?? couponObj?.websiteDisplayMessage ?? detail.websiteDisplayMsg ?? "";

      const mapped: OfferDetailRequestType = {
        offerId: detail.offerId ?? offer.offerId,
        storeId: detail.storeId ?? offer.storeId ?? undefined,
        name: detail.offerName ?? detail.name ?? "",
        type: (detail.type ?? offer.type ?? "FLAT") as any,
        method: (detail.method ?? offer.method ?? "COUPON") as any,
        startDateTime: toInputValue(detail.startDateTime ?? detail.start_date_time ?? detail.start),
        endDateTime: toInputValue(detail.endDateTime ?? detail.end_date_time ?? detail.end),
        discount: detail.discount ?? offer.discount ?? 0,
        allowedMaxDiscount: detail.allowedMaxDiscount ?? detail.allowed_max_discount ?? 0,
        minSpendAmount: detail.minSpendAmount ?? detail.min_spend_amount ?? 0,
        maxTotalUsage: detail.maxTotalUsage ?? detail.max_total_usage ?? 0,
        requiredVoucherCount: detail.requiredVoucherCount ?? detail.required_voucher_count ?? 0,
        description: detail.description ?? "",
        couponDetail:
          couponId || couponCode || websiteMsg
            ? {
                id: couponId,
                offerId: detail.offerId,
                code: couponCode ?? "",
                websiteDisplayMessage: websiteMsg ?? "",
                maxUsagePerUser: couponObj?.maxUsagePerUser ?? couponObj?.max_usage_per_user ?? 0,
                totalUsabilityCount: couponObj?.usabilityCount ?? couponObj?.usability_count ?? 0,
                usabilityOption: couponObj?.usabilityOptions ?? couponObj?.usabilityOption ?? undefined,
              }
            : null,
      };

      setForm(mapped);
      setIsEditing(true);
      setIsGlobalOffer(mapped.storeId === undefined || mapped.storeId === null);
      setShowForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offer detail for edit");
    } finally {
      setEditLoading(false);
    }
  }

  /* ---------- submit ---------- */
  async function handleSubmit() {
    setError(null);
    if (!form.name?.trim()) { setError("Offer name is required"); return; }
    if (!form.method) { setError("Offer method is required"); return; }
    if (!form.startDateTime || !form.endDateTime) { setError("Start and end date/time are required"); return; }

    const payload: OfferDetailRequest = {
      ...form,
      storeId: isGlobalOffer ? undefined : form.storeId ?? (storeId ? Number(storeId) : undefined),
      startDateTime: toBackendDateString(form.startDateTime),
      endDateTime: toBackendDateString(form.endDateTime),
      discount: form.discount ?? 0,
      allowedMaxDiscount: form.allowedMaxDiscount ?? 0,
      minSpendAmount: form.minSpendAmount ?? 0,
      maxTotalUsage: form.maxTotalUsage ?? 0,
      requiredVoucherCount: form.requiredVoucherCount ?? 0,
      couponDetail:
        form.method === "COUPON" && form.couponDetail
          ? {
              id: (form.couponDetail as any).couponId ?? undefined,
              offerId: form.offerId ?? 0,
              code: (form.couponDetail as any).couponCode ?? "",
              websiteDisplayMessage: (form.couponDetail as any).websiteDisplayMsg ?? (form.couponDetail as any).websiteDisplayMessage ?? "",
              maxUsagePerUser: (form.couponDetail as any).maxUsagePerUser ?? 0,
              totalUsabilityCount: (form.couponDetail as any).usabilityCount ?? (form.couponDetail as any).totalUsabilityCount ?? 0,
              usabilityOption: (form.couponDetail as any).usabilityOptions ?? (form.couponDetail as any).usabilityOption ?? undefined,
            }
          : null,
    };

    try {
      if (isEditing && payload.offerId) {
        await apiService.updateOffer(payload);
      } else {
        await apiService.createOffer(payload);
      }
      if (isGlobalOffer) { await loadGlobalOffers(); } else {
        const reloadStoreId = payload.storeId ?? (storeId ? Number(storeId) : undefined);
        if (reloadStoreId) await loadOffersForStore(String(reloadStoreId));
      }
      setBanner({ type: "success", message: isEditing ? "Offer updated successfully." : "Offer created successfully." });
      setShowForm(false);
      setIsEditing(false);
      setIsGlobalOffer(false);
      setForm(initialForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save offer");
    }
  }

  /* ---------- delete / toggle / consumption ---------- */
  async function handleDelete(offerId: number) {
    if (!confirm("Are you sure you want to delete this offer?")) return;
    try {
      await apiService.deleteOffer(offerId);
      if (isGlobalOffer) await loadGlobalOffers(); else if (storeId) await loadOffersForStore(storeId);
      setOffers((prev) => prev.filter((x) => x.offerId !== offerId));
      setBanner({ type: "success", message: "Offer deleted." });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete offer");
    }
  }

  async function handleToggle(offerId: number) {
    try {
      setOffers((prev) => prev.map((o) => o.offerId === offerId ? { ...o, isActive: !o.isActive, status: !o.isActive ? "Active" : "Inactive" } : o));
      await apiService.toggleOfferStatus(offerId);
      if (isGlobalOffer) await loadGlobalOffers(); else if (storeId) await loadOffersForStore(storeId);
    } catch (err) {
      setOffers((prev) => prev.map((o) => o.offerId === offerId ? { ...o, isActive: !o.isActive, status: !o.isActive ? "Active" : "Inactive" } : o));
      setError(err instanceof Error ? err.message : "Failed to toggle offer status");
    }
  }

  async function openConsumptionModal(offerId: number) {
    setConsumptionLoading(true);
    setShowConsumption(true);
    try {
      const data = await apiService.getConsumptionHistory(offerId);
      setConsumption(data);
    } catch (error: any) {
      const message = error?.response?.data?.message ?? error?.message ?? "Offer has not been used by any user yet.";
      setShowConsumption(false);
      setConsumption(null);
      setBanner({ type: "error", message });
    } finally {
      setConsumptionLoading(false);
    }
  }

  /* ---------- sorting / filtering / pagination ---------- */
  const filteredOffers = useMemo(() => {
    let rows = [...offers];
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      rows = rows.filter((o) =>
        Object.values(o).some((v) => String(v ?? "").toLowerCase().includes(q))
      );
    }
    Object.entries(columnFilters).forEach(([key, filter]) => {
      if (!filter) return;
      rows = rows.filter((o) => String(o[key] ?? "").toLowerCase().includes(filter.toLowerCase()));
    });
    return rows;
  }, [offers, searchTerm, columnFilters]);

  const sortedOffers = useMemo(() => {
    if (!sortState) return filteredOffers;
    const copy = [...filteredOffers];
    copy.sort((a, b) => {
      const compared = compareValues(a[sortState.key], b[sortState.key]);
      return sortState.dir === "asc" ? compared : -compared;
    });
    return copy;
  }, [filteredOffers, sortState]);

  const offersTotalPages = Math.max(1, Math.ceil(sortedOffers.length / offersPageSize));
  const pagedOffers = useMemo(() => {
    const start = (offersPage - 1) * offersPageSize;
    return sortedOffers.slice(start, start + offersPageSize);
  }, [sortedOffers, offersPage, offersPageSize]);

  useEffect(() => {
    setOffersPage((p) => Math.min(Math.max(1, p), offersTotalPages));
  }, [offersTotalPages]);

  const consumptionUsers = consumption?.users ?? [];
  const consumptionTotalPages = Math.max(1, Math.ceil(consumptionUsers.length / consumptionPageSize));
  const pagedConsumptionUsers = useMemo(() => {
    const start = (consumptionPage - 1) * consumptionPageSize;
    return consumptionUsers.slice(start, start + consumptionPageSize);
  }, [consumptionUsers, consumptionPage, consumptionPageSize]);

  useEffect(() => { setConsumptionPage(1); }, [showConsumption, consumption?.offerId, consumptionPageSize]);
  useEffect(() => { setConsumptionPage((p) => Math.min(Math.max(1, p), consumptionTotalPages)); }, [consumptionTotalPages]);

  const onToggleSort = (key: string) => {
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const setFilterValue = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  /* ---------- render ---------- */
  return (
    <div className="page-container-sidebar page-content space-y-5">
      <div className="page-header">
        <h2 className="page-title">Offers & Coupons</h2>
        <p className="page-subtitle">Manage store offers, global Sipstr offers, and coupons.</p>
      </div>

      {/* Action bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            className="filter-input w-full md:w-64"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            placeholder="Enter Store ID (number)"
          />
          <button onClick={() => loadOffersForStore()} className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors">
            Search Store
          </button>
          <button onClick={() => loadGlobalOffers()} className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 text-white hover:bg-gray-700 transition-colors">
            Load Global
          </button>
          <div className="flex-1" />
          <button onClick={openCreate} className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600 transition-colors">
            + Store Offer
          </button>
          <button onClick={openSipstrCreate} className="px-4 py-2 rounded-lg text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-colors">
            + Sipstr Offer
          </button>
        </div>
      </div>

      {/* Search + Column Picker */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 md:items-center">
        <input
          className="filter-input flex-1"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search offers by name, code, method..."
        />
        <div className="relative">
          <button onClick={() => setShowColumnPicker((p) => !p)} className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Columns
          </button>
          {showColumnPicker && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-30 min-w-[180px]">
              {ALL_COLUMNS.map((col) => (
                <label key={col.key} className="flex items-center gap-2 py-1 text-sm cursor-pointer hover:bg-gray-50 px-1 rounded">
                  <input type="checkbox" checked={visibleColumnKeys.includes(col.key)} onChange={() => toggleColumn(col.key)} className="rounded border-gray-300" />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Banner */}
      {banner && (
        <div className={`text-sm rounded-lg px-3 py-2 border flex items-center justify-between ${banner.type === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}>
          <span>{banner.message}</span>
          <button onClick={() => setBanner(null)} className="ml-3 text-xs font-semibold opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr className="table-head-row">
              {COLUMNS.map((col) => {
                const isCurrent = sortState?.key === col.key;
                const arrow = !isCurrent ? "↕" : sortState?.dir === "asc" ? "↑" : "↓";
                return (
                  <th key={col.key} className="table-head-cell">
                    <button className="inline-flex items-center gap-1 hover:text-orange-600" onClick={() => onToggleSort(col.key)}>
                      <span>{col.label}</span>
                      <span className="text-xs">{arrow}</span>
                    </button>
                  </th>
                );
              })}
              <th className="table-head-cell">Actions</th>
            </tr>
            <tr className="table-head-row">
              {COLUMNS.map((col) => (
                <th key={`${col.key}-filter`} className="table-head-cell py-2 normal-case">
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                    value={columnFilters[col.key] ?? ""}
                    onChange={(e) => setFilterValue(col.key, e.target.value)}
                    placeholder="Filter"
                  />
                </th>
              ))}
              <th className="table-head-cell py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length + 1} className="table-cell text-center text-gray-500 py-6">Loading offers...</td></tr>
            ) : pagedOffers.length === 0 ? (
              <tr><td colSpan={COLUMNS.length + 1} className="table-cell text-center text-gray-500 py-6">No offers found. Search by store ID or load global offers.</td></tr>
            ) : (
              pagedOffers.map((o) => (
                <tr key={o.offerId} className="table-row table-row-hover">
                  <td className="table-cell">{o.offerId}</td>
                  <td className="table-cell font-medium">{o.name || "-"}</td>
                  <td className="table-cell">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{o.method}</span>
                  </td>
                  <td className="table-cell">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">{o.type}</span>
                  </td>
                  <td className="table-cell text-gray-600">{o.couponCode ?? "-"}</td>
                  <td className="table-cell text-gray-600">{o.discount ?? "-"}</td>
                  <td className="table-cell text-gray-600 text-xs">{o.startDateTime ? formatDate(o.startDateTime) : "-"}</td>
                  <td className="table-cell text-gray-600 text-xs">{o.endDateTime ? formatDate(o.endDateTime) : "-"}</td>
                  <td className="table-cell">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${o.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"}`}>
                      {o.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openEdit(o)} className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(o.offerId)} className="inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50" title="Delete">
                        <Trash2 size={14} />
                      </button>
                      <button onClick={() => handleToggle(o.offerId)} className={`inline-flex h-8 w-8 items-center justify-center rounded border ${o.isActive ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`} title="Toggle Status">
                        {o.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </button>
                      <button onClick={() => openConsumptionModal(o.offerId)} className="inline-flex h-8 w-8 items-center justify-center rounded border border-sky-200 text-sky-600 hover:bg-sky-50" title="Consumption">
                        <Eye size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <PaginationControls
          page={offersPage}
          totalPages={offersTotalPages}
          totalItems={sortedOffers.length}
          pageSize={offersPageSize}
          onPageChange={setOffersPage}
          onPageSizeChange={(next) => { setOffersPageSize(next); setOffersPage(1); }}
          disabled={loading}
          showPageSize
        />
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => { setShowForm(false); setIsEditing(false); setIsGlobalOffer(false); setForm(initialForm); }}>
          <div className="modal-panel p-6 w-full max-w-3xl" style={{ maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title mb-4">
              {isEditing ? "Edit Offer" : isGlobalOffer ? "Create Sipstr (Global) Offer" : "Create Store Offer"}
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input className="modal-input w-full" value={form.name ?? ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store ID</label>
                  {isGlobalOffer ? (
                    <div className="px-3 py-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Global Offer — not store specific</div>
                  ) : (
                    <input type="number" className="modal-input w-full" value={form.storeId ?? (storeId ? Number(storeId) : "")} onChange={(e) => setForm((p) => ({ ...p, storeId: e.target.value ? Number(e.target.value) : undefined }))} />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                  <select className="modal-input w-full" value={form.method} onChange={(e) => setForm((prev) => {
                    const method = e.target.value;
                    if (method === "COUPON") {
                      return { ...prev, method, couponDetail: prev.couponDetail ?? ({ couponId: undefined, offerId: prev.offerId, couponCode: "", websiteDisplayMsg: "", maxUsagePerUser: 0, usabilityCount: 0, usabilityOptions: undefined } as any) };
                    }
                    return { ...prev, method };
                  })}>
                    <option value="COUPON">COUPON</option>
                    <option value="VOUCHER">VOUCHER</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select className="modal-input w-full" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))}>
                    <option value="FLAT">FLAT</option>
                    <option value="PERCENTAGE">PERCENTAGE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                  <input type="number" className="modal-input w-full" value={form.discount ?? ""} onChange={(e) => setForm((p) => ({ ...p, discount: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Max Discount</label>
                  <input type="number" className="modal-input w-full" value={form.allowedMaxDiscount ?? ""} onChange={(e) => setForm((p) => ({ ...p, allowedMaxDiscount: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Spend Amount</label>
                  <input type="number" className="modal-input w-full" value={form.minSpendAmount ?? ""} onChange={(e) => setForm((p) => ({ ...p, minSpendAmount: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Total Usage</label>
                  <input type="number" className="modal-input w-full" value={form.maxTotalUsage ?? ""} onChange={(e) => setForm((p) => ({ ...p, maxTotalUsage: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Required Voucher Count</label>
                  <input type="number" className="modal-input w-full" value={form.requiredVoucherCount ?? ""} onChange={(e) => setForm((p) => ({ ...p, requiredVoucherCount: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input className="modal-input w-full" value={form.description ?? ""} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
                  <input type="datetime-local" className="modal-input w-full" value={form.startDateTime ?? ""} onChange={(e) => setForm((p) => ({ ...p, startDateTime: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                  <input type="datetime-local" className="modal-input w-full" value={form.endDateTime ?? ""} onChange={(e) => setForm((p) => ({ ...p, endDateTime: e.target.value }))} />
                </div>
              </div>

              {/* Coupon Details */}
              {form.method === "COUPON" && (
                <div className="border border-gray-200 rounded-lg p-4 mt-3">
                  <h4 className="text-sm font-semibold text-gray-800 mb-3">Coupon Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code</label>
                      <input className="modal-input w-full" value={(form.couponDetail as any)?.couponCode ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, couponDetail: { ...(prev.couponDetail ?? {}), couponCode: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Website Display Message</label>
                      <input className="modal-input w-full" value={(form.couponDetail as any)?.websiteDisplayMsg ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, couponDetail: { ...(prev.couponDetail ?? {}), websiteDisplayMsg: e.target.value } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Usage Per User</label>
                      <input type="number" className="modal-input w-full" value={(form.couponDetail as any)?.maxUsagePerUser ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, couponDetail: { ...(prev.couponDetail ?? {}), maxUsagePerUser: Number(e.target.value) } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Usability Count</label>
                      <input type="number" className="modal-input w-full" value={(form.couponDetail as any)?.usabilityCount ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, couponDetail: { ...(prev.couponDetail ?? {}), usabilityCount: Number(e.target.value) } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Usability Option</label>
                      <select className="modal-input w-full" value={(form.couponDetail as any)?.usabilityOptions ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, couponDetail: { ...(prev.couponDetail ?? {}), usabilityOptions: e.target.value as any } }))}>
                        <option value="">Select</option>
                        <option value="MONTH">MONTH</option>
                        <option value="QUARTER">QUARTER</option>
                        <option value="HALF_YEAR">HALF_YEAR</option>
                        <option value="YEAR">YEAR</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="modal-btn-secondary" onClick={() => { setShowForm(false); setIsEditing(false); setIsGlobalOffer(false); setForm(initialForm); }}>Cancel</button>
              <button className="modal-btn-primary" onClick={handleSubmit}>{isEditing ? "Update Offer" : "Create Offer"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Consumption Modal */}
      {showConsumption && (
        <div className="modal-overlay" onClick={() => setShowConsumption(false)}>
          <div className="modal-panel p-6 w-full max-w-3xl" style={{ maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="modal-title">Consumption History</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Offer: {consumption?.offerId ?? "-"}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">Code: {consumption?.couponCode ?? "-"}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Store: {consumption?.storeId ?? "-"}</span>
                </div>
              </div>
              <button onClick={() => setShowConsumption(false)} className="modal-btn-secondary">Close</button>
            </div>

            {consumptionLoading ? (
              <div className="py-12 text-center text-gray-500">Loading...</div>
            ) : consumptionUsers.length > 0 ? (
              <>
                <div className="table-shell">
                  <table className="table-base">
                    <thead>
                      <tr className="table-head-row">
                        <th className="table-head-cell">User ID</th>
                        <th className="table-head-cell">UUID</th>
                        <th className="table-head-cell">Name</th>
                        <th className="table-head-cell">Phone</th>
                        <th className="table-head-cell">Used At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedConsumptionUsers.map((u, idx) => (
                        <tr key={u.uuid ?? idx} className="table-row table-row-hover">
                          <td className="table-cell">{u.id ?? "-"}</td>
                          <td className="table-cell text-xs max-w-[180px] truncate">{String(u.uuid ?? "-")}</td>
                          <td className="table-cell">{u.fullName ?? "-"}</td>
                          <td className="table-cell">{u.mobileNumber ?? "-"}</td>
                          <td className="table-cell text-xs">
                            {(u.usedAt ?? []).length > 0 ? (
                              <ul className="list-disc pl-4 space-y-0.5">
                                {(u.usedAt ?? []).map((t: string, i: number) => <li key={i}>{formatDate(t)}</li>)}
                              </ul>
                            ) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3">
                  <PaginationControls
                    page={consumptionPage}
                    totalPages={consumptionTotalPages}
                    totalItems={consumptionUsers.length}
                    pageSize={consumptionPageSize}
                    onPageChange={setConsumptionPage}
                    onPageSizeChange={setConsumptionPageSize}
                  />
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <p className="text-base mb-1">No users have used this offer yet.</p>
                <p className="text-sm text-gray-400">Once a user redeems the coupon, their details will appear here.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
