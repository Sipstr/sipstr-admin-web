// UsersModule.tsx
"use client";

import { useState, useEffect } from "react";
import { apiService } from "@/services/apiService";
import { DataTable, ColumnDef, DataTableAction } from "./DataTable";
import { User } from "@/services/types";
import { PaginationControls } from "./PaginationControls";
import { RolesModule } from "./RolesModule";

type AppUser = Partial<User & { role?: any }>;

/* ------------------ BCP-style AlertDialog ------------------ */
type CustomAlert = {
  isOpen: boolean;
  message: string;
  isConfirm: boolean;
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
};

const AlertDialog: React.FC<{ alert: CustomAlert; onClose: () => void }> = ({ alert, onClose }) => {
  if (!alert.isOpen) return null;

  const handleConfirm = async () => {
    try {
      if (alert.onConfirm) await alert.onConfirm();
    } finally {
      onClose();
    }
  };

  const handleCancel = () => {
    if (alert.onCancel) alert.onCancel();
    onClose();
  };

  return (
    <div
      role={alert.isConfirm ? "dialog" : "alertdialog"}
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        background: "rgba(0,0,0,0.35)",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 10,
          padding: 20,
          boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 700, color: "#222" }}>
          {alert.isConfirm ? "Please confirm" : "Notice"}
        </div>

        <div style={{ marginBottom: 18, color: "#333", lineHeight: 1.35 }}>{alert.message}</div>

        <div style={{ display: "flex", gap: 10, justifyContent: alert.isConfirm ? "flex-end" : "center" }}>
          {alert.isConfirm && (
            <button
              onClick={handleCancel}
              style={{
                padding: "8px 12px",
                borderRadius: 6,
                border: "1px solid #ccc",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          )}

          <button
            onClick={handleConfirm}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "#FF6600",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(255,102,0,0.12)",
            }}
          >
            {alert.isConfirm ? "Confirm" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};
/* ---------------------------------------------------------- */

export function UsersModule() {
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewUser, setViewUser] = useState<AppUser | null>(null);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form (uses backend roleName values)
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    mobileNumber: "",
    password: "",
    dob: "",
    roleName: "CUSTOMER" as "CUSTOMER" | "STORE_OWNER" | "ADMIN",
  });

  // Edit form (profile update)
  const [updateForm, setUpdateForm] = useState({
    fullName: "",
    dob: "",
  });

  // search + pagination simple
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);

  // pagination meta from backend
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Alert state (BCP-style)
  const [customAlert, setCustomAlert] = useState<CustomAlert>({
    isOpen: false,
    message: "",
    isConfirm: false,
  });

  const showAlert = (message: string, isConfirm = false, onConfirm?: () => Promise<void> | void, onCancel?: () => void) => {
    setCustomAlert({ isOpen: true, message, isConfirm, onConfirm, onCancel });
  };
  const closeAlert = () => setCustomAlert((s) => ({ ...s, isOpen: false }));

  // Helper: normalize server user -> frontend User shape
  const normalizeUser = (u: any): User => ({
    id: u?.id,
    uuid: u?.uuid,
    email: u?.email ?? "",
    password: u?.password,
    fullName: u?.fullName ?? u?.name ?? "",
    mobileNumber: u?.mobileNumber,
    dob: u?.dob,
    roleName: (u?.roleName ?? (typeof u?.role === "string" ? u.role : u?.role?.name ?? u?.role?.roleName ?? "CUSTOMER")) as User["roleName"],
  });

  // Load users (paginated)
  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, size]);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      console.info("Frontend: fetching users (page:", page, "size:", size, ")");
      const raw: any = await apiService.getUsers(page, size);

      console.debug("getUsers raw response:", raw);

      // backend may return array or paginated object
      let list: any[] = [];
      if (Array.isArray(raw)) {
        list = raw;
        setTotalElements(raw.length);
        setTotalPages(1);
      } else {
        list = raw?.content ?? [];
        const t =
          typeof raw?.totalElements === "number"
            ? raw.totalElements
            : typeof raw?.total === "number"
            ? raw.total
            : Array.isArray(list)
            ? list.length
            : 0;

        setTotalElements(t);
        const tp =
          typeof raw?.totalPages === "number"
            ? raw.totalPages
            : Math.max(1, Math.ceil((t ?? list.length) / size));
        setTotalPages(tp);
      }

      const normalizedList = list.map(normalizeUser);
      setUsers(normalizedList);
      console.debug("Frontend: users loaded", { length: normalizedList.length, page, totalElements });
    } catch (err) {
      console.error("Frontend: failed to load users", err);
      const msg = err instanceof Error ? err.message : "Failed to load users";
      setError(msg);
      showAlert(msg, false);
    } finally {
      setLoading(false);
    }
  };

  // Create user
  const handleCreateUser = async () => {
    const payload = {
      fullName: createForm.fullName,
      email: createForm.email,
      mobileNumber: createForm.mobileNumber || undefined,
      password: createForm.password || undefined,
      dob: createForm.dob || undefined,
    };

    if (!payload.fullName) {
      showAlert("Full name is required", false);
      return;
    }
    if (!payload.email && !payload.mobileNumber) {
      showAlert("Provide at least email or mobile number", false);
      return;
    }
    if(!payload.password){
      showAlert("Password is required",false);
      return;
    }

    try {
      console.info("Frontend: creating user", createForm.roleName, payload);
      const created = await apiService.createUser(payload, createForm.roleName);
      const normalized = normalizeUser(created);

      // Prepend for instant feedback, but reload authoritative page 0 to update totals
      setUsers((prev) => [normalized, ...prev]);
      setPage(0); // triggers useEffect -> loadUsers

      // reset form
      setCreateForm({ fullName: "", email: "", mobileNumber: "", password: "", dob: "", roleName: "CUSTOMER" });
      setShowAddForm(false);

      // show success
      showAlert(`${normalized.fullName ?? "User"} created successfully.`, false);
    } catch (err) {
      console.error("Frontend: create user failed", err);
      const msg = err instanceof Error ? err.message : "Failed to create user";
      setError(msg);
      showAlert(msg, false);
    }
  };

  // View single user
  const openViewUser = async (uuidOrId?: string | number) => {
    if (!uuidOrId) return;
    try {
      console.info("Frontend: fetching user details", uuidOrId);
      const uuid = String(uuidOrId);
      const u = await apiService.getUserByUuid(uuid);
      setViewUser(normalizeUser(u));
    } catch (err) {
      console.error("Frontend: fetch user failed", err);
      const msg = err instanceof Error ? err.message : "Failed to fetch user";
      setError(msg);
      showAlert(msg, false);
    }
  };

  // Edit (open modal)
  const openEditUser = (user: AppUser) => {
    setEditUser(user);
    setUpdateForm({
      fullName: user.fullName ?? "",
      dob: user.dob ? String(user.dob).slice(0, 10) : "",
    });
  };

  // Update user (profile fields only)
  const handleUpdateUser = async () => {
    if (!editUser) return;
    const uuid = editUser.uuid || String(editUser.id || "");
    if (!uuid) {
      showAlert("Missing user id", false);
      return;
    }
    if (!updateForm.fullName) {
      showAlert("Full name required", false);
      return;
    }

    try {
      console.info("Frontend: updating user profile", { uuid, updateForm });
      const updated = await apiService.updateUser(uuid, {
        fullName: updateForm.fullName,
        dob: updateForm.dob || undefined,
      });
      const normalized = normalizeUser(updated);

      // update local list (if present) — otherwise reload page to be safe
      setUsers((prev) => prev.map((u) => (u.uuid === uuid || String(u.id) === uuid ? normalized : u)));
      setEditUser(null);
      setUpdateForm({ fullName: "", dob: "" });

      // success
      showAlert("User Update successfully.", false);
    } catch (err) {
      console.error("Frontend: update user failed", err);
      const msg = err instanceof Error ? err.message : "Failed to update user";
      setError(msg);
      showAlert(msg, false);
    }
  };

  // Delete user (with confirm)
  const handleDeleteUser = async (uuidOrId?: string | number) => {
    if (!uuidOrId) return;

    // Show confirm dialog first
    showAlert(
      "Are you sure you want to delete this user?",
      true,
      async () => {
        try {
          const uuid = String(uuidOrId);
          console.info("Frontend: deleting user", uuid);
          await apiService.deleteUser(uuid);

          // after delete, reload current page to get authoritative content & totals
          await loadUsers();

          // success
          showAlert("User deleted successfully!", false);
        } catch (err) {
          console.error("Frontend: delete user failed", err);
          const msg = err instanceof Error ? err.message : "Failed to delete user";
          setError(msg);
          showAlert(msg, false);
        }
      },
      undefined
    );
  };

  // Filtering (client-side on current page)
  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.fullName ?? "").toLowerCase().includes(q) ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.mobileNumber ?? "").toLowerCase().includes(q)
    );
  });

  // Since users is already the current page content returned by the server,
  // do NOT slice by page again. `paginated` is the current page's filtered results.
  const paginated = filtered;

  // Render
  return (
    <div className="page-container-sidebar page-content">
      <div className="page-header">
        <h2 className="page-title">User Management</h2>
        <p className="page-subtitle">Manage platform users, roles, and profile details.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-4">
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${activeTab === "users" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            onClick={() => setActiveTab("users")}
          >
            Users
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${activeTab === "roles" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
            onClick={() => setActiveTab("roles")}
          >
            Roles
          </button>
        </div>
      </div>

      {activeTab === "roles" ? (
        <RolesModule />
      ) : (
      <div className="page-section">
        <div className="page-section-content">
        <div className="flex gap-2 mb-3 items-center justify-end">
        <button
          onClick={() => {
            setShowAddForm((s) => !s);
            if (showAddForm) {
              setCreateForm({ fullName: "", email: "", mobileNumber: "", password: "", dob: "", roleName: "CUSTOMER" });
            }
          }}
          className="primary-btn"
        >
          {showAddForm ? "Cancel" : "+ Add User"}
        </button>
        <button onClick={() => loadUsers()} disabled={loading} className="secondary-btn" style={{ cursor: loading ? "not-allowed" : "pointer" }}>
          Refresh
        </button>
      </div>

      {showAddForm && (
        <div style={{ background: "#fff", padding: 16, borderRadius: 8, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", marginBottom: 6 }}>Full name</label>
            <input value={createForm.fullName} onChange={(e) => setCreateForm((s) => ({ ...s, fullName: e.target.value }))} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Email</label>
              <input value={createForm.email} onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Mobile</label>
              <input value={createForm.mobileNumber} onChange={(e) => setCreateForm((s) => ({ ...s, mobileNumber: e.target.value }))} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Password</label>
              <input type="password" value={createForm.password} onChange={(e) => setCreateForm((s) => ({ ...s, password: e.target.value }))} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>DOB</label>
              <input type="date" value={createForm.dob} onChange={(e) => setCreateForm((s) => ({ ...s, dob: e.target.value }))} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6 }}>Role</label>
              <select
                value={createForm.roleName}
                onChange={(e) => setCreateForm((s) => ({ ...s, roleName: e.target.value as any }))}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
              >
                <option value="CUSTOMER">Customer</option>
                <option value="STORE_OWNER">Store Owner</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setShowAddForm(false); setCreateForm({ fullName: "", email: "", mobileNumber: "", password: "", dob: "", roleName: "CUSTOMER" }); }} style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid #ddd", background: "#fff" }}>Cancel</button>
            <button onClick={handleCreateUser} style={{ padding: "8px 12px", borderRadius: 6, border: "none", background: "#FF6600", color: "#fff" }}>Create</button>
          </div>
        </div>
      )}

      <DataTable<AppUser>
        storageKey="users-list"
        columns={[
          { key: "id", label: "ID", getValue: (u) => (u.uuid || String(u.id || "")).slice(0, 8) || "-" },
          { key: "fullName", label: "Name", getValue: (u) => u.fullName ?? "-" },
          { key: "email", label: "Email", getValue: (u) => u.email ?? "-" },
          { key: "mobileNumber", label: "Mobile", getValue: (u) => u.mobileNumber ?? "-" },
          { key: "roleName", label: "Role", getValue: (u) => u.roleName ?? (typeof u.role === "string" ? u.role : u.role?.name ?? u.role?.roleName ?? "-"), render: (val) => <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">{val}</span> },
          { key: "dob", label: "DOB", getValue: (u) => u.dob ?? "-", hidden: true },
        ]}
        defaultVisibleColumns={["id", "fullName", "email", "mobileNumber", "roleName"]}
        data={paginated}
        getRowId={(u) => u.uuid || String(u.id || Math.random())}
        loading={loading}
        actions={[
          { label: "View", onClick: (u) => openViewUser(u.uuid || u.id) },
          { icon: "edit", label: "Edit", onClick: (u) => openEditUser(u) },
          { icon: "delete", label: "Delete", onClick: (u) => handleDeleteUser(u.uuid || u.id) },
        ]}
        searchPlaceholder="Search name, email, mobile..."
        searchTerm={search}
        onSearchChange={setSearch}
        emptyMessage="No users found."
        serverPagination={{
          page: page + 1,
          totalPages: Math.max(totalPages, 1),
          totalItems: totalElements,
          pageSize: size,
          onPageChange: (nextPage) => setPage(nextPage - 1),
          onPageSizeChange: (nextSize) => { setSize(nextSize); setPage(0); },
        }}
      />
      </div>
      </div>
      )}

      {/* View modal */}
      {viewUser && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-panel p-5" style={{ width: 520 }}>
            <h3 className="modal-title mb-3">User details</h3>
            <div style={{ marginBottom: 8 }}><strong>Name:</strong> {viewUser.fullName}</div>
            <div style={{ marginBottom: 8 }}><strong>Email:</strong> {viewUser.email || "-"}</div>
            <div style={{ marginBottom: 8 }}><strong>Mobile:</strong> {viewUser.mobileNumber || "-"}</div>
            <div style={{ marginBottom: 8 }}><strong>Role:</strong> {viewUser.roleName || viewUser.role?.name || "-"}</div>
            <div className="modal-footer">
              <button onClick={() => setViewUser(null)} className="modal-btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="modal-overlay" style={{ zIndex: 200 }}>
          <div className="modal-panel p-5" style={{ width: 520 }}>
            <h3 className="modal-title mb-3">Edit user profile</h3>
            <div style={{ marginBottom: 10 }}>
              <label className="modal-label">Full name</label>
              <input value={updateForm.fullName} onChange={(e) => setUpdateForm((s) => ({ ...s, fullName: e.target.value }))} className="modal-input" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label className="modal-label">DOB</label>
              <input type="date" value={updateForm.dob} onChange={(e) => setUpdateForm((s) => ({ ...s, dob: e.target.value }))} className="modal-input" />
            </div>

            <div className="modal-footer">
              <button onClick={() => { setEditUser(null); setUpdateForm({ fullName: "", dob: "" }); }} className="modal-btn-secondary">Cancel</button>
              <button onClick={handleUpdateUser} className="modal-btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Global alert/confirm dialog */}
      <AlertDialog alert={customAlert} onClose={closeAlert} />
    </div>
  );
}
