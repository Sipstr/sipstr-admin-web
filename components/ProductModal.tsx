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
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg shadow-lg relative">
        <h2 className="text-xl font-bold mb-4">{product ? "Update Product" : "Add Product"}</h2>

        <div className="flex flex-col gap-3 max-h-[80vh] overflow-y-auto">
          <input
            type="text"
            name="productName"
            placeholder="Product Name"
            value={formData.productName || ""}
            onChange={handleChange}
            className="border p-2 rounded w-full"
          />
          <textarea
            name="description"
            placeholder="Description"
            value={formData.description || ""}
            onChange={handleChange}
            className="border p-2 rounded w-full"
          />
          <select
            name="brand"
            value={formData.brand || ""}
            onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
            className="border p-2 rounded w-full bg-white"
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
            className="border p-2 rounded w-full bg-white"
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
            className="border p-2 rounded w-full"
          />

          {/* Optional booleans */}
          <div className="flex flex-wrap gap-4 items-center">
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

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-4 py-2 bg-gray-300 rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-[#FF6600] text-white rounded hover:bg-[#e65c00]" onClick={handleSave}>
            {product ? "Update" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;
