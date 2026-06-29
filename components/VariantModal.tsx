// VariantModal.tsx
"use client";

import React, { useState, useEffect } from "react";
import { apiService } from "@/services/apiService";
import { ProductVariant } from "@/services/types";

interface VariantModalProps {
  isOpen: boolean;
  onClose: () => void;
  productUuid: string | null;
  productId: number | null;
  onVariantAdded: (variant: ProductVariant) => void; // parent shows add/update success
}

/* Minimal BCP-style AlertDialog used by VariantModal for confirm/delete/fail */
type CustomAlert = {
  isOpen: boolean;
  message: string;
  isConfirm: boolean;
  onConfirm?: () => void;
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
/* ----------------------------------------------------------------------- */

const VariantModal: React.FC<VariantModalProps> = ({ isOpen, onClose, productUuid, productId, onVariantAdded }) => {
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [productActive, setProductActive] = useState(false);
  const [currentVariant, setCurrentVariant] = useState<ProductVariant>({ unitPrice: 0, variantId: 0 } as ProductVariant);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Alert state for confirm/delete/fail messages
  const [customAlert, setCustomAlert] = useState<CustomAlert>({ isOpen: false, message: "", isConfirm: false });

  const showAlert = (message: string, isConfirm = false, onConfirm?: () => void, onCancel?: () => void) =>
    setCustomAlert({ isOpen: true, message, isConfirm, onConfirm, onCancel });
  const closeAlert = () => setCustomAlert({ isOpen: false, message: "", isConfirm: false });

  useEffect(() => {
    if (productUuid) {
      const fetchVariants = async () => {
        try {
          const product = await apiService.getProductById(productUuid);
          setProductActive(Boolean((product as any).isActive ?? (product as any).active ?? false));
          setVariants(product.variantsDTO || []);
        } catch (err) {
          console.error("Failed to fetch variants:", err);
          showAlert("Failed to fetch variants", false);
        }
      };
      fetchVariants();
    } else {
      setVariants([]);
      setProductActive(false);
    }
  }, [productUuid]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentVariant({
      ...currentVariant,
      [name]: [
        "unitPrice",
        "shelfLifeDays",
        "alcoholByVolume",
        "weightGrams",
        "calories",
        "carbs",
        "ibuValue",
        "sugars",
        "addedSugars",
      ].includes(name)
        ? Number(value)
        : value,
    } as any);
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!currentVariant.unitPrice || currentVariant.unitPrice <= 0) newErrors.unitPrice = "Unit Price must be greater than 0";
    return newErrors;
  };

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      let savedVariant: ProductVariant;
      if (editingIndex !== null) {
        // Update existing variant
        const variantToUpdate = variants[editingIndex];
        savedVariant = await apiService.updateVariant(variantToUpdate.variantId.toString(), currentVariant);
        const newVariants = [...variants];
        newVariants[editingIndex] = savedVariant;
        setVariants(newVariants);

        // Notify parent — parent will show "Variant updated successfully!"
        onVariantAdded(savedVariant);
      } else {
        // Create new variant
        if (!productId) throw new Error("Numeric productId is missing");
        savedVariant = await apiService.createVariant(productId.toString(), currentVariant);
        setVariants((prev) => [...prev, savedVariant]);

        // Notify parent — parent will show "Variant added successfully!"
        onVariantAdded(savedVariant);
      }

      // reset local form
      setCurrentVariant({ unitPrice: 0, variantId: 0 } as ProductVariant);
      setEditingIndex(null);
      setShowAdvanced(false);
    } catch (err) {
      console.error(err);
      showAlert("Failed to save variant", false);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setCurrentVariant(variants[index]);
    setShowAdvanced(true);
  };

  const renderStatus = (variant: ProductVariant) => {
    const approval = (variant.approvalStatus ?? "PENDING_APPROVAL").toUpperCase();
    const isLive = approval === "APPROVED" && productActive;
    const approvalStyle =
      approval === "APPROVED"
        ? "bg-emerald-100 text-emerald-700"
        : approval === "REJECTED"
          ? "bg-rose-100 text-rose-700"
          : "bg-amber-100 text-amber-700";

    return (
      <div className="flex flex-wrap gap-2">
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${approvalStyle}`}>{approval}</span>
        <span className={`px-2 py-1 rounded-full text-xs font-bold ${isLive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
          {isLive ? "LIVE" : "PENDING"}
        </span>
      </div>
    );
  };

  const handleDelete = async (index: number) => {
    const variantToDelete = variants[index];
    if (!variantToDelete) return;

    showAlert(
      `Are you sure you want to delete variant "${variantToDelete.packageName}"?`,
      true,
      async () => {
        try {
          await apiService.deleteVariant(variantToDelete.variantId.toString());
          setVariants((prev) => prev.filter((_, i) => i !== index));
          // Local delete success alert (only here)
          showAlert("Variant deleted successfully!", false);
        } catch (err) {
          console.error(err);
          showAlert("Failed to delete variant", false);
        }
      }
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay">
        <div className="modal-panel p-6 max-h-[90vh] overflow-y-auto w-[700px]">
          <h2 className="modal-title mb-4">Manage Product Variants</h2>

          {variants.length > 0 && (
            <div className="mb-4">
              <h3 className="text-base font-semibold text-gray-800 mb-2">Existing Variants</h3>
              <table className="w-full border-collapse text-black">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="border p-2">Package Name</th>
                    <th className="border p-2">UPC</th>
                    <th className="border p-2">Unit Price</th>
                    <th className="border p-2">Approval</th>
                    <th className="border p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={v.variantId}>
                      <td className="border p-2">{v.packageName}</td>
                      <td className="border p-2">{v.upc}</td>
                      <td className="border p-2">{v.unitPrice}</td>
                      <td className="border p-2">{renderStatus(v)}</td>
                      <td className="border p-2 flex gap-2">
                        <button className="px-2 py-1 bg-orange-500 text-white rounded hover:bg-orange-600" onClick={() => handleEdit(i)}>
                          Update
                        </button>
                        <button className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-800" onClick={() => handleDelete(i)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Variant form */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-gray-800">{editingIndex !== null ? "Edit Variant" : "Add New Variant"}</h3>

            <div>
              <label className="modal-label">Package Name</label>
              <input name="packageName" value={currentVariant.packageName || ""} onChange={handleChange} className="modal-input" />
            </div>

            <div>
              <label className="modal-label">Unit Price *</label>
              <input name="unitPrice" type="number" value={currentVariant.unitPrice} onChange={handleChange} className="modal-input" />
              {errors.unitPrice && <p className="text-sm text-red-600 mt-1">{errors.unitPrice}</p>}
            </div>

            <div>
              <label className="modal-label">UPC</label>
              <input name="upc" value={currentVariant.upc || ""} onChange={handleChange} className="modal-input" />
            </div>

            <div>
              <label className="modal-label">Thumbnail Image</label>
              {currentVariant.thumbnailImageUrl && (
                <img src={currentVariant.thumbnailImageUrl} alt="Thumbnail" className="w-16 h-16 object-cover rounded border border-gray-200 mb-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-50 cursor-pointer inline-flex items-center gap-1">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => setCurrentVariant((prev) => ({ ...prev, thumbnailImageUrl: reader.result as string }));
                    reader.readAsDataURL(file);
                  }} />
                </label>
                <input name="thumbnailImageUrl" value={currentVariant.thumbnailImageUrl || ""} onChange={handleChange} className="modal-input flex-1" placeholder="Or paste URL" />
              </div>
            </div>

            <div>
              <label className="modal-label">Full Size Image</label>
              {currentVariant.fullSizeImageUrl && (
                <img src={currentVariant.fullSizeImageUrl} alt="Full size" className="w-16 h-16 object-cover rounded border border-gray-200 mb-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <div className="flex items-center gap-2">
                <label className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-50 cursor-pointer inline-flex items-center gap-1">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onloadend = () => setCurrentVariant((prev) => ({ ...prev, fullSizeImageUrl: reader.result as string }));
                    reader.readAsDataURL(file);
                  }} />
                </label>
                <input name="fullSizeImageUrl" value={currentVariant.fullSizeImageUrl || ""} onChange={handleChange} className="modal-input flex-1" placeholder="Or paste URL" />
              </div>
            </div>

            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="mt-2 text-blue-600 underline">
              {showAdvanced ? "Hide Advanced Details" : "Show Advanced Details"}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-2 modal-divider pt-3">
                {[
                  { label: "Shelf Life (Days)", name: "shelfLifeDays" },
                  { label: "Alcohol By Volume", name: "alcoholByVolume" },
                  { label: "Weight (grams)", name: "weightGrams" },
                  { label: "Calories", name: "calories" },
                  { label: "Carbs", name: "carbs" },
                  { label: "IBU Value", name: "ibuValue" },
                  { label: "Sugars", name: "sugars" },
                  { label: "Added Sugars", name: "addedSugars" },
                ].map((field) => (
                  <div key={field.name}>
                    <label className="modal-label">{field.label}</label>
                    <input name={field.name} type="number" value={(currentVariant as any)[field.name] || ""} onChange={handleChange} className="modal-input" />
                  </div>
                ))}

                <div>
                  <label className="modal-label">Dimensions (cm)</label>
                  <input name="dimensionsCm" value={currentVariant.dimensionsCm || ""} onChange={handleChange} className="modal-input" />
                </div>

                <div>
                  <label className="modal-label">Storage Instructions</label>
                  <input name="storageInstructions" value={currentVariant.storageInstructions || ""} onChange={handleChange} className="modal-input" />
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button onClick={onClose} className="modal-btn-secondary">
              Cancel
            </button>
            <button onClick={handleSubmit} className="modal-btn-primary">
              {editingIndex !== null ? "Update Variant" : "Add Variant"}
            </button>
          </div>
        </div>
      </div>

      {/* Alert dialog for VariantModal (confirm/delete/fail/success for delete) */}
      <AlertDialog alert={customAlert} onClose={closeAlert} />
    </>
  );
};

export default VariantModal;
