"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { apiService } from "@/services/apiService";
import { DataTable, ColumnDef, DataTableAction } from "./DataTable";
import type { DeliveryZone, GroupedStoreInventoryResponseDTO, Store } from "@/services/types";

const MapPreviewGoogle = dynamic(() => import("@/googlemap/MapPreviewGoogle"), { ssr: false });

type ToastType = "success" | "error" | "info";
type InspectTab = "profile" | "hours" | "holidays" | "inventory" | "zones" | "bulk-uploads";
type ViewMode = "list" | "detail";

function Toast({ open, message, type = "info", onClose }: { open: boolean; message: string; type?: ToastType; onClose: () => void }) {
  if (!open) return null;
  const bg = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-rose-600" : "bg-sky-600";
  return (
    <div className={`fixed right-4 bottom-4 z-50 ${bg} text-white px-4 py-2 rounded shadow-lg cursor-pointer`} onClick={onClose} role="status">
      {message}
    </div>
  );
}

function ConfirmDialog({ open, title, message, onConfirm, onCancel }: { open: boolean; title?: string; message?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-panel p-5 max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title text-lg mb-2">{title ?? "Confirm"}</h3>
        <p className="text-sm text-gray-700">{message}</p>
        <div className="modal-footer">
          <button onClick={onCancel} className="modal-btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="modal-btn-primary">Confirm</button>
        </div>
      </div>
    </div>
  );
}

function exportStoresCsv(rows: Store[]) {
  const headers = ["Store Name", "Corporation", "Email", "Phone", "Active", "Accepting Orders", "Delivery Radius (km)"];
  const lines = rows.map((s) => [
    s.storeName ?? "",
    s.corporationName ?? "",
    s.contactEmail ?? "",
    s.contactPhone ?? "",
    s.isActive ? "Yes" : "No",
    s.isCurrentlyAcceptingOrders ? "Yes" : "No",
    s.deliveryRadiusKm ?? "",
  ]);

  const csv = [headers, ...lines]
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stores-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function readMaybe(obj: any, ...keys: string[]) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "-";
}

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/* ──────────────────────────── MAIN MODULE ──────────────────────────── */

export function StoresModule() {
  /* ── list view state ── */
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeNameFilter, setStoreNameFilter] = useState("");
  const [corporationFilter, setCorporationFilter] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [debouncedStoreName, setDebouncedStoreName] = useState("");
  const [debouncedCorporation, setDebouncedCorporation] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [acceptingFilter, setAcceptingFilter] = useState<"all" | "yes" | "no">("all");

  /* ── view routing ── */
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  /* ── detail view state ── */
  const [inspectStore, setInspectStore] = useState<any | null>(null);
  const [inspectTab, setInspectTab] = useState<InspectTab>("profile");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [inventory, setInventory] = useState<GroupedStoreInventoryResponseDTO[]>([]);
  const [operatingHoursList, setOperatingHoursList] = useState<any[]>([]);
  const [holidayHoursList, setHolidayHoursList] = useState<any[]>([]);
  const [invQuery, setInvQuery] = useState("");
  const [inspectLoading, setInspectLoading] = useState(false);

  /* ── bulk upload history ── */
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [uploadHistoryLoading, setUploadHistoryLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  /* ── update modal ── */
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Store>>({});

  /* ── sub-entity modals ── */
  const [hoursModal, setHoursModal] = useState<{ open: boolean; data: any }>({ open: false, data: null });
  const [holidayModal, setHolidayModal] = useState<{ open: boolean; data: any; isEdit: boolean }>({ open: false, data: null, isEdit: false });
  const [zoneModal, setZoneModal] = useState<{ open: boolean; data: any; isEdit: boolean }>({ open: false, data: null, isEdit: false });

  /* ── toast / confirm ── */
  const [toast, setToast] = useState<{ open: boolean; message: string; type?: ToastType }>({ open: false, message: "" });
  const [confirm, setConfirm] = useState<{ open: boolean; message?: string; onConfirm?: () => void }>({ open: false });

  const showToast = (message: string, type: ToastType = "info", duration = 3000) => {
    setToast({ open: true, message, type });
    setTimeout(() => setToast({ open: false, message: "" }), duration);
  };

  const showConfirm = (message: string, onConfirm: () => void) => {
    setConfirm({ open: true, message, onConfirm });
  };

  /* ── data fetching ── */
  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getStores({
        storeName: debouncedStoreName || undefined,
        corporationName: debouncedCorporation || undefined,
        isActive: activeFilter === "all" ? undefined : activeFilter === "active",
        isCurrentlyAcceptingOrders: acceptingFilter === "all" ? undefined : acceptingFilter === "yes",
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
      });
      setStores(Array.isArray(res) ? res : []);
    } catch {
      showToast("Failed to fetch stores", "error");
    } finally {
      setLoading(false);
    }
  }, [debouncedStoreName, debouncedCorporation, activeFilter, acceptingFilter, createdFrom, createdTo]);

  const loadStoreDetails = async (store: Store) => {
    setViewMode("detail");
    setInspectTab("profile");
    setInspectStore(store);
    setOperatingHoursList([]);
    setHolidayHoursList([]);
    setZones([]);
    setInventory([]);
    setInvQuery("");
    setInspectLoading(true);
    try {
      const [storeRes, zonesRes, invRes, hoursRes, holidayRes] = await Promise.all([
        apiService.getStoreByUuid(store.uuid).catch(() => store),
        apiService.getZonesByStoreUuid(store.uuid).catch(() => []),
        apiService.getStoreInventory(store.uuid, 0, 50).catch(() => ({ content: [] })),
        apiService.getStoreOperatingHours(store.uuid).catch(() => []),
        apiService.getStoreHolidayHours(store.uuid).catch(() => []),
      ]);
      setInspectStore(storeRes ?? store);
      setZones(Array.isArray(zonesRes) ? zonesRes : []);
      setInventory(Array.isArray(invRes?.content) ? invRes.content : []);
      setOperatingHoursList(Array.isArray(hoursRes) ? hoursRes : []);
      setHolidayHoursList(Array.isArray(holidayRes) ? holidayRes : []);
    } catch {
      showToast("Unable to load full store details", "error");
    } finally {
      setInspectLoading(false);
    }
  };

  const goBackToList = () => {
    setViewMode("list");
    setInspectStore(null);
  };

  /* ── debounced filters ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedStoreName(storeNameFilter.trim()), 350);
    return () => clearTimeout(t);
  }, [storeNameFilter]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCorporation(corporationFilter.trim()), 350);
    return () => clearTimeout(t);
  }, [corporationFilter]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  /* ── CRUD handlers ── */
  const handleUpdate = async (uuid: string) => {
    try {
      setLoading(true);
      const store = await apiService.getStoreByUuid(uuid);
      setSelectedStore(store);
      setFormData(store);
      setShowModal(true);
    } catch {
      showToast("Failed to load store details", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uuid: string) => {
    showConfirm("Are you sure you want to delete this store?", async () => {
      setConfirm({ open: false });
      try {
        setLoading(true);
        await apiService.deleteStore(uuid);
        showToast("Store deleted", "success");
        if (viewMode === "detail") goBackToList();
        await fetchStores();
      } catch {
        showToast("Failed to delete store", "error");
      } finally {
        setLoading(false);
      }
    });
  };

  const handleSave = async () => {
    if (!selectedStore) return;
    try {
      setLoading(true);
      await apiService.updateStore(selectedStore.uuid, formData);
      showToast("Store updated", "success");
      setShowModal(false);
      await fetchStores();
      if (viewMode === "detail" && inspectStore?.uuid === selectedStore.uuid) {
        const refreshed = await apiService.getStoreByUuid(selectedStore.uuid).catch(() => null);
        if (refreshed) setInspectStore(refreshed);
      }
    } catch {
      showToast("Failed to update store", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof Store, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  /* ── memos for detail view ── */
  const inventoryRows = useMemo(() => {
    const q = invQuery.trim().toLowerCase();
    return inventory.filter((p) => !q || String(p.productName ?? "").toLowerCase().includes(q));
  }, [inventory, invQuery]);

  const sortedHours = useMemo(() => {
    if (!operatingHoursList.length) return [];
    return [...operatingHoursList].sort(
      (a, b) => DAY_ORDER.indexOf(a?.dayOfWeek ?? "") - DAY_ORDER.indexOf(b?.dayOfWeek ?? "")
    );
  }, [operatingHoursList]);

  const storeCenter = useMemo<[number, number] | undefined>(() => {
    if (!inspectStore) return undefined;
    const lat = Number(inspectStore.latitude ?? inspectStore.lat);
    const lng = Number(inspectStore.longitude ?? inspectStore.lng ?? inspectStore.lon);
    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) return [lat, lng];
    return undefined;
  }, [inspectStore]);

  /* ═══════════════════════════════════════════════════════════════════
     RENDER: LIST VIEW
     ═══════════════════════════════════════════════════════════════════ */
  if (viewMode === "list") {
    return (
      <div className="page-container-sidebar page-content space-y-5">
        <div className="page-header">
          <h2 className="page-title">Stores</h2>
          <p className="page-subtitle">Search stores and click on any store to view full details.</p>
        </div>

        {/* ── filters ── */}
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
            <input className="filter-input" value={storeNameFilter} onChange={(e) => setStoreNameFilter(e.target.value)} placeholder="Search by store name" />
            <input className="filter-input" value={corporationFilter} onChange={(e) => setCorporationFilter(e.target.value)} placeholder="Search by corporation" />

            <select className="filter-select" value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as any)}>
              <option value="all">All status</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>

            <select className="filter-select" value={acceptingFilter} onChange={(e) => setAcceptingFilter(e.target.value as any)}>
              <option value="all">All acceptance</option>
              <option value="yes">Accepting orders</option>
              <option value="no">Not accepting</option>
            </select>

            <input type="date" className="filter-input" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} title="Created from" />
            <input type="date" className="filter-input" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} title="Created to" />

            <div className="flex gap-2">
              <button
                onClick={() => { setStoreNameFilter(""); setCorporationFilter(""); setCreatedFrom(""); setCreatedTo(""); setActiveFilter("all"); setAcceptingFilter("all"); }}
                className="modal-btn-secondary"
              >
                Reset
              </button>
              <button onClick={() => exportStoresCsv(stores)} className="modal-btn-primary">Export CSV</button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Results: {stores.length} stores (server-filtered)</p>
        </div>

        {/* ── table — clicking a row navigates to the store detail ── */}
        <DataTable<Store>
          storageKey="stores-list"
          columns={[
            { key: "storeName", label: "Store Name" },
            { key: "corporationName", label: "Corporation", getValue: (s) => s.corporationName ?? "-" },
            { key: "contactEmail", label: "Email", getValue: (s) => s.contactEmail ?? "-" },
            { key: "contactPhone", label: "Phone", getValue: (s) => s.contactPhone ?? "-" },
            { key: "isActive", label: "Active", getValue: (s) => s.isActive ? "Yes" : "No", render: (val) => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${val === "Yes" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"}`}>{val}</span> },
            { key: "isCurrentlyAcceptingOrders", label: "Accepting Orders", getValue: (s) => s.isCurrentlyAcceptingOrders ? "Yes" : "No", render: (val) => <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${val === "Yes" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{val}</span> },
            { key: "deliveryRadiusKm", label: "Delivery Radius (km)", getValue: (s) => s.deliveryRadiusKm ?? "-", hidden: true },
            { key: "rating", label: "Rating", getValue: (s) => s.rating ?? "-", hidden: true },
            { key: "minimumOrderAmount", label: "Min Order", getValue: (s) => s.minimumOrderAmount ?? "-", hidden: true },
          ]}
          defaultVisibleColumns={["storeName", "corporationName", "contactEmail", "contactPhone", "isActive", "isCurrentlyAcceptingOrders"]}
          data={stores}
          getRowId={(s) => s.uuid}
          loading={loading}
          actions={[
            { label: "View Details", onClick: (store) => loadStoreDetails(store) },
            { icon: "edit", label: "Edit", onClick: (store) => handleUpdate(store.uuid) },
            { icon: "delete", label: "Delete", onClick: (store) => handleDelete(store.uuid) },
          ]}
          searchPlaceholder="Search stores..."
          onRowClick={(store) => loadStoreDetails(store)}
          emptyMessage="No stores found."
        />

        {/* modals & toasts */}
        {renderUpdateModal()}
        <Toast open={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ open: false, message: "" })} />
        <ConfirmDialog
          open={confirm.open} title="Delete Store" message={confirm.message}
          onConfirm={() => { setConfirm({ open: false }); confirm.onConfirm?.(); }}
          onCancel={() => setConfirm({ open: false })}
        />
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER: DETAIL VIEW
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="page-container-sidebar page-content space-y-5">
      {/* ── breadcrumb / back bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={goBackToList}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-orange-600 hover:bg-orange-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Back to Stores
        </button>
        <span className="text-gray-300">|</span>
        <h2 className="text-lg font-semibold text-gray-900 truncate">{inspectStore?.storeName ?? "Store"}</h2>
        <div className="ml-auto flex gap-2">
          <button onClick={() => handleUpdate(inspectStore?.uuid)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors">
            Edit Store
          </button>
          <button onClick={() => handleDelete(inspectStore?.uuid)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors">
            Delete
          </button>
        </div>
      </div>

      {/* ── quick status cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatusCard label="Status" value={inspectStore?.isActive ? "Active" : "Inactive"} accent={inspectStore?.isActive ? "emerald" : "rose"} />
        <StatusCard label="Accepting Orders" value={inspectStore?.isCurrentlyAcceptingOrders ? "Yes" : "No"} accent={inspectStore?.isCurrentlyAcceptingOrders ? "emerald" : "amber"} />
        <StatusCard label="Rating" value={inspectStore?.rating ?? "-"} accent="sky" />
        <StatusCard label="Delivery Radius" value={`${readMaybe(inspectStore, "deliveryRadiusKm")} km`} accent="violet" />
      </div>

      {/* ── tab navigation ── */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm">
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {(
            [
              { id: "profile", label: "Store Profile" },
              { id: "hours", label: "Operating Hours" },
              { id: "holidays", label: "Holidays" },
              { id: "inventory", label: "Inventory" },
              { id: "zones", label: "Delivery Zones" },
              { id: "bulk-uploads", label: "Bulk Uploads" },
            ] as { id: InspectTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setInspectTab(tab.id);
                if (tab.id === "bulk-uploads") loadUploadHistory();
              }}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                inspectTab === tab.id
                  ? "border-orange-500 text-orange-600 bg-orange-50/50"
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── tab content ── */}
        <div className="p-5">
          {inspectLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              Loading store data…
            </div>
          ) : (
            <>
              {inspectTab === "profile" && renderProfileTab()}
              {inspectTab === "hours" && renderHoursTab()}
              {inspectTab === "holidays" && renderHolidaysTab()}
              {inspectTab === "inventory" && renderInventoryTab()}
              {inspectTab === "zones" && renderZonesTab()}
              {inspectTab === "bulk-uploads" && renderBulkUploadsTab()}
            </>
          )}
        </div>
      </div>

      {/* modals & toasts */}
      {renderUpdateModal()}
      {renderHoursModal()}
      {renderHolidayModal()}
      {renderZoneModal()}
      <Toast open={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ open: false, message: "" })} />
      <ConfirmDialog
        open={confirm.open} title="Confirm Delete" message={confirm.message}
        onConfirm={() => { setConfirm({ open: false }); confirm.onConfirm?.(); }}
        onCancel={() => setConfirm({ open: false })}
      />
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════
     TAB RENDERERS
     ═══════════════════════════════════════════════════════════════════ */

  /* ── Profile ── */
  function renderProfileTab() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <DetailSection title="Basic Information">
          <DetailRow label="Store Name" value={readMaybe(inspectStore, "storeName")} />
          <DetailRow label="Corporation" value={readMaybe(inspectStore, "corporationName")} />
          <DetailRow label="Contact Email" value={readMaybe(inspectStore, "contactEmail")} />
          <DetailRow label="Contact Phone" value={readMaybe(inspectStore, "contactPhone")} />
          <DetailRow label="Address" value={readMaybe(inspectStore, "storeAddress", "address", "addressLine1")} />
          <DetailRow label="Description" value={readMaybe(inspectStore, "description")} />
        </DetailSection>

        <DetailSection title="Business Details">
          <DetailRow label="EIN" value={readMaybe(inspectStore, "ein")} />
          <DetailRow label="License Number" value={readMaybe(inspectStore, "licenseNumber")} />
          <DetailRow label="Tax Rate" value={inspectStore?.taxRate != null ? `${inspectStore.taxRate}%` : "-"} />
          <DetailRow label="Commission Rate" value={inspectStore?.commissionRate != null ? `${inspectStore.commissionRate}%` : "-"} />
          <DetailRow label="Min Order Amount" value={inspectStore?.minimumOrderAmount != null ? `$${inspectStore.minimumOrderAmount}` : "-"} />
          <DetailRow label="Avg Prep Time" value={inspectStore?.averagePreparationTime != null ? `${inspectStore.averagePreparationTime} min` : "-"} />
        </DetailSection>

        <DetailSection title="Documents" className="lg:col-span-2">
          {inspectStore?.liquorLicenseUrl ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <a href={inspectStore.liquorLicenseUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline break-all">
                Liquor License Document
              </a>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No documents uploaded.</p>
          )}
        </DetailSection>

        {storeCenter && (
          <DetailSection title="Store Location" className="lg:col-span-2">
            <div className="text-sm text-gray-600 mb-2">Lat: {storeCenter[0]}, Lng: {storeCenter[1]}</div>
            <MapPreviewGoogle zones={[]} center={storeCenter} zoom={15} height={280} />
          </DetailSection>
        )}
      </div>
    );
  }

  /* ── Operating Hours ── */
  function renderHoursTab() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Weekly Operating Hours</h4>
          <button onClick={() => setHoursModal({ open: true, data: { dayOfWeek: "MONDAY", openingTime: "09:00", closingTime: "21:00" } })} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors">
            + Add Hours
          </button>
        </div>

        {!sortedHours.length ? (
          <EmptyState message="No operating hours configured for this store." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3 font-semibold text-gray-700">Day</th>
                  <th className="p-3 font-semibold text-gray-700">Opening Time</th>
                  <th className="p-3 font-semibold text-gray-700">Closing Time</th>
                  <th className="p-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedHours.map((h: any, idx: number) => (
                  <tr key={h.id ?? idx} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="p-3 font-medium text-gray-800 capitalize">{(h.dayOfWeek ?? "-").toLowerCase()}</td>
                    <td className="p-3 text-gray-600">{h.openingTime ?? "-"}</td>
                    <td className="p-3 text-gray-600">{h.closingTime ?? "-"}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => setHoursModal({ open: true, data: { ...h } })} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">Edit</button>
                        <button onClick={() => handleDeleteHours(h.dayOfWeek)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  async function handleSaveHours(data: any) {
    if (!inspectStore?.uuid) return;
    try {
      await apiService.updateStoreOperatingHours(inspectStore.uuid, [data]);
      showToast("Operating hours updated", "success");
      setHoursModal({ open: false, data: null });
      const res = await apiService.getStoreOperatingHours(inspectStore.uuid).catch(() => []);
      setOperatingHoursList(Array.isArray(res) ? res : []);
    } catch {
      showToast("Failed to save operating hours", "error");
    }
  }

  async function handleDeleteHours(dayOfWeek: string) {
    if (!inspectStore?.uuid || !dayOfWeek) return;
    showConfirm(`Delete operating hours for ${dayOfWeek}?`, async () => {
      setConfirm({ open: false });
      try {
        await apiService.deleteStoreOperatingHours(inspectStore.uuid, dayOfWeek);
        showToast("Operating hours deleted", "success");
        const res = await apiService.getStoreOperatingHours(inspectStore.uuid).catch(() => []);
        setOperatingHoursList(Array.isArray(res) ? res : []);
      } catch {
        showToast("Failed to delete operating hours", "error");
      }
    });
  }

  /* ── Holidays ── */
  function renderHolidaysTab() {
    const isHolidayMode = readMaybe(inspectStore, "isHolidayMode", "holidayMode", "holidayEnabled");
    const holidayStart = readMaybe(inspectStore, "holidayStart", "holidayStartDate", "holidayFrom");
    const holidayEnd = readMaybe(inspectStore, "holidayEnd", "holidayEndDate", "holidayTo");
    const holidayReason = readMaybe(inspectStore, "holidayReason", "holidayMessage");

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniInfoCard label="Holiday Mode" value={String(isHolidayMode)} />
          <MiniInfoCard label="Start" value={String(holidayStart)} />
          <MiniInfoCard label="End" value={String(holidayEnd)} />
          <MiniInfoCard label="Reason" value={String(holidayReason)} />
        </div>

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Holiday Hours Schedule</h4>
          <button onClick={() => setHolidayModal({ open: true, data: { storeUuid: inspectStore?.uuid, date: "", openingTime: "", closingTime: "", isClosed: true, reason: "" }, isEdit: false })} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors">
            + Add Holiday
          </button>
        </div>

        {holidayHoursList.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3 font-semibold text-gray-700">Date</th>
                  <th className="p-3 font-semibold text-gray-700">Opening</th>
                  <th className="p-3 font-semibold text-gray-700">Closing</th>
                  <th className="p-3 font-semibold text-gray-700">Closed</th>
                  <th className="p-3 font-semibold text-gray-700">Reason</th>
                  <th className="p-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidayHoursList.map((h: any, idx: number) => (
                  <tr key={h.id ?? idx} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="p-3 text-gray-700">{h.date ?? h.holidayDate ?? "-"}</td>
                    <td className="p-3 text-gray-600">{h.openingTime ?? h.openTime ?? "-"}</td>
                    <td className="p-3 text-gray-600">{h.closingTime ?? h.closeTime ?? "-"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${h.isClosed ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {h.isClosed ? "Closed" : "Open"}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">{h.reason ?? h.description ?? "-"}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button onClick={() => setHolidayModal({ open: true, data: { ...h, storeUuid: inspectStore?.uuid }, isEdit: true })} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">Edit</button>
                        <button onClick={() => handleDeleteHoliday(h.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No holiday hours configured for this store." />
        )}
      </div>
    );
  }

  async function handleSaveHoliday(data: any, isEdit: boolean) {
    try {
      if (isEdit && data.id) {
        await apiService.updateStoreHolidayHours(data.id, data);
      } else {
        await apiService.addStoreHolidayHours({ ...data, storeUuid: inspectStore?.uuid });
      }
      showToast(isEdit ? "Holiday updated" : "Holiday added", "success");
      setHolidayModal({ open: false, data: null, isEdit: false });
      const res = await apiService.getStoreHolidayHours(inspectStore?.uuid).catch(() => []);
      setHolidayHoursList(Array.isArray(res) ? res : []);
    } catch {
      showToast("Failed to save holiday", "error");
    }
  }

  async function handleDeleteHoliday(id: number) {
    if (!id) return;
    showConfirm("Delete this holiday entry?", async () => {
      setConfirm({ open: false });
      try {
        await apiService.deleteStoreHolidayHours(id);
        showToast("Holiday deleted", "success");
        const res = await apiService.getStoreHolidayHours(inspectStore?.uuid).catch(() => []);
        setHolidayHoursList(Array.isArray(res) ? res : []);
      } catch {
        showToast("Failed to delete holiday", "error");
      }
    });
  }

  /* ── Inventory ── */
  function renderInventoryTab() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <input
            className="filter-input w-full sm:w-80"
            value={invQuery}
            onChange={(e) => setInvQuery(e.target.value)}
            placeholder="Search inventory by product name…"
          />
        </div>

        {inventoryRows.length === 0 ? (
          <EmptyState message="No inventory records found." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3 font-semibold text-gray-700">Product</th>
                  <th className="p-3 font-semibold text-gray-700">Variants</th>
                  <th className="p-3 font-semibold text-gray-700">Details</th>
                  <th className="p-3 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inventoryRows.map((r, idx) => (
                  <tr key={r.productId} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="p-3 font-medium text-gray-800">{r.productName}</td>
                    <td className="p-3 text-gray-600">{r.variants?.length ?? 0} variant(s)</td>
                    <td className="p-3">
                      {r.variants && r.variants.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {r.variants.slice(0, 4).map((v) => (
                            <span key={v.variantId ?? v.storeInventoryId} className="inline-block px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-600">
                              {v.packageName ?? "Pkg"} — Qty: {v.quantity ?? 0}
                            </span>
                          ))}
                          {r.variants.length > 4 && (
                            <span className="inline-block px-2 py-0.5 rounded bg-gray-100 text-xs text-gray-500">+{r.variants.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        {r.variants?.map((v) => (
                          <button key={v.variantId} onClick={() => handleDeleteInventoryItem(v.variantId)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100" title={`Delete ${v.packageName}`}>
                            Del {v.packageName}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  async function handleDeleteInventoryItem(variantId: number) {
    if (!inspectStore?.uuid || !variantId) return;
    showConfirm("Delete this inventory item?", async () => {
      setConfirm({ open: false });
      try {
        await apiService.deleteStoreInventoryItem(inspectStore.uuid, variantId);
        showToast("Inventory item deleted", "success");
        const inv = await apiService.getStoreInventory(inspectStore.uuid).catch(() => null);
        setInventory(Array.isArray((inv as any)?.content) ? (inv as any).content : []);
      } catch {
        showToast("Failed to delete inventory item", "error");
      }
    });
  }

  /* ── Bulk Uploads ── */
  function renderBulkUploadsTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Bulk Inventory Uploads</h4>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100"
            />
            <button
              onClick={handleBulkUpload}
              disabled={!uploadFile || uploading}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? "Uploading…" : "Upload CSV"}
            </button>
            <button
              onClick={loadUploadHistory}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {uploadHistoryLoading ? (
          <div className="py-8 text-center text-gray-400">Loading upload history…</div>
        ) : uploadHistory.length === 0 ? (
          <EmptyState message="No bulk uploads found for this store. Upload a CSV or XLSX file to get started." />
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-3 font-semibold text-gray-700">File</th>
                  <th className="p-3 font-semibold text-gray-700">Status</th>
                  <th className="p-3 font-semibold text-gray-700">Total Rows</th>
                  <th className="p-3 font-semibold text-gray-700">Success</th>
                  <th className="p-3 font-semibold text-gray-700">Unknown</th>
                  <th className="p-3 font-semibold text-gray-700">Failed</th>
                  <th className="p-3 font-semibold text-gray-700">Uploaded At</th>
                  <th className="p-3 font-semibold text-gray-700">Processed At</th>
                  <th className="p-3 font-semibold text-gray-700">Uploaded By</th>
                </tr>
              </thead>
              <tbody>
                {uploadHistory.map((h: any, idx: number) => (
                  <tr key={h.id ?? idx} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                    <td className="p-3 text-gray-800 font-medium max-w-[200px] truncate" title={h.fileName}>{h.fileName ?? "-"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        h.status === "PROCESSED" ? "bg-emerald-100 text-emerald-700" :
                        h.status === "FAILED" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">{h.totalRowCount ?? "-"}</td>
                    <td className="p-3 text-emerald-600 font-medium">{h.successCount ?? "-"}</td>
                    <td className="p-3 text-amber-600 font-medium">{h.unknownProductCount ?? "-"}</td>
                    <td className="p-3 text-red-600 font-medium">{h.failedCount ?? "-"}</td>
                    <td className="p-3 text-gray-600 text-xs">{h.uploadedAt ? new Date(h.uploadedAt).toLocaleString() : "-"}</td>
                    <td className="p-3 text-gray-600 text-xs">{h.processedAt ? new Date(h.processedAt).toLocaleString() : "-"}</td>
                    <td className="p-3 text-gray-600 text-xs">{h.uploadedByEmail ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  async function loadUploadHistory() {
    if (!inspectStore?.uuid) return;
    setUploadHistoryLoading(true);
    try {
      const res = await apiService.getUploadHistory(0, 50, inspectStore.uuid);
      setUploadHistory(Array.isArray(res?.content) ? res.content : []);
    } catch {
      showToast("Failed to load upload history", "error");
    } finally {
      setUploadHistoryLoading(false);
    }
  }

  async function handleBulkUpload() {
    if (!uploadFile || !inspectStore?.uuid) return;
    setUploading(true);
    try {
      await apiService.uploadBulkInventory(uploadFile, inspectStore.uuid);
      showToast("File uploaded successfully. Processing will begin shortly.", "success");
      setUploadFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      // Reload history after a brief delay
      setTimeout(loadUploadHistory, 1500);
    } catch (err: any) {
      showToast(err?.message ?? "Failed to upload file", "error");
    } finally {
      setUploading(false);
    }
  }

  /* ── Delivery Zones ── */
  function renderZonesTab() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Delivery Zones</h4>
          <button onClick={() => setZoneModal({ open: true, data: { storeUuid: inspectStore?.uuid, zoneName: "", baseDeliveryFee: 0, perMileFee: 0, minOrderAmount: 0, estimatedPreparationTime: 0, restricted: false, coordinates: [] }, isEdit: false })} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors">
            + Add Zone
          </button>
        </div>

        {zones.length === 0 ? (
          <EmptyState message="No delivery zones configured for this store." />
        ) : (
          <>
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <MapPreviewGoogle zones={zones} center={storeCenter} zoom={12} height={400} />
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="p-3 font-semibold text-gray-700">Zone Name</th>
                    <th className="p-3 font-semibold text-gray-700">Base Fee</th>
                    <th className="p-3 font-semibold text-gray-700">Per Mile</th>
                    <th className="p-3 font-semibold text-gray-700">Min Order</th>
                    <th className="p-3 font-semibold text-gray-700">Est. Prep</th>
                    <th className="p-3 font-semibold text-gray-700">Restricted</th>
                    <th className="p-3 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z, idx) => (
                    <tr key={z.zoneId} className={`border-t border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                      <td className="p-3 font-medium text-gray-800">{z.zoneName}</td>
                      <td className="p-3 text-gray-600">${z.baseDeliveryFee}</td>
                      <td className="p-3 text-gray-600">${z.perMileFee}</td>
                      <td className="p-3 text-gray-600">${z.minOrderAmount}</td>
                      <td className="p-3 text-gray-600">{z.estimatedPreparationTime} min</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${z.restricted ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                          {z.restricted ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button onClick={() => setZoneModal({ open: true, data: { ...z }, isEdit: true })} className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100">Edit</button>
                          <button onClick={() => handleDeleteZone(z.zoneId)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    );
  }

  async function handleSaveZone(data: any, isEdit: boolean) {
    try {
      if (isEdit && data.zoneId) {
        await apiService.updateZone(String(data.zoneId), data);
      } else {
        await apiService.createZone({ ...data, storeUuid: inspectStore?.uuid });
      }
      showToast(isEdit ? "Zone updated" : "Zone created", "success");
      setZoneModal({ open: false, data: null, isEdit: false });
      const res = await apiService.getZonesByStoreUuid(inspectStore?.uuid ?? "").catch(() => []);
      setZones(Array.isArray(res) ? res : []);
    } catch {
      showToast("Failed to save zone", "error");
    }
  }

  async function handleDeleteZone(zoneId: number | string) {
    if (!zoneId) return;
    showConfirm("Delete this delivery zone?", async () => {
      setConfirm({ open: false });
      try {
        await apiService.deleteZone(String(zoneId));
        showToast("Zone deleted", "success");
        const res = await apiService.getZonesByStoreUuid(inspectStore?.uuid ?? "").catch(() => []);
        setZones(Array.isArray(res) ? res : []);
      } catch {
        showToast("Failed to delete zone", "error");
      }
    });
  }

  /* ── Hours Modal ── */
  function renderHoursModal() {
    if (!hoursModal.open) return null;
    const d = hoursModal.data ?? {};
    const setField = (k: string, v: any) => setHoursModal((prev) => ({ ...prev, data: { ...prev.data, [k]: v } }));
    const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    return (
      <div className="modal-overlay" onClick={() => setHoursModal({ open: false, data: null })}>
        <div className="modal-panel p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title mb-4">{d.id ? "Edit" : "Add"} Operating Hours</h3>
          <div className="space-y-3">
            <ModalField label="Day of Week">
              <select value={d.dayOfWeek ?? ""} onChange={(e) => setField("dayOfWeek", e.target.value)} className="modal-input w-full">
                {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
              </select>
            </ModalField>
            <ModalField label="Opening Time">
              <input type="time" value={d.openingTime ?? ""} onChange={(e) => setField("openingTime", e.target.value)} className="modal-input w-full" />
            </ModalField>
            <ModalField label="Closing Time">
              <input type="time" value={d.closingTime ?? ""} onChange={(e) => setField("closingTime", e.target.value)} className="modal-input w-full" />
            </ModalField>
          </div>
          <div className="modal-footer">
            <button onClick={() => setHoursModal({ open: false, data: null })} className="modal-btn-secondary">Cancel</button>
            <button onClick={() => handleSaveHours(hoursModal.data)} className="modal-btn-primary">Save</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Holiday Modal ── */
  function renderHolidayModal() {
    if (!holidayModal.open) return null;
    const d = holidayModal.data ?? {};
    const setField = (k: string, v: any) => setHolidayModal((prev) => ({ ...prev, data: { ...prev.data, [k]: v } }));
    return (
      <div className="modal-overlay" onClick={() => setHolidayModal({ open: false, data: null, isEdit: false })}>
        <div className="modal-panel p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title mb-4">{holidayModal.isEdit ? "Edit" : "Add"} Holiday Hours</h3>
          <div className="space-y-3">
            <ModalField label="Date">
              <input type="date" value={d.date ?? d.holidayDate ?? ""} onChange={(e) => setField("date", e.target.value)} className="modal-input w-full" />
            </ModalField>
            <ModalField label="Opening Time">
              <input type="time" value={d.openingTime ?? d.openTime ?? ""} onChange={(e) => setField("openingTime", e.target.value)} className="modal-input w-full" />
            </ModalField>
            <ModalField label="Closing Time">
              <input type="time" value={d.closingTime ?? d.closeTime ?? ""} onChange={(e) => setField("closingTime", e.target.value)} className="modal-input w-full" />
            </ModalField>
            <ModalField label="Closed">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={Boolean(d.isClosed)} onChange={(e) => setField("isClosed", e.target.checked)} />
                {d.isClosed ? "Yes – Store Closed" : "No – Store Open"}
              </label>
            </ModalField>
            <ModalField label="Reason">
              <input type="text" value={d.reason ?? ""} onChange={(e) => setField("reason", e.target.value)} className="modal-input w-full" placeholder="e.g. Christmas Day" />
            </ModalField>
          </div>
          <div className="modal-footer">
            <button onClick={() => setHolidayModal({ open: false, data: null, isEdit: false })} className="modal-btn-secondary">Cancel</button>
            <button onClick={() => handleSaveHoliday(holidayModal.data, holidayModal.isEdit)} className="modal-btn-primary">Save</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Zone Modal ── */
  function renderZoneModal() {
    if (!zoneModal.open) return null;
    const d = zoneModal.data ?? {};
    const setField = (k: string, v: any) => setZoneModal((prev) => ({ ...prev, data: { ...prev.data, [k]: v } }));
    return (
      <div className="modal-overlay" onClick={() => setZoneModal({ open: false, data: null, isEdit: false })}>
        <div className="modal-panel p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title mb-4">{zoneModal.isEdit ? "Edit" : "Add"} Delivery Zone</h3>
          <div className="space-y-3">
            <ModalField label="Zone Name">
              <input type="text" value={d.zoneName ?? ""} onChange={(e) => setField("zoneName", e.target.value)} className="modal-input w-full" />
            </ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Base Delivery Fee ($)">
                <input type="number" step="0.01" value={d.baseDeliveryFee ?? 0} onChange={(e) => setField("baseDeliveryFee", parseFloat(e.target.value))} className="modal-input w-full" />
              </ModalField>
              <ModalField label="Per Mile Fee ($)">
                <input type="number" step="0.01" value={d.perMileFee ?? 0} onChange={(e) => setField("perMileFee", parseFloat(e.target.value))} className="modal-input w-full" />
              </ModalField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Min Order Amount ($)">
                <input type="number" step="0.01" value={d.minOrderAmount ?? 0} onChange={(e) => setField("minOrderAmount", parseFloat(e.target.value))} className="modal-input w-full" />
              </ModalField>
              <ModalField label="Est. Prep Time (min)">
                <input type="number" value={d.estimatedPreparationTime ?? 0} onChange={(e) => setField("estimatedPreparationTime", parseInt(e.target.value))} className="modal-input w-full" />
              </ModalField>
            </div>
            <ModalField label="Restricted">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={Boolean(d.restricted)} onChange={(e) => setField("restricted", e.target.checked)} />
                {d.restricted ? "Yes – Restricted Zone" : "No – Open Zone"}
              </label>
            </ModalField>
          </div>
          <div className="modal-footer">
            <button onClick={() => setZoneModal({ open: false, data: null, isEdit: false })} className="modal-btn-secondary">Cancel</button>
            <button onClick={() => handleSaveZone(zoneModal.data, zoneModal.isEdit)} className="modal-btn-primary">Save</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Update Modal (shared) ── */
  function renderUpdateModal() {
    if (!showModal) return null;
    return (
      <div className="modal-overlay" onClick={() => setShowModal(false)}>
        <div className="modal-panel p-6 w-full max-w-3xl" style={{ maxHeight: "85vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
          <h3 className="modal-title mb-4">Update Store — {selectedStore?.storeName}</h3>

          <div className="space-y-3">
            <ModalField label="Store Name">
              <input type="text" value={formData.storeName ?? ""} onChange={(e) => handleChange("storeName", e.target.value)} className="modal-input w-full" />
            </ModalField>
            <ModalField label="Corporation Name">
              <input type="text" value={formData.corporationName ?? ""} onChange={(e) => handleChange("corporationName", e.target.value)} className="modal-input w-full" />
            </ModalField>
            <ModalField label="Contact Email">
              <input type="email" value={formData.contactEmail ?? ""} onChange={(e) => handleChange("contactEmail", e.target.value)} className="modal-input w-full" />
            </ModalField>
            <ModalField label="Contact Phone">
              <input type="text" value={formData.contactPhone ?? ""} onChange={(e) => handleChange("contactPhone", e.target.value)} className="modal-input w-full" />
            </ModalField>

            <div className="grid grid-cols-2 gap-3">
              <ModalField label="Active">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={Boolean(formData.isActive)} onChange={(e) => handleChange("isActive", e.target.checked)} />
                  {formData.isActive ? "Active" : "Inactive"}
                </label>
              </ModalField>
              <ModalField label="Accepting Orders">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={Boolean(formData.isCurrentlyAcceptingOrders)} onChange={(e) => handleChange("isCurrentlyAcceptingOrders", e.target.checked)} />
                  {formData.isCurrentlyAcceptingOrders ? "Yes" : "No"}
                </label>
              </ModalField>
            </div>

            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Holiday Settings</p>
              <div className="space-y-3">
                <ModalField label="Holiday Mode">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={Boolean((formData as any).isHolidayMode ?? (formData as any).holidayMode)} onChange={(e) => handleChange("isHolidayMode" as keyof Store, e.target.checked as any)} />
                    {(formData as any).isHolidayMode || (formData as any).holidayMode ? "Enabled" : "Disabled"}
                  </label>
                </ModalField>
                <div className="grid grid-cols-2 gap-3">
                  <ModalField label="Holiday Start">
                    <input type="datetime-local" value={(formData as any).holidayStart ?? (formData as any).holidayStartDate ?? ""} onChange={(e) => handleChange("holidayStart" as keyof Store, e.target.value as any)} className="modal-input w-full" />
                  </ModalField>
                  <ModalField label="Holiday End">
                    <input type="datetime-local" value={(formData as any).holidayEnd ?? (formData as any).holidayEndDate ?? ""} onChange={(e) => handleChange("holidayEnd" as keyof Store, e.target.value as any)} className="modal-input w-full" />
                  </ModalField>
                </div>
                <ModalField label="Holiday Reason">
                  <input type="text" value={(formData as any).holidayReason ?? (formData as any).holidayMessage ?? ""} onChange={(e) => handleChange("holidayReason" as keyof Store, e.target.value as any)} className="modal-input w-full" />
                </ModalField>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button onClick={() => setShowModal(false)} className="modal-btn-secondary">Cancel</button>
            <button onClick={handleSave} className="modal-btn-primary">Save</button>
          </div>
        </div>
      </div>
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════
   PRESENTATIONAL SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function StatusCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[accent] ?? "bg-gray-50 text-gray-700 border-gray-200"}`}>
      <p className="text-[11px] uppercase font-semibold tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}

function DetailSection({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`border border-gray-100 rounded-lg p-4 bg-gray-50/50 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-100">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="font-medium text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}

function MiniInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
      <p className="text-[11px] uppercase font-semibold text-gray-500 tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-800 mt-0.5 break-words">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
