// TopPicksModule.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { apiService } from "@/services/apiService"
import { CrudTable } from "./CrudTable"
import { TopPick, Product } from "@/services/types"

/* ------------------ AlertDialog ------------------ */
type CustomAlert = {
  isOpen: boolean
  message: string
  isConfirm: boolean
  onConfirm?: () => Promise<void> | void
  onCancel?: () => void
}

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
}

const AlertDialog: React.FC<{ alert: CustomAlert; onClose: () => void }> = ({ alert, onClose }) => {
  if (!alert.isOpen) return null

  const handleConfirm = async () => {
    if (alert.onConfirm) await alert.onConfirm()
    onClose()
  }

  const handleCancel = () => {
    alert.onCancel?.()
    onClose()
  }

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
  )
}

/* ------------------ TopPicksModule ------------------ */
const formStyles = {
  container: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 8,
    marginBottom: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 15,
    marginBottom: 15,
  },
  label: {
    display: "block",
    marginBottom: 5,
    fontSize: 14,
    fontWeight: 500,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #ddd",
    borderRadius: 4,
    fontSize: 14,
    boxSizing: "border-box" as const,
  },
  button: {
    padding: "10px 16px",
    backgroundColor: "#FF6600",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontWeight: 500,
  },
  optionList: {
    maxHeight: 150,
    overflowY: "auto" as const,
    border: "1px solid #ccc",
    borderRadius: 4,
    marginTop: 4,
  },
  optionItem: {
    padding: "6px 10px",
    cursor: "pointer",
    borderBottom: "1px solid #eee",
  },
  alertBox: {
    backgroundColor: "#fee",
    color: "#c33",
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
    fontSize: 14,
  },
}

export function TopPicksModule() {
  const [topPicks, setTopPicks] = useState<TopPick[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ productUuid: "", rank: "" })
  const [error, setError] = useState<string | null>(null)

  const [editingPick, setEditingPick] = useState<TopPick | null>(null)
  const [editData, setEditData] = useState({ rank: 0, isFeatured: false })

  const [customAlert, setCustomAlert] = useState<CustomAlert>({ isOpen: false, message: "", isConfirm: false })
  const showAlert = (message: string, isConfirm = false, onConfirm?: () => Promise<void> | void, onCancel?: () => void) => {
    setCustomAlert({ isOpen: true, message, isConfirm, onConfirm, onCancel })
  }
  const closeAlert = () => setCustomAlert((s) => ({ ...s, isOpen: false }))

  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [productOptions, setProductOptions] = useState<Product[]>([])
  const [productQuery, setProductQuery] = useState("")
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    loadTopPicks()
    loadProductsCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadTopPicks = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiService.getTopPicks()
      setTopPicks(data.map((t) => ({ ...t, rank: t.rankingScore ?? 0 })))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load top picks"
      setError(msg)
      showAlert(msg)
    } finally {
      setLoading(false)
    }
  }

  const loadProductsCache = async () => {
    try {
      const data = await apiService.getProducts()
      setAllProducts(data)
    } catch (err) {
      console.error("Failed to load products for cache", err)
    }
  }

  const handleProductSearch = (query: string) => {
    setProductQuery(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!query) return setProductOptions([])
      const filtered = allProducts.filter((p) =>
        p.productName.toLowerCase().includes(query.toLowerCase())
      )
      setProductOptions(filtered)
    }, 250)
  }

  const validateRank = (value: string) => {
    const num = Number(value)
    return !isNaN(num) && num > 0
  }

  const handleAdd = async () => {
    if (!formData.productUuid) {
      showAlert("Product UUID is required")
      return
    }
    if (!validateRank(formData.rank)) {
      showAlert("Rank must be a positive number")
      return
    }

    try {
      await apiService.addTopPick(formData.productUuid, Number(formData.rank))
      await loadTopPicks()
      setFormData({ productUuid: "", rank: "" })
      setShowForm(false)
      showAlert("Top pick added successfully!")
    } catch (err: any) {
      let msg = "Failed to add top pick"

      setError(msg)
      showAlert(msg)
    }
  }

const handleDelete = async (t: TopPick) => {
    if (!t.uuid) return showAlert("Cannot delete: missing product UUID");
    const uuid: string = t.uuid; 
      
    showAlert("Are you sure you want to remove this top pick?", true, async () => {
      try {
        await apiService.removeTopPick(uuid); 
        setTopPicks((prev) => prev.filter((x) => x.uuid !== uuid));
        showAlert("Top pick removed successfully!");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to remove top pick";
        setError(msg);
        showAlert(msg);
      }
    });
};

  const openEditModal = (t: TopPick) => {
    setEditingPick(t)
    setEditData({ rank: t.rankingScore, isFeatured: t.isFeatured })
  }

  const handleUpdate = async () => {
    if (!editingPick || !editingPick.uuid) return
    if (!validateRank(String(editData.rank))) return showAlert("Rank must be a positive number")

    try {
      await apiService.updateTopPick(editingPick.uuid, editData.rank, editData.isFeatured)
      await loadTopPicks()
      setEditingPick(null)
      showAlert("Top pick updated successfully!")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update top pick"
      setError(msg)
      showAlert(msg)
    }
  }

  return (
    <div>
      {/* Add Top Pick Button */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => {
            setShowForm(!showForm)
            if (showForm) setFormData({ productUuid: "", rank: "" })
          }}
          style={formStyles.button}
        >
          {showForm ? "Cancel" : "+ Add Top Pick"}
        </button>
      </div>

      {/* Add Top Pick Form */}
      {showForm && (
        <div style={formStyles.container}>
          <div style={formStyles.grid}>
            {/* Product Search */}
            <div style={{ position: "relative" }}>
              <label style={formStyles.label}>Product Name</label>
              <input
                type="text"
                value={productQuery}
                onChange={(e) => handleProductSearch(e.target.value)}
                placeholder="Search product by name..."
                style={formStyles.input}
              />
              {productOptions.length > 0 && (
                <div style={formStyles.optionList}>
                  {productOptions.map((p) => (
                    <div
                      key={p.uuid}
                      onClick={() => {
                        setFormData({ ...formData, productUuid: p.uuid })
                        setProductQuery(p.productName)
                        setProductOptions([])
                      }}
                      style={formStyles.optionItem}
                    >
                      {p.productName}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rank */}
            <div>
              <label style={formStyles.label}>Rank</label>
              <input
                type="number"
                value={formData.rank}
                onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                style={formStyles.input}
              />
            </div>
          </div>

          <button onClick={handleAdd} style={formStyles.button}>
            Add Top Pick
          </button>
        </div>
      )}

      {/* CRUD Table */}
      <CrudTable
        columns={["ID", "Product", "Rank", "Featured", "Actions"]}
        data={topPicks.map((t) => ({
          id: String(t.uuid || t.productId),
          cells: [t.productId, t.productName, t.rankingScore, t.isFeatured ? "✅" : "❌"],
          actions: [
            { label: "Update", onClick: () => openEditModal(t) },
            { label: "Delete", onClick: () => handleDelete(t) },
          ],
        }))}
        loading={loading}
      />

      {/* Edit Modal */}
      {editingPick && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
          onClick={() => setEditingPick(null)}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: 25,
              borderRadius: 8,
              width: 400,
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: 15 }}>Edit Top Pick</h2>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 5, fontWeight: 500 }}>Product Name</label>
              <input
                type="text"
                value={editingPick.productName}
                readOnly
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4, backgroundColor: "#f5f5f5" }}
              />
            </div>

            <div style={{ marginBottom: 15 }}>
              <label style={{ display: "block", marginBottom: 5, fontWeight: 500 }}>Rank</label>
              <input
                type="number"
                value={editData.rank}
                onChange={(e) => setEditData({ ...editData, rank: Number(e.target.value) })}
                style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4 }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
                <input type="checkbox" checked={editData.isFeatured} onChange={(e) => setEditData({ ...editData, isFeatured: e.target.checked })} />
                Featured
              </label>
              {!editData.isFeatured && (
                <div style={{ fontSize: 12, color: "#c33" }}>⚠️ Unchecking will remove this product from top picks.</div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setEditingPick(null)}
                style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: 4, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                style={{ padding: "8px 12px", backgroundColor: "#FF6600", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global alert */}
      <AlertDialog alert={customAlert} onClose={closeAlert} />
    </div>
  )
}
