// ProductModules.tsx
"use client";

import React, { useState, useEffect } from "react";
import { apiService } from "@/services/apiService";
import { Product } from "@/services/types";
import ProductModal from "@/components/ProductModal";
import VariantModal from "@/components/VariantModal";
import { PaginationControls } from "./PaginationControls";

/* ---------------- BCP-style AlertDialog (used by ProductModules) ---------------- */
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
          {alert.isConfirm ? "Please confirm" : "Note"}
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
/* ------------------------------------------------------------------------------- */

type FilterOption = "ALL" | "ACTIVE" | "INACTIVE";

const ProductModules: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [selectedProductUuid, setSelectedProductUuid] = useState<string | null>(null);
  const [selectedProductNumericId, setSelectedProductNumericId] = useState<number | null>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterOption>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Custom alert state (BCP-style)
  const [customAlert, setCustomAlert] = useState<CustomAlert>({
    isOpen: false,
    message: "",
    isConfirm: false,
  });

  const showAlert = (message: string, isConfirm = false, onConfirm?: () => void, onCancel?: () => void) => {
    setCustomAlert({ isOpen: true, message, isConfirm, onConfirm, onCancel });
  };
  const closeAlert = () => setCustomAlert((s) => ({ ...s, isOpen: false }));

  // Fetch products
  const fetchProducts = async () => {
    try {
      const data = await apiService.getProducts();
      setProducts(data);
      setFilteredProducts(data);
    } catch (err) {
      console.error("Failed to fetch products:", err);
      showAlert("Failed to fetch products.", false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtering logic
  useEffect(() => {
    const term = searchTerm.trim().toLowerCase();

    const matchesSearch = (p: Product) => {
      if (!term) return true;
      return (
        (p.productName ?? "").toLowerCase().includes(term) ||
        (p.categoryName ?? "").toLowerCase().includes(term) ||
        (p.brand ?? "").toLowerCase().includes(term)
      );
    };

    const matchesFilter = (p: Product) => {
      const isActive = (p as any).isActive ?? (p as any).active ?? false;
      if (filter === "ALL") return true;
      if (filter === "ACTIVE") return Boolean(isActive);
      return !Boolean(isActive);
    };

    setFilteredProducts(products.filter((p) => matchesSearch(p) && matchesFilter(p)));
  }, [searchTerm, filter, products]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filter, products.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const pagedProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  // Product create/update handler (shows success)
  const handleProductSaved = (savedProduct: Product) => {
    const existed = products.some((p) => p.uuid === savedProduct.uuid);

    setProducts((prev) => {
      const exists = prev.find((p) => p.uuid === savedProduct.uuid);
      if (exists) return prev.map((p) => (p.uuid === savedProduct.uuid ? savedProduct : p));
      return [savedProduct, ...prev];
    });

    setFilteredProducts((prev) => {
      const exists = prev.find((p) => p.uuid === savedProduct.uuid);
      if (exists) return prev.map((p) => (p.uuid === savedProduct.uuid ? savedProduct : p));
      return [savedProduct, ...prev];
    });

    const verb = existed ? "updated" : "created";
    showAlert(`${savedProduct.productName ?? "Product"} ${verb} successfully.`, false);
  };

  // UPDATED: parent owns variant success messages (add/update)
  const handleVariantAdded = (incomingVariant: any, productUuidArg?: string) => {
    const ownerUuid = productUuidArg ?? selectedProductUuid;
    if (!ownerUuid) return;

    let isNew = true;

    setProducts((prev) =>
      prev.map((product) => {
        if (product.uuid !== ownerUuid) return product;

        const variants = product.variantsDTO ?? [];
        const exists = variants.find((v: any) => v.variantId === incomingVariant.variantId);

        let newVariants;
        if (exists) {
          isNew = false;
          newVariants = variants.map((v: any) => (v.variantId === incomingVariant.variantId ? incomingVariant : v));
        } else {
          newVariants = [...variants, incomingVariant];
        }

        return { ...product, variantsDTO: newVariants };
      })
    );

    setFilteredProducts((prev) =>
      prev.map((product) => {
        if (product.uuid !== ownerUuid) return product;

        const variants = product.variantsDTO ?? [];
        const exists = variants.find((v: any) => v.variantId === incomingVariant.variantId);

        let newVariants;
        if (exists) {
          newVariants = variants.map((v: any) => (v.variantId === incomingVariant.variantId ? incomingVariant : v));
        } else {
          newVariants = [...variants, incomingVariant];
        }

        return { ...product, variantsDTO: newVariants };
      })
    );

    if (isNew) showAlert("Variant added successfully!", false);
    else showAlert("Variant updated successfully!", false);
  };

  // Toggle active
  const toggleActive = async (product: Product) => {
    try {
      const current = (product as any).isActive ?? (product as any).active ?? false;
      const desired = !current;
      const updated = await apiService.updateProduct(product.uuid!, { isActive: desired });
      const newProduct =
        updated && (updated as Product).uuid ? (updated as Product) : { ...product, isActive: desired, active: desired };
      setProducts((prev) => prev.map((p) => (p.uuid === product.uuid ? newProduct : p)));
      setFilteredProducts((prev) => prev.map((p) => (p.uuid === product.uuid ? newProduct : p)));
    } catch (err) {
      console.error("Failed to toggle active:", err);
      showAlert("Failed to update product status", false);
    }
  };

  // Delete product
  const handleDeleteProduct = async (product: Product) => {
    showAlert(
      `Are you sure you want to delete "${product.productName}"?`,
      true,
      async () => {
        try {
          await apiService.deleteProduct(product.uuid!);
          setProducts((prev) => prev.filter((p) => p.uuid !== product.uuid));
          setFilteredProducts((prev) => prev.filter((p) => p.uuid !== product.uuid));
          showAlert("Product deleted successfully!", false);
        } catch (err) {
          console.error(err);
          showAlert("Failed to delete product", false);
        }
      }
    );
  };

  return (
    <div className="page-container-sidebar page-content">
      <div className="page-header">
        <h2 className="page-title">Product Catalog</h2>
        <p className="page-subtitle">Manage products, variants, and live status in the master catalog.</p>
      </div>

      <div className="page-section">
        <div className="page-section-content">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <button
          className="primary-btn"
          onClick={() => {
            setEditingProduct(null);
            setIsProductModalOpen(true);
          }}
        >
          Add Product
        </button>
      </div>

      {/* Search + Filter Row */}
      <div className="mb-4 flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search by Name, Brand, Category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="filter-input w-full"
        />

        <div>
          <label htmlFor="activeFilter" className="sr-only">
            Filter Active
          </label>
          <select
            id="activeFilter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterOption)}
            className="filter-select"
            title="Filter by active/inactive"
          >
            <option value="ALL">All</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="table-shell">
      <table className="table-base">
        <thead>
          <tr className="table-head-row">
            <th className="table-head-cell">Product ID</th>
            <th className="table-head-cell">Name</th>
            <th className="table-head-cell">Category</th>
            <th className="table-head-cell">Brand</th>
            <th className="table-head-cell text-center">Active</th>
            <th className="table-head-cell text-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProducts.length === 0 && (
            <tr>
              <td colSpan={6} className="table-cell text-center text-gray-500 py-6">
                No products found.
              </td>
            </tr>
          )}

          {pagedProducts.map((product) => {
            const isActive = (product as any).isActive ?? (product as any).active ?? false;
            return (
              <tr key={product.uuid} className="table-row table-row-hover">
                <td className="table-cell">{product.uuid}</td>
                <td className="table-cell">{product.productName}</td>
                <td className="table-cell">{product.categoryName || "-"}</td>
                <td className="table-cell">{product.brand || "-"}</td>

                <td className="table-cell text-center">
                  <button
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold ${isActive ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-700"}`}
                    onClick={() => toggleActive(product)}
                  >
                    {isActive ? "Active" : "Inactive"}
                  </button>
                </td>

                <td className="table-action-cell">
                  <div className="table-actions">
                  <button
                    className="table-action-btn-success"
                    onClick={() => {
                      setSelectedProductUuid(product.uuid || null);
                      setSelectedProductNumericId(product.productId ?? null);
                      setIsVariantModalOpen(true);
                    }}
                  >
                    View / Add Variants
                  </button>

                  <button
                    className="table-action-btn-info"
                    onClick={() => {
                      setEditingProduct(product);
                      setIsProductModalOpen(true);
                    }}
                  >
                    Update
                  </button>

                  <button
                    className="table-action-btn-danger"
                    onClick={() => handleDeleteProduct(product)}
                  >
                    Delete
                  </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 mt-3">
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalItems={filteredProducts.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Modals */}
      <ProductModal isOpen={isProductModalOpen} onClose={() => setIsProductModalOpen(false)} product={editingProduct} onProductSaved={handleProductSaved} />

      <VariantModal
        isOpen={isVariantModalOpen}
        onClose={() => setIsVariantModalOpen(false)}
        productUuid={selectedProductUuid}
        productId={selectedProductNumericId}
        onVariantAdded={(variant) => handleVariantAdded(variant, selectedProductUuid ?? undefined)}
      />

      {/* AlertDialog */}
      <AlertDialog alert={customAlert} onClose={closeAlert} />
      </div>
      </div>
    </div>
  );
};

export default ProductModules;
