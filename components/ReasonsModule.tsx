import React, { useEffect, useRef, useState } from "react";
import { apiService } from "@/services/apiService";
import type { StoreCancelReasonRequestDTO, StoreCancelReasonResponseDTO } from "@/services/types";

// ReasonsModule.tsx
// Admin UI for managing store cancel reasons.
// - Matches colors / alert UX from your TopPicksModule example
// - Uses apiService.getCancelReasons/createCancelReason/updateCancelReason/deleteCancelReason
// - Shows success, error and confirm alerts with the same dialog style

/* ------------------ AlertDialog (shared) ------------------ */
type CustomAlert = {
  isOpen: boolean;
  message: string;
  isConfirm: boolean;
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
};

const alertStyles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    background: "rgba(0,0,0,0.35)",
    padding: 16,
  },
  dialog: {
    width: 420,
    maxWidth: "100%",
    background: "#fff",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  },
  title: {
    marginBottom: 8,
    fontSize: 18,
    fontWeight: 700,
    color: "#222",
  },
  message: {
    marginBottom: 18,
    color: "#333",
    lineHeight: 1.35,
  },
  actions: (isConfirm: boolean) => ({
    display: "flex",
    gap: 10,
    justifyContent: isConfirm ? "flex-end" : "center",
  }),
  cancelButton: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
  },
  confirmButton: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    background: "#FF6600",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(255,102,0,0.12)",
  },
};

const AlertDialog: React.FC<{ alert: CustomAlert; onClose: () => void }> = ({ alert, onClose }) => {
  if (!alert.isOpen) return null;

  const handleConfirm = async () => {
    if (alert.onConfirm) await alert.onConfirm();
    onClose();
  };
  const handleCancel = () => {
    alert.onCancel?.();
    onClose();
  };

  return (
    <div role={alert.isConfirm ? "dialog" : "alertdialog"} aria-modal="true" style={alertStyles.overlay} onClick={onClose}>
      <div style={alertStyles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={alertStyles.title}>{alert.isConfirm ? "Please confirm" : "Notice"}</div>
        <div style={alertStyles.message}>{alert.message}</div>
        <div style={alertStyles.actions(alert.isConfirm)}>
          {alert.isConfirm && (
            <button onClick={handleCancel} style={alertStyles.cancelButton}>
              Cancel
            </button>
          )}
          <button onClick={handleConfirm} style={alertStyles.confirmButton}>
            {alert.isConfirm ? "Confirm" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ------------------ Styles for ReasonsModule (follow TopPicks look) ------------------ */
const containerStyles: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: 20 };
const cardStyles: React.CSSProperties = { background: "#fff", padding: 18, borderRadius: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 14 };
const headerStyles: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 };
const primaryButton: React.CSSProperties = { padding: "10px 14px", backgroundColor: "#FF6600", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 };
const secondaryButton: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer" };
const inputStyles: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1px solid #e6e6e6", borderRadius: 6, boxSizing: "border-box" };
const dangerText: React.CSSProperties = { color: "#c33", fontSize: 13, marginTop: 8 };

/* ------------------ ReasonsModule component ------------------ */
export function ReasonsModule() {
  const [reasons, setReasons] = useState<StoreCancelReasonResponseDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StoreCancelReasonResponseDTO | null>(null);
  const [form, setForm] = useState<StoreCancelReasonRequestDTO>({ reason: "", description: "" });
  const [saving, setSaving] = useState(false);

  const [customAlert, setCustomAlert] = useState<CustomAlert>({ isOpen: false, message: "", isConfirm: false });
  const showAlert = (message: string, isConfirm = false, onConfirm?: () => Promise<void> | void, onCancel?: () => void) => {
    setCustomAlert({ isOpen: true, message, isConfirm, onConfirm, onCancel });
  };
  const closeAlert = () => setCustomAlert((s) => ({ ...s, isOpen: false }));

  const reasonRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadReasons();
  }, []);

  const loadReasons = async () => {
    setLoading(true);
    try {
      const data = await apiService.getCancelReasons();
      setReasons(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load reasons";
      showAlert(msg);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ reason: "", description: "" });
    setShowForm(true);
    setTimeout(() => reasonRef.current?.focus(), 100);
  };

  const openEdit = (r: StoreCancelReasonResponseDTO) => {
    setEditing(r);
    setForm({ reason: r.reason, description: r.description ?? "" });
    setShowForm(true);
    setTimeout(() => reasonRef.current?.focus(), 100);
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.reason || form.reason.trim().length === 0) return showAlert("Reason is required");

    setSaving(true);
    try {
      if (editing) {
        const updated = await apiService.updateCancelReason(editing.id, { reason: form.reason.trim(), description: form.description?.trim() });
        setReasons((cur) => cur.map((c) => (c.id === updated.id ? updated : c)));
        showAlert("Reason updated successfully!");
      } else {
        const created = await apiService.createCancelReason({ reason: form.reason.trim(), description: form.description?.trim() });
        setReasons((cur) => [created, ...cur]);
        showAlert("Reason created successfully!");
      }
      setShowForm(false);
    } catch (err: any) {
      const msg = err?.message ?? "Save failed";
      showAlert(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: StoreCancelReasonResponseDTO) => {
    showAlert(`Are you sure you want to delete reason \"${r.reason}\"?`, true, async () => {
      try {
        await apiService.deleteCancelReason(r.id);
        setReasons((cur) => cur.filter((x) => x.id !== r.id));
        showAlert("Reason deleted successfully!");
      } catch (err: any) {
        const msg = err?.message ?? "Delete failed";
        showAlert(msg);
      }
    });
  };

  return (
    <div style={containerStyles}>
      <div style={headerStyles}>
        <h2 style={{ margin: 0 }}>Store Cancel Reasons</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={secondaryButton} onClick={loadReasons} aria-label="Refresh reasons">
            Refresh
          </button>
          <button style={primaryButton} onClick={openCreate} aria-label="Add reason">
            + New Reason
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} style={cardStyles} aria-label="reason-form">
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Reason (unique)</label>
              <input
                ref={reasonRef}
                value={form.reason}
                onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))}
                style={inputStyles}
                placeholder="e.g. OUT_OF_STOCK"
                required
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                style={{ ...inputStyles, minHeight: 80 }}
                placeholder="Optional description"
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button type="button" onClick={() => setShowForm(false)} style={secondaryButton}>
                Cancel
              </button>
              <button type="submit" disabled={saving} style={primaryButton}>
                {saving ? "Saving..." : editing ? "Save changes" : "Create reason"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div>
        {loading ? (
          <div style={{ padding: 18, background: "#fff", borderRadius: 8 }}>Loading…</div>
        ) : reasons.length === 0 ? (
          <div style={cardStyles}>No reasons found.</div>
        ) : (
          reasons.map((r) => (
            <div key={r.id} style={cardStyles}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.reason}</div>
                  <div style={{ marginTop: 6, color: "#555" }}>{r.description}</div>
                  {r.deleted && <div style={{ marginTop: 8, color: "#c67d00", fontSize: 13 }}>(deleted)</div>}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={secondaryButton} onClick={() => openEdit(r)}>
                      Edit
                    </button>
                    <button
                      style={{ ...primaryButton, backgroundColor: "#e53a3a" }}
                      onClick={() => handleDelete(r)}
                    >
                      Delete
                    </button>
                  </div>
                  <div style={{ color: "#888", fontSize: 12 }}>ID: {r.id}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AlertDialog alert={customAlert} onClose={closeAlert} />
    </div>
  );
}
