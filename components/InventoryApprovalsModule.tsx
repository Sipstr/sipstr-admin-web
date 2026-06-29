"use client";

import { useEffect, useMemo, useState } from "react";
import { apiService } from "@/services/apiService";
import { CrudTable } from "./CrudTable";
import { PaginationControls } from "./PaginationControls";
import {
  StoreInventoryApprovalDecisionDTO,
  StoreInventoryApprovalQueueDTO,
  PageResponse,
} from "@/services/types";

type ToastType = "success" | "error" | "info";

function Toast({
  open,
  message,
  type = "info",
  onClose,
}: {
  open: boolean;
  message: string;
  type?: ToastType;
  onClose: () => void;
}) {
  if (!open) return null;
  const styles: Record<ToastType, React.CSSProperties> = {
    success: { background: "#0f9d58" },
    error: { background: "#dc2626" },
    info: { background: "#0f766e" },
  };

  return (
    <button
      type="button"
      onClick={onClose}
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 9999,
        color: "#fff",
        padding: "12px 14px",
        border: 0,
        borderRadius: 12,
        boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
        cursor: "pointer",
        maxWidth: 520,
        textAlign: "left",
        ...styles[type],
      }}
    >
      {message}
    </button>
  );
}

function formatCurrency(value?: number | string) {
  if (value === undefined || value === null || value === "") return "-";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusChip({ label, tone }: { label: string; tone: "green" | "amber" | "slate" | "red" }) {
  const palette = {
    green: { background: "#dcfce7", color: "#166534" },
    amber: { background: "#ffedd5", color: "#9a3412" },
    slate: { background: "#e2e8f0", color: "#334155" },
    red: { background: "#fee2e2", color: "#991b1b" },
  }[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        ...palette,
      }}
    >
      {label}
    </span>
  );
}

function DecisionDialog({
  open,
  title,
  item,
  decision,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  item: StoreInventoryApprovalQueueDTO | null;
  decision: boolean;
  onClose: () => void;
  onSubmit: (decision: StoreInventoryApprovalDecisionDTO) => Promise<void>;
}) {
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setRemarks("");
  }, [open]);

  if (!open || !item) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSubmit({ approved: decision, remarks: remarks.trim() || undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 720,
          background: "#fff",
          borderRadius: 20,
          boxShadow: "0 24px 60px rgba(0,0,0,0.24)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 24, borderBottom: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#c2410c", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            {title}
          </div>
          <h3 style={{ margin: "8px 0 0", fontSize: 24, fontWeight: 800, color: "#111827" }}>
            {item.productName}
          </h3>
          <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
            UPC {item.upc} · {item.packageName} · Store {item.storeName}
          </p>
        </div>

        <div style={{ padding: 24, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ gridColumn: "1 / -1", display: "grid", gap: 12, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            <div style={cardStyle}>
              <div style={cardLabel}>Quantity</div>
              <div style={cardValue}>{item.quantity}</div>
            </div>
            <div style={cardStyle}>
              <div style={cardLabel}>Price</div>
              <div style={cardValue}>${formatCurrency(item.supplierPrice)}</div>
            </div>
            <div style={cardStyle}>
              <div style={cardLabel}>Current Status</div>
              <div style={cardValue}>{item.approvalStatus ?? "PENDING_APPROVAL"}</div>
            </div>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={fieldLabel}>Remarks</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={decision ? "Optional approval notes" : "Optional reason for rejection"}
              rows={4}
              style={textAreaStyle}
            />
          </div>
        </div>

        <div style={{ padding: 24, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button type="button" onClick={onClose} style={secondaryButton}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving} style={decision ? successButton : dangerButton}>
            {saving ? "Saving..." : decision ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fff, #fafafa)",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
};
const cardLabel: React.CSSProperties = { fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 700, textTransform: "uppercase" };
const cardValue: React.CSSProperties = { fontSize: 18, fontWeight: 800, color: "#111827" };
const fieldLabel: React.CSSProperties = { display: "block", marginBottom: 8, fontSize: 13, fontWeight: 700, color: "#374151" };
const textAreaStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #d1d5db",
  outline: "none",
  resize: "vertical",
  fontSize: 14,
};
const secondaryButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};
const successButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: 0,
  background: "#16a34a",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};
const dangerButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: 0,
  background: "#dc2626",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

export function InventoryApprovalsModule() {
  const [items, setItems] = useState<StoreInventoryApprovalQueueDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [size] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [storeUuid, setStoreUuid] = useState("");
  const [selected, setSelected] = useState<StoreInventoryApprovalQueueDTO | null>(null);
  const [decision, setDecision] = useState<boolean>(true);

  const [toast, setToast] = useState<{ open: boolean; message: string; type: ToastType }>({ open: false, message: "", type: "info" });

  const showToast = (message: string, type: ToastType = "info") => {
    setToast({ open: true, message, type });
    window.setTimeout(() => setToast({ open: false, message: "", type }), 3000);
  };

  const fetchItems = async (nextPage = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getPendingInventoryApprovals(nextPage, size, storeUuid.trim() || undefined);
      const payload = res as PageResponse<StoreInventoryApprovalQueueDTO>;
      setItems(payload.content ?? []);
      setPage(payload.number ?? nextPage);
      setTotalPages(payload.totalPages ?? 0);
    } catch (err: any) {
      const message = err?.message ?? "Failed to load inventory approvals";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDecision = (item: StoreInventoryApprovalQueueDTO, approve: boolean) => {
    setSelected(item);
    setDecision(approve);
  };

  const submitDecision = async (payload: StoreInventoryApprovalDecisionDTO) => {
    if (!selected) return;
    try {
      const message = await apiService.reviewInventoryApproval(selected.storeInventoryId, payload);
      showToast(message || (payload.approved ? "Approved" : "Rejected"), "success");
      setSelected(null);
      await fetchItems(page);
    } catch (err: any) {
      showToast(err?.message ?? "Failed to update approval", "error");
      throw err;
    }
  };

  const tableData = useMemo(
    () =>
      items.map((item) => {
        const status = (item.approvalStatus ?? "PENDING_APPROVAL").toUpperCase();
        const tone = status === "APPROVED" ? "green" : status === "REJECTED" ? "red" : "amber";
        const liveTone = item.approvalStatus === "APPROVED" && item.isLive ? "green" : "slate";
        return {
          id: String(item.storeInventoryId),
          cells: [
            item.storeName,
            item.productName,
            item.upc,
            item.packageName,
            item.quantity,
            `$${formatCurrency(item.supplierPrice)}`,
            <StatusChip key={`status-${item.storeInventoryId}`} label={status} tone={tone as any} />,
            <StatusChip key={`live-${item.storeInventoryId}`} label={item.approvalStatus === "APPROVED" && item.isLive ? "LIVE" : "PENDING"} tone={liveTone as any} />,
          ],
          actions: [
            { label: "Approve", onClick: () => openDecision(item, true) },
            { label: "Reject", onClick: () => openDecision(item, false) },
          ],
        };
      }),
    [items]
  );

  return (
    <div style={{ minHeight: "100%", background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 25%)", padding: 16, borderRadius: 20 }}>
      <div style={{ marginBottom: 18, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.12em", color: "#c2410c", textTransform: "uppercase" }}>SUPER_ADMIN</div>
          <h2 style={{ margin: "8px 0 0", fontSize: 28, fontWeight: 900, color: "#111827" }}>Inventory approvals</h2>
          <p style={{ margin: "8px 0 0", color: "#6b7280" }}>
            Review UPCs that created new master catalog entries. Approved rows become live catalog items for all stores.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            value={storeUuid}
            onChange={(e) => setStoreUuid(e.target.value)}
            placeholder="Filter by store UUID"
            style={{
              minWidth: 280,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              outline: "none",
              background: "#fff",
            }}
          />
          <button type="button" onClick={() => fetchItems(0)} style={primaryButton}>
            Filter
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: "#fee2e2", color: "#991b1b", fontWeight: 600 }}>
          {error}
        </div>
      )}

      <CrudTable
        columns={[
          "Store",
          "Product",
          "UPC",
          "Package",
          "Qty",
          "Supplier Price",
          "Approval Status",
          "Live State",
          "Actions",
        ]}
        data={tableData as any}
        loading={loading}
        paginate={false}
      />

      <div style={{ marginTop: 18 }}>
        <PaginationControls
          page={page + 1}
          totalPages={Math.max(totalPages, 1)}
          totalItems={Math.max(totalPages, 1) * size}
          pageSize={size}
          onPageChange={(nextPage) => fetchItems(nextPage - 1)}
          showPageSize={false}
          disabled={loading}
        />
      </div>

      <DecisionDialog
        open={!!selected}
        title={decision ? "Approve inventory entry" : "Reject inventory entry"}
        item={selected}
        decision={decision}
        onClose={() => setSelected(null)}
        onSubmit={submitDecision}
      />

      <Toast open={toast.open} message={toast.message} type={toast.type} onClose={() => setToast({ open: false, message: "", type: "info" })} />
    </div>
  );
}

const primaryButton: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: 0,
  background: "#ff6600",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 12px 24px rgba(255,102,0,0.18)",
};
const secondaryPageButton: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};
const disabledButton: React.CSSProperties = {
  ...secondaryPageButton,
  opacity: 0.5,
  cursor: "not-allowed",
};
