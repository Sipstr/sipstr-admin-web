"use client"

import { useState, useEffect, useMemo } from "react"
import { apiService } from "@/services/apiService"
import { CrudTable } from "./CrudTable"

type ModuleType = "brands" | "categories" | "packages"

/* ------------------ Simple Alert Dialog (OK only) ------------------ */
function AlertDialog({
  open,
  title,
  message,
  onClose,
}: {
  open: boolean
  title?: string
  message?: string
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div
      role="alertdialog"
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
          borderRadius: 8,
          padding: 20,
          boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
          {title ?? "Notice"}
        </div>
        <div style={{ marginBottom: 18, color: "#333" }}>{message ?? ""}</div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "#FF6600",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------ Simple Confirm Dialog (Confirm / Cancel) ------------------ */
function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title?: string
  message?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null

  return (
    <div
      role="dialog"
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
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          maxWidth: "100%",
          background: "#fff",
          borderRadius: 8,
          padding: 20,
          boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 600 }}>
          {title ?? "Confirm"}
        </div>
        <div style={{ marginBottom: 18, color: "#333" }}>{message ?? ""}</div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onCancel}
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

          <button
            onClick={onConfirm}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border: "none",
              background: "#FF6600",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
/* ------------------------------------------------------------------ */

export function BCPModule() {
  const [selectedModule, setSelectedModule] = useState<ModuleType>("brands")
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<any>({})
  const [editingId, setEditingId] = useState<string | number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")

  // dialog state for alerts (success/error)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTitle, setDialogTitle] = useState<string | undefined>()
  const [dialogMessage, setDialogMessage] = useState<string | undefined>()

  // confirm dialog state for delete confirmation
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteItem, setPendingDeleteItem] = useState<any | null>(null)

  useEffect(() => {
    loadModuleData(selectedModule)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  const openSuccess = (msg: string) => {
    setDialogTitle("Success")
    setDialogMessage(msg)
    setDialogOpen(true)
  }

  const openError = (msg: string) => {
    setDialogTitle("Error")
    setDialogMessage(msg)
    setDialogOpen(true)
  }

  const loadModuleData = async (module: ModuleType) => {
    setLoading(true)
    setError(null)
    try {
      let res: any[] = []
      if (module === "brands") res = await apiService.getBrands()
      else if (module === "categories") res = await apiService.getCategories()
      else if (module === "packages") res = await apiService.getPackageUnits() // Add this API in apiService
      const normalized = Array.isArray(res) ? res : ((res as any)?.content ?? [])
      setData(Array.isArray(normalized) ? normalized : [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data"
      setError(msg)
      console.error("Failed to load data:", err)
      // show alert as well
      openError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleAddOrUpdate = async () => {
    if (selectedModule === "brands" && !formData.name?.trim()) {
    openError("Brand Name is required")
    return
  }

  if (selectedModule === "categories" && !formData.categoryName?.trim()) {
    openError("Category Name is required")
    return
  }

  if (selectedModule === "packages") {
    if (!formData.packageName?.trim()) {
      openError("Package Name is required")
      return
    }
    if (!formData.packageType) {
      openError("Package Type is required")
      return
    }
  }
    try {
      if (selectedModule === "brands") {
        if (editingId) await apiService.updateBrand(editingId.toString(), formData)
        else await apiService.createBrand(formData)
      } else if (selectedModule === "categories") {
        if (editingId) await apiService.updateCategory(editingId.toString(), formData)
        else await apiService.createCategory(formData)
      } else if (selectedModule === "packages") {
        if (editingId) await apiService.updatePackageUnit(editingId as number, formData)
        else await apiService.createPackageUnit(formData)
      }

      // keep original behaviour (close form + refresh)
      setShowForm(false)
      setEditingId(null)
      setFormData({})
      await loadModuleData(selectedModule)

      // show success alert
      const verb = editingId ? "updated" : "added"
      const name =
        formData.name ?? formData.categoryName ?? formData.packageName ?? selectedModule.slice(0, -1)
      openSuccess(`${String(name)} ${verb} successfully.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save"
      setError(msg)
      console.error("Save error:", err)
      openError(msg)
    }
  }

  const handleEdit = (item: any) => {
    setFormData(item)
    setEditingId(item.id ?? item.categoryId ?? item.packageId)
    setShowForm(true)
  }

  // original delete logic kept; but now we first ask for confirmation via confirm dialog
  const handleDelete = async (item: any) => {
    try {
      if (selectedModule === "brands") await apiService.deleteBrand(item.id)
      else if (selectedModule === "categories") await apiService.deleteCategory(item.categoryId)
      else if (selectedModule === "packages") await apiService.deletePackageUnit(item.packageId)
      await loadModuleData(selectedModule)

      // show success alert
      const name = item.name ?? item.categoryName ?? item.packageName ?? "Item"
      openSuccess(`${String(name)} deleted successfully.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete"
      setError(msg)
      console.error("Delete error:", err)
      openError(msg)
    }
  }

  // called when Delete button clicked in table actions
  const requestDelete = (item: any) => {
    setPendingDeleteItem(item)
    setConfirmOpen(true)
  }

  const confirmDelete = () => {
    if (!pendingDeleteItem) {
      setConfirmOpen(false)
      return
    }
    // call the real delete (keeps behavior same as original)
    handleDelete(pendingDeleteItem)
    setPendingDeleteItem(null)
    setConfirmOpen(false)
  }

  const cancelDelete = () => {
    setPendingDeleteItem(null)
    setConfirmOpen(false)
  }

  const filteredData = useMemo(() => {
    const safeData = Array.isArray(data) ? data : []
    if (!debouncedQuery) return safeData
    const q = debouncedQuery.toLowerCase()
    return safeData.filter((item) => {
      const name =
        item.name ??
        item.categoryName ??
        item.packageName ??
        ""
      const id = item.id ?? item.categoryId ?? item.packageId ?? ""
      return name.toLowerCase().includes(q) || id.toString().includes(q)
    })
  }, [data, debouncedQuery])

  const tableColumns =
    selectedModule === "brands"
      ? ["ID", "Name", "Actions"]
      : selectedModule === "categories"
      ? ["ID", "Category Name", "Description", "Actions"]
      : ["ID", "Package Name", "Type", "Description", "Actions"]

  const tableData = filteredData.map((item) => {
    const id = item.id ?? item.categoryId ?? item.packageId ?? item.package_id
    let cells: any[] = []

    if (selectedModule === "brands") cells = [item.id, item.name]
    else if (selectedModule === "categories")
      cells = [item.categoryId, item.categoryName, item.description]
    else if (selectedModule === "packages")
      cells = [item.packageId, item.packageName, item.packageType, item.description]

    return {
      id,
      cells,
      actions: [
        { label: "Edit", onClick: () => handleEdit(item) },
        // call requestDelete so we can confirm first
        { label: "Delete", onClick: () => requestDelete(item) },
      ],
    }
  })

  return (
    <div>
      {/* Module selector + search + add */}
      {/* Module selector + search + add */}
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          alignItems: "center",
          padding: 12,
          background: "#fff",
          borderRadius: 10,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        {/* Module Selector */}
        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value as ModuleType)}
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            borderRadius: 6,
            background: "#fff",
            outline: "none",
            cursor: "pointer",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "#FF6600")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
        >
          <option value="brands">Brands</option>
          <option value="categories">Categories</option>
          <option value="packages">Packages</option>
        </select>

        {/* Search Box */}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={{
            padding: "10px 14px",
            border: "1px solid #ccc",
            borderRadius: 6,
            minWidth: 220,
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "#FF6600"
            e.currentTarget.style.boxShadow = "0 0 5px rgba(255,102,0,0.3)"
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "#ccc"
            e.currentTarget.style.boxShadow = "none"
          }}
        />

        {/* Add+ Button */}
        <button
          onClick={() => {
            setShowForm(!showForm)
            if (showForm) {
              setFormData({})
              setEditingId(null)
            }
          }}
          style={{
            padding: "10px 20px",
            backgroundColor: "#FF6600",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            transition: "background 0.2s, transform 0.1s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#e65c00")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#FF6600")}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {showForm ? "Cancel" : "+ Add"}
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div
          style={{
            marginBottom: 20,
            padding: 24,
            background: "#fff",
            borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            maxWidth: 500,
          }}
        >
          {selectedModule === "brands" && (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontWeight: 500 }}>Brand Name</label>
              <input
                value={formData.name || ""}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{
                  padding: "10px 12px",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#FF6600")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
              />
            </div>
          )}

          {selectedModule === "categories" && (
            <>
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontWeight: 500 }}>Category Name</label>
                <input
                  value={formData.categoryName || ""}
                  onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FF6600")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
                />
              </div>
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontWeight: 500 }}>Description</label>
                <input
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FF6600")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
                />
              </div>
            </>
          )}

          {selectedModule === "packages" && (
            <>
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontWeight: 500 }}>Package Name</label>
                <input
                  value={formData.packageName || ""}
                  onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FF6600")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
                />
              </div>
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontWeight: 500 }}>Description</label>
                <input
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FF6600")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
                />
              </div>
              <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontWeight: 500 }}>Package Type</label>
                <select
                  value={formData.packageType || ""}
                  onChange={(e) => setFormData({ ...formData, packageType: e.target.value })}
                  style={{
                    padding: "10px 12px",
                    border: "1px solid #ccc",
                    borderRadius: 6,
                    outline: "none",
                    transition: "border-color 0.2s",
                    background: "#fff",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#FF6600")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#ccc")}
                >
                  <option value="">Select Type</option>
                  <option value="CAN">CAN</option>
                  <option value="GLASS_BOTTLE">GLASS_BOTTLE</option>
                  <option value="KEG">KEG</option>
                  <option value="PLASTIC_BOTTLE">PLASTIC_BOTTLE</option>
                  <option value="TETRA_PAK">TETRA_PAK</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </>
          )}

          <button
            onClick={handleAddOrUpdate}
            style={{
              marginTop: 16,
              background: "#FF6600",
              color: "#fff",
              padding: "10px 18px",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 500,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e65c00")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#FF6600")}
          >
            {editingId ? "Update" : "Add"} {selectedModule}
          </button>
        </div>
      )}

      <CrudTable columns={tableColumns} data={tableData} loading={loading} />

      {/* Alert Dialog */}
      <AlertDialog
        open={dialogOpen}
        title={dialogTitle}
        message={dialogMessage}
        onClose={() => {
          setDialogOpen(false)
          setDialogMessage(undefined)
          setDialogTitle(undefined)
          // keep inline error state if you still want to show it
        }}
      />

      {/* Confirm Dialog for delete */}
      <ConfirmDialog
        open={confirmOpen}
        title="Delete item"
        message={`Are you sure you want to delete "${pendingDeleteItem?.name ?? pendingDeleteItem?.categoryName ?? pendingDeleteItem?.packageName ?? "this item"}"?`}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  )
}
