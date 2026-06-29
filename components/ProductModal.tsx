"use client";

import React, { useState, useEffect } from "react";
import { apiService } from "@/services/apiService";
import { Brand, Category, Product } from "@/services/types";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null; // if null => add new, else => update
  onProductSaved: (product: Product) => void;
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, product, onProductSaved }) => {
  const [formData, setFormData] = useState<Partial<Product>>({});
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    apiService.getBrands().then(setBrands).catch(() => {});
    apiService.getCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      // Defaults for new product
      setFormData({
        productName: "",
        description: "",
        brand: "",
        categoryName: "",
        taxCategory: "General",
        isAlcoholic: false,
        isGlutenFree: false,
        isKosher: false,
        isWine: false,
        hasTobacco: false,
        hasCannabis: false,
        isReturnable: true,
        isPerishable: false,
        allergenInfo: "",
        nutritionalInfo: "",
        isActive: true, // default active for newly created products
      });
    }
  }, [product]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSave = async () => {
    console.log("Saving product:", formData);
    try {
      let savedProduct: Product;
      if (product?.uuid) {
        // update existing
        savedProduct = await apiService.updateProduct(product.uuid, formData);
        console.log("formdata",formData.isActive);
        console.log(product.isActive);
      } else {
        // create new
        savedProduct = await apiService.createProduct(formData);
      }
      onProductSaved(savedProduct);
      onClose();
    } catch (err) {
      console.error("Failed to save product:", err);
      alert("Failed to save product. Check console for details.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-panel p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="modal-title mb-4">{product ? "Update Product" : "Add Product"}</h2>

        <div className="modal-section">
          <input
            type="text"
            name="productName"
            placeholder="Product Name"
            value={formData.productName || ""}
            onChange={handleChange}
            className="modal-input"
          />
          <textarea
            name="description"
            placeholder="Description"
            value={formData.description || ""}
            onChange={handleChange}
            className="w-full min-h-24 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900"
          />
          <select
            name="brand"
            value={formData.brand || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
            className="modal-input bg-white"
          >
            <option value="">-- Select Brand --</option>
            {brands.map((b) => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
          <select
            name="categoryName"
            value={formData.categoryName || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, categoryName: e.target.value }))}
            className="modal-input bg-white"
          >
            <option value="">-- Select Category --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <input
            type="text"
            name="taxCategory"
            placeholder="Tax Category"
            value={formData.taxCategory || ""}
            onChange={handleChange}
            className="modal-input"
          />

          {/* Optional booleans */}
          <div className="modal-divider pt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isAlcoholic"
                checked={!!formData.isAlcoholic}
                onChange={handleChange}
              />
              Alcoholic
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isGlutenFree"
                checked={!!formData.isGlutenFree}
                onChange={handleChange}
              />
              Gluten Free
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isKosher"
                checked={!!formData.isKosher}
                onChange={handleChange}
              />
              Kosher
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isReturnable"
                checked={formData.isReturnable ?? true}
                onChange={handleChange}
              />
              Returnable
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isPerishable"
                checked={formData.isPerishable ?? false}
                onChange={handleChange}
              />
              Perishable
            </label>
            {/* Active checkbox */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive ?? true}
                onChange={handleChange}
              />
              Active
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn-primary" onClick={handleSave}>
            {product ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
