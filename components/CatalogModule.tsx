"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiService } from "@/services/apiService";
import { apiCall } from "@/services/api";
import type { Brand, Category, PackageUnit, Product, ProductVariant, TopPick } from "@/services/types";
import { PaginationControls } from "./PaginationControls";
import { Columns3, Pencil, Trash2, Upload } from "lucide-react";

function formatMoney(value?: number) {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${Number(value).toFixed(2)}`;
}

type TabKey = "products" | "brands" | "packages" | "categories" | "topPicks";
type SortDirection = "asc" | "desc";

type TableRow = {
  id: string;
  data: Record<string, string | number | boolean | null | undefined>;
  raw: Product | Brand | PackageUnit | Category | TopPick;
};

const TAB_LABELS: Record<TabKey, string> = {
  products: "Product",
  brands: "Brand",
  packages: "Package",
  categories: "Categories",
  topPicks: "Top Picks",
};

// Default visible columns per tab — shown before any user customisation
const DEFAULT_COLUMNS: Record<TabKey, string[]> = {
  products: ["productName", "brand", "categoryName", "variants", "status"],
  brands: ["id", "name"],
  packages: ["packageId", "packageName", "packageType", "description"],
  categories: ["id", "name", "description", "imageUrl"],
  topPicks: ["productName", "rankingScore", "isFeatured"],
};

const COLUMN_PREFS_KEY = "catalog-visible-columns-v2";

/** camelCase / PascalCase key → readable label, e.g. "productName" → "Product Name" */
function toLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Flatten a raw API object into scalar key→value pairs.
 * Arrays and nested objects are skipped — add computed extras instead.
 */
function flattenRaw(
  obj: Record<string, unknown>,
  extras?: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null | undefined> {
  const result: Record<string, string | number | boolean | null | undefined> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === null) { result[k] = null; continue; }
    if (Array.isArray(v) || typeof v === "object") continue;
    result[k] = v as string | number | boolean;
  }
  if (extras) Object.assign(result, extras);
  return result;
}

function compareValues(a: unknown, b: unknown) {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

function FilterInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <input
      className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Filter"
    />
  );
}

function DetailModal({
  open,
  title,
  row,
  loading,
  onClose,
  onSave,
  onDelete,
  isCreating,
}: {
  open: boolean;
  title: string;
  row: TableRow | null;
  loading: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  isCreating?: boolean;
}) {
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!row) {
      setEditData({});
      setImagePreview(null);
      return;
    }

    const next: Record<string, unknown> = {};
    Object.entries(row.raw as unknown as Record<string, unknown>).forEach(([k, v]) => {
      if (typeof v === "function") return;
      if (v === undefined) return;
      next[k] = v;
    });
    setEditData(next);
    // Set image preview from existing data
    const imgUrl = (next.imageUrl as string) || (next.thumbnailImageUrl as string) || null;
    setImagePreview(imgUrl);
  }, [row]);

  if (!open || !row) return null;

  const editableEntries = Object.entries(editData).filter(([k, v]) => {
    if (!isCreating && ["uuid", "productId", "packageId", "id", "variantsDTO"].includes(k)) return false;
    if (isCreating && ["variantsDTO"].includes(k)) return false;
    if (typeof v === "object" && v !== null) return false;
    return true;
  });

  const isImageField = (key: string) => key.toLowerCase().includes("imageurl") || key.toLowerCase().includes("image_url") || key === "thumbnailImageUrl" || key === "fullSizeImageUrl";

  const handleFileSelect = (key: string, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setEditData((prev) => ({ ...prev, [key]: base64 }));
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel p-5 max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title text-lg mb-3">{title}</h3>

        <div className="max-h-[55vh] overflow-auto space-y-3">
          {editableEntries.map(([k, v]) => {
            const isBool = typeof v === "boolean";
            const isImg = isImageField(k);
            return (
              <div key={k} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className="text-sm font-medium text-gray-700 md:col-span-1">{k}</label>
                {isBool ? (
                  <select
                    className="modal-input md:col-span-2"
                    value={String(Boolean(v))}
                    onChange={(e) => setEditData((prev) => ({ ...prev, [k]: e.target.value === "true" }))}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : isImg ? (
                  <div className="md:col-span-2 space-y-2">
                    {imagePreview && (
                      <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded border border-gray-200" />
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-1.5 text-xs rounded border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} /> Upload Image
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(k, e.target.files?.[0] ?? null)}
                      />
                      <input
                        className="modal-input flex-1"
                        value={v == null ? "" : String(v)}
                        onChange={(e) => {
                          setEditData((prev) => ({ ...prev, [k]: e.target.value }));
                          setImagePreview(e.target.value || null);
                        }}
                        placeholder="Or paste image URL"
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    className="modal-input md:col-span-2"
                    value={v == null ? "" : String(v)}
                    onChange={(e) => setEditData((prev) => ({ ...prev, [k]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <button className="modal-btn-secondary" onClick={onClose} disabled={loading}>Close</button>
          {!isCreating && <button className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-60" onClick={onDelete} disabled={loading}>Delete</button>}
          <button className="modal-btn-primary disabled:opacity-60" onClick={() => onSave(editData)} disabled={loading}>{isCreating ? "Create" : "Update"}</button>
        </div>
      </div>
    </div>
  );
}

export function CatalogModule() {
  const [activeTab, setActiveTab] = useState<TabKey>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [packageUnits, setPackageUnits] = useState<PackageUnit[]>([]);
  const [topPicks, setTopPicks] = useState<TopPick[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Partial<Record<TabKey, string[]>>>({});
  const [columnFilters, setColumnFilters] = useState<Partial<Record<TabKey, Record<string, string>>>>({});
  const [sortState, setSortState] = useState<Partial<Record<TabKey, { key: string; dir: SortDirection }>>>({});
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<TableRow | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(COLUMN_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<Record<TabKey, string[]>>;
      if (!parsed || typeof parsed !== "object") return;

      const sanitized: Partial<Record<TabKey, string[]>> = {};
      (Object.keys(TAB_LABELS) as TabKey[]).forEach((tab) => {
        // Accept any saved column keys — validity checked at render time against actual data
        const incoming = Array.isArray(parsed[tab]) ? (parsed[tab] as string[]) : [];
        if (incoming.length > 0) sanitized[tab as TabKey] = incoming;
      });

      setVisibleColumns(sanitized);
    } catch {
      // Ignore malformed saved preferences.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify(visibleColumns));
    } catch {
      // Ignore storage write failures.
    }
  }, [visibleColumns]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === "products") {
          const prodRes = await apiCall<any>("GET", `/products?page=${Math.max(0, page - 1)}&size=${pageSize}`);
          const productRows = Array.isArray(prodRes) ? prodRes : (prodRes?.content ?? []);
          const pageCount = Array.isArray(prodRes) ? 1 : Number(prodRes?.totalPages ?? 1);
          const itemCount = Array.isArray(prodRes) ? productRows.length : Number(prodRes?.totalElements ?? productRows.length);
          setProducts(Array.isArray(productRows) ? productRows : []);
          setTotalPages(Math.max(1, Number.isFinite(pageCount) ? pageCount : 1));
          setTotalItems(Number.isFinite(itemCount) ? itemCount : 0);

          const [brandRes, categoryRes, packageRes] = await Promise.all([
            apiService.getBrands(),
            apiService.getCategories(),
            apiService.getPackageUnits(),
          ]);
          setBrands(Array.isArray(brandRes) ? brandRes : ((brandRes as any)?.content ?? []));
          setCategories(Array.isArray(categoryRes) ? categoryRes : ((categoryRes as any)?.content ?? []));
          setPackageUnits(Array.isArray(packageRes) ? packageRes : ((packageRes as any)?.content ?? []));
          return;
        }

        if (activeTab === "brands") {
          const brandRes = await apiService.getBrands();
          setBrands(Array.isArray(brandRes) ? brandRes : ((brandRes as any)?.content ?? []));
        }

        if (activeTab === "categories") {
          const categoryRes = await apiService.getCategories();
          setCategories(Array.isArray(categoryRes) ? categoryRes : ((categoryRes as any)?.content ?? []));
        }

        if (activeTab === "packages") {
          const packageRes = await apiService.getPackageUnits();
          setPackageUnits(Array.isArray(packageRes) ? packageRes : ((packageRes as any)?.content ?? []));
        }

        if (activeTab === "topPicks") {
          const tpRes = await apiService.getTopPicks();
          setTopPicks(Array.isArray(tpRes) ? tpRes : []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load catalog data.");
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [activeTab, page, pageSize]);

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), Math.max(1, totalPages)));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
    setSearchTerm("");
    setShowColumnPicker(false);
  }, [activeTab]);

  const loadProductDetail = async (uuid: string) => {
    setDetailLoading(true);
    try {
      const detail = await apiService.getProductById(uuid);
      setSelectedProduct(detail ?? null);
    } catch {
      const fallback = products.find((p) => p.uuid === uuid) ?? null;
      setSelectedProduct(fallback);
    } finally {
      setDetailLoading(false);
    }
  };

  const baseRows = useMemo<TableRow[]>(() => {
    if (activeTab === "products") {
      return products.map((p) => {
        const isActive = Boolean((p as any).isActive ?? (p as any).active);
        return {
          id: p.uuid,
          data: flattenRaw(p as unknown as Record<string, unknown>, {
            variants: (p.variantsDTO ?? []).length,
            status: isActive ? "Active" : "Inactive",
          }),
          raw: p,
        };
      });
    }

    if (activeTab === "brands") {
      return brands.map((b) => {
        const raw = b as unknown as Record<string, unknown>;
        const id = String((raw as any).brandId ?? (raw as any).id ?? Object.values(raw).find((v) => typeof v === "number" || typeof v === "string") ?? Math.random());
        return { id, data: flattenRaw(raw), raw: b };
      });
    }

    if (activeTab === "categories") {
      return categories.map((c) => {
        const raw = c as unknown as Record<string, unknown>;
        const id = String((raw as any).categoryId ?? (raw as any).id ?? Object.values(raw).find((v) => typeof v === "number" || typeof v === "string") ?? Math.random());
        return { id, data: flattenRaw(raw), raw: c };
      });
    }

    if (activeTab === "topPicks") {
      return topPicks.map((t) => {
        const raw = t as unknown as Record<string, unknown>;
        const id = String(t.uuid || t.productId || Math.random());
        return { id, data: flattenRaw(raw), raw: t };
      });
    }

    return packageUnits.map((p) => ({
      id: String(p.packageId),
      data: flattenRaw(p as unknown as Record<string, unknown>),
      raw: p,
    }));
  }, [activeTab, products, brands, categories, packageUnits, topPicks]);

  /** All columns available for the current tab — derived from the actual API response shape */
  const derivedAllColumns = useMemo<Array<{ key: string; label: string }>>(() => {
    const sample = baseRows.find((r) => Object.keys(r.data).length > 0);
    if (!sample) {
      return DEFAULT_COLUMNS[activeTab].map((k) => ({ key: k, label: toLabel(k) }));
    }
    return Object.keys(sample.data).map((k) => ({ key: k, label: toLabel(k) }));
  }, [activeTab, baseRows]);

  const activeColumnDefs = useMemo(() => {
    const preferred = visibleColumns[activeTab];
    // If user has a saved preference, intersect with actually available columns
    if (preferred && preferred.length > 0) {
      const prefSet = new Set(preferred);
      const matched = derivedAllColumns.filter((c) => prefSet.has(c.key));
      // If saved prefs don't match current API shape at all, fall through to default
      if (matched.length > 0) return matched;
    }
    // No preference or no match — show first 5 columns from actual API response
    return derivedAllColumns.slice(0, 5);
  }, [activeTab, visibleColumns, derivedAllColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      // Current visible keys — fall back to whatever activeColumnDefs shows
      const current =
        prev[activeTab] && prev[activeTab].length > 0
          ? prev[activeTab]
          : activeColumnDefs.map((c) => c.key);
      const exists = current.includes(key);
      if (exists && current.length === 1) return prev;
      const next = exists ? current.filter((x) => x !== key) : [...current, key];
      return { ...prev, [activeTab]: next };
    });
  };

  const rowsAfterSearch = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return baseRows;
    return baseRows.filter((row) => Object.values(row.data).some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [baseRows, searchTerm]);

  const activeFilterMap = columnFilters[activeTab] ?? {};
  const rowsAfterColumnFilters = useMemo(() => {
    return rowsAfterSearch.filter((row) => {
      return Object.entries(activeFilterMap).every(([k, filter]) => {
        if (!filter) return true;
        return String(row.data[k] ?? "").toLowerCase().includes(filter.toLowerCase());
      });
    });
  }, [rowsAfterSearch, activeFilterMap]);

  const activeSort = sortState[activeTab];
  const sortedRows = useMemo(() => {
    const copy = [...rowsAfterColumnFilters];
    if (!activeSort) return copy;
    copy.sort((a, b) => {
      const compared = compareValues(a.data[activeSort.key], b.data[activeSort.key]);
      return activeSort.dir === "asc" ? compared : -compared;
    });
    return copy;
  }, [rowsAfterColumnFilters, activeSort]);

  const localTotalItems = sortedRows.length;
  const localTotalPages = Math.max(1, Math.ceil(localTotalItems / pageSize));
  const pagedRows = useMemo(() => {
    if (activeTab === "products") return sortedRows;
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [activeTab, sortedRows, page, pageSize]);

  useEffect(() => {
    if (activeTab === "products") return;
    setPage((prev) => Math.min(Math.max(1, prev), localTotalPages));
  }, [activeTab, localTotalPages]);

  const onToggleSort = (key: string) => {
    setSortState((prev) => {
      const current = prev[activeTab];
      if (!current || current.key !== key) {
        return { ...prev, [activeTab]: { key, dir: "asc" } };
      }
      return { ...prev, [activeTab]: { key, dir: current.dir === "asc" ? "desc" : "asc" } };
    });
  };

  const setFilterValue = (key: string, value: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      [activeTab]: {
        ...(prev[activeTab] ?? {}),
        [key]: value,
      },
    }));
  };

  const openDetail = async (row: TableRow) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      if (activeTab === "products") {
        const p = row.raw as Product;
        const detail = await apiService.getProductById(p.uuid);
        const refreshed: TableRow = {
          id: p.uuid,
          data: row.data,
          raw: detail,
        };
        setSelectedProduct(detail);
        setSelectedRow(refreshed);
        return;
      }
      setSelectedRow(row);
    } catch {
      setSelectedRow(row);
    } finally {
      setDetailLoading(false);
    }
  };

  const performDelete = async (row: TableRow, withConfirm: boolean) => {
    if (withConfirm && typeof window !== "undefined") {
      const ok = window.confirm(`Delete this ${TAB_LABELS[activeTab].toLowerCase()}?`);
      if (!ok) return;
    }

    setSaveLoading(true);
    setBanner(null);
    try {
      if (activeTab === "products") {
        const current = row.raw as Product;
        await apiService.deleteProduct(current.uuid);
      } else if (activeTab === "brands") {
        const current = row.raw as Brand;
        await apiService.deleteBrand(String(current.id));
      } else if (activeTab === "categories") {
        const current = row.raw as Category;
        await apiService.deleteCategory(String(current.id));
      } else if (activeTab === "topPicks") {
        const current = row.raw as TopPick;
        await apiService.removeTopPick(String(current.uuid || current.productId));
      } else {
        const current = row.raw as PackageUnit;
        await apiService.deletePackageUnit(Number(current.packageId));
      }
      await reloadActiveTab();
      setBanner({ type: "success", message: `${TAB_LABELS[activeTab]} deleted successfully.` });
      setDetailOpen(false);
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : `Failed to delete ${TAB_LABELS[activeTab].toLowerCase()}.` });
    } finally {
      setSaveLoading(false);
    }
  };

  const reloadActiveTab = async () => {
    if (activeTab === "products") {
      const prodRes = await apiCall<any>("GET", `/products?page=${Math.max(0, page - 1)}&size=${pageSize}`);
      const productRows = Array.isArray(prodRes) ? prodRes : (prodRes?.content ?? []);
      const pageCount = Array.isArray(prodRes) ? 1 : Number(prodRes?.totalPages ?? 1);
      const itemCount = Array.isArray(prodRes) ? productRows.length : Number(prodRes?.totalElements ?? productRows.length);
      setProducts(Array.isArray(productRows) ? productRows : []);
      setTotalPages(Math.max(1, Number.isFinite(pageCount) ? pageCount : 1));
      setTotalItems(Number.isFinite(itemCount) ? itemCount : 0);
      return;
    }
    if (activeTab === "brands") {
      const brandRes = await apiService.getBrands();
      setBrands(Array.isArray(brandRes) ? brandRes : ((brandRes as any)?.content ?? []));
      return;
    }
    if (activeTab === "categories") {
      const categoryRes = await apiService.getCategories();
      setCategories(Array.isArray(categoryRes) ? categoryRes : ((categoryRes as any)?.content ?? []));
      return;
    }
    if (activeTab === "topPicks") {
      const tpRes = await apiService.getTopPicks();
      setTopPicks(Array.isArray(tpRes) ? tpRes : []);
      return;
    }
    const packageRes = await apiService.getPackageUnits();
    setPackageUnits(Array.isArray(packageRes) ? packageRes : ((packageRes as any)?.content ?? []));
  };

  const handleSave = async (patch: Record<string, unknown>) => {
    if (!selectedRow) return;
    setSaveLoading(true);
    setBanner(null);
    try {
      if (activeTab === "products") {
        const current = selectedRow.raw as Product;
        await apiService.updateProduct(current.uuid, patch as Partial<Product>);
      } else if (activeTab === "brands") {
        const current = selectedRow.raw as Brand;
        await apiService.updateBrand(String(current.id), patch as Partial<Brand>);
      } else if (activeTab === "categories") {
        const current = selectedRow.raw as Category;
        await apiService.updateCategory(String(current.id), patch as Partial<Category>);
      } else if (activeTab === "topPicks") {
        const current = selectedRow.raw as TopPick;
        const rank = Number(patch.rankingScore ?? current.rankingScore);
        const isFeatured = patch.isFeatured !== undefined ? Boolean(patch.isFeatured) : current.isFeatured;
        await apiService.updateTopPick(String(current.uuid || current.productId), rank, isFeatured);
      } else {
        const current = selectedRow.raw as PackageUnit;
        await apiService.updatePackageUnit(Number(current.packageId), patch as Partial<PackageUnit>);
      }
      await reloadActiveTab();
      setBanner({ type: "success", message: `${TAB_LABELS[activeTab]} updated successfully.` });
      setDetailOpen(false);
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : `Failed to update ${TAB_LABELS[activeTab].toLowerCase()}.` });
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRow) return;
    await performDelete(selectedRow, false);
  };

  /** Build a blank template row for creating a new item in the current tab */
  const getBlankTemplate = (): Record<string, unknown> => {
    if (activeTab === "products") return { productName: "", brand: "", categoryName: "", description: "", isActive: true };
    if (activeTab === "brands") return { name: "" };
    if (activeTab === "categories") return { name: "", description: "", imageUrl: "" };
    if (activeTab === "topPicks") return { productUuid: "", rankingScore: 0, isFeatured: false };
    return { packageName: "", packageType: "", description: "" };
  };

  const openAddNew = () => {
    const template = getBlankTemplate();
    const row: TableRow = {
      id: "__new__",
      data: Object.fromEntries(Object.entries(template).map(([k, v]) => [k, v as any])),
      raw: template as any,
    };
    setSelectedRow(row);
    setIsCreating(true);
    setDetailOpen(true);
  };

  const handleCreate = async (data: Record<string, unknown>) => {
    setSaveLoading(true);
    setBanner(null);
    try {
      if (activeTab === "products") {
        await apiService.createProduct(data as Partial<Product>);
      } else if (activeTab === "brands") {
        await apiService.createBrand(data as Partial<Brand>);
      } else if (activeTab === "categories") {
        await apiService.createCategory(data as Partial<Category>);
      } else if (activeTab === "topPicks") {
        const uuid = String(data.productUuid || data.uuid || "");
        const rank = Number(data.rankingScore ?? 0);
        if (!uuid) { setBanner({ type: "error", message: "Product UUID is required to add a Top Pick." }); return; }
        await apiService.addTopPick(uuid, rank);
      } else {
        await apiService.createPackageUnit(data as Partial<PackageUnit>);
      }
      await reloadActiveTab();
      setBanner({ type: "success", message: `${TAB_LABELS[activeTab]} created successfully.` });
      setDetailOpen(false);
      setIsCreating(false);
    } catch (err) {
      setBanner({ type: "error", message: err instanceof Error ? err.message : `Failed to create ${TAB_LABELS[activeTab].toLowerCase()}.` });
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="page-container-sidebar page-content space-y-5">
      <div className="page-header">
        <h2 className="page-title">Catalog</h2>
        <p className="page-subtitle">Manage Product, Brand, Package, and Categories from one workspace.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${activeTab === tab ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              onClick={() => setActiveTab(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            className="filter-input w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search in ${TAB_LABELS[activeTab]}...`}
          />

          <div className="relative">
            <button className="secondary-btn h-10 inline-flex items-center gap-2" onClick={() => setShowColumnPicker((v) => !v)}>
              <Columns3 size={16} />
              <span>Columns</span>
            </button>

            {showColumnPicker && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 max-h-80 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 mb-2">Choose columns ({derivedAllColumns.length} available)</p>
                <div className="space-y-2">
                  {derivedAllColumns.map((col) => {
                    const checked = activeColumnDefs.some((c) => c.key === col.key);
                    return (
                      <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={checked} onChange={() => toggleColumn(col.key)} />
                        <span>{col.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors h-10"
            onClick={openAddNew}
          >
            + Add {TAB_LABELS[activeTab]}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      {banner && <div className={`text-sm rounded-lg px-3 py-2 border ${banner.type === "success" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-red-700 bg-red-50 border-red-200"}`}>{banner.message}</div>}

      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr className="table-head-row">
              {activeColumnDefs.map((col) => {
                const current = sortState[activeTab];
                const isCurrent = current?.key === col.key;
                const arrow = !isCurrent ? "↕" : current?.dir === "asc" ? "↑" : "↓";
                return (
                  <th key={col.key} className="table-head-cell">
                    <button className="inline-flex items-center gap-1 hover:text-orange-600" onClick={() => onToggleSort(col.key)}>
                      <span>{col.label}</span>
                      <span>{arrow}</span>
                    </button>
                  </th>
                );
              })}
              <th className="table-head-cell">Actions</th>
            </tr>
            <tr className="table-head-row">
              {activeColumnDefs.map((col) => (
                <th key={`${col.key}-filter`} className="table-head-cell py-2 normal-case">
                  <FilterInput value={activeFilterMap[col.key] ?? ""} onChange={(v) => setFilterValue(col.key, v)} />
                </th>
              ))}
              <th className="table-head-cell py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={activeColumnDefs.length + 1} className="table-cell text-center text-gray-500 py-6">Loading {TAB_LABELS[activeTab].toLowerCase()} data...</td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <tr>
                <td colSpan={activeColumnDefs.length + 1} className="table-cell text-center text-gray-500 py-6">No records match current filters.</td>
              </tr>
            ) : (
              pagedRows.map((row) => {
                return (
                  <tr
                    key={row.id}
                    className="table-row table-row-hover"
                    onClick={() => {
                      void openDetail(row);
                    }}
                  >
                    {activeColumnDefs.map((col) => {
                      const value = row.data[col.key];
                      const isStatusColumn = col.key === "status";
                      const isActiveStatus = String(value).toLowerCase() === "active";
                      const isImageColumn = col.key.toLowerCase().includes("imageurl") || col.key.toLowerCase().includes("image_url") || col.key === "thumbnailImageUrl" || col.key === "fullSizeImageUrl";
                      return (
                        <td key={`${row.id}-${col.key}`} className="table-cell">
                          {isStatusColumn ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isActiveStatus ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"}`}>
                              {String(value)}
                            </span>
                          ) : isImageColumn && value ? (
                            <img src={String(value)} alt="" className="w-10 h-10 object-cover rounded border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            String(value ?? "-")
                          )}
                        </td>
                      );
                    })}

                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openDetail(row);
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50"
                          title="Delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            void performDelete(row, true);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <PaginationControls
          page={page}
          totalPages={activeTab === "products" ? totalPages : localTotalPages}
          totalItems={activeTab === "products" ? totalItems : localTotalItems}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
          disabled={loading}
          showPageSize
        />
      </div>

      {activeTab === "products" && selectedProduct && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-base font-semibold text-gray-900">Variant Snapshot</h3>
            {detailLoading && <span className="text-xs text-gray-500">Loading details...</span>}
          </div>
          <div className="text-sm text-gray-700 mb-3">
            <span className="font-semibold text-gray-900">{selectedProduct.productName}</span>
            <span> | {selectedProduct.brand || "-"}</span>
            <span> | {selectedProduct.categoryName || "-"}</span>
          </div>
          <div className="table-shell">
            <table className="table-base">
              <thead>
                <tr className="table-head-row">
                  <th className="table-head-cell">Package</th>
                  <th className="table-head-cell">UPC</th>
                  <th className="table-head-cell">Price</th>
                  <th className="table-head-cell">Approval</th>
                  <th className="table-head-cell">Live</th>
                  <th className="table-head-cell">Storage</th>
                  <th className="table-head-cell">Dimensions</th>
                </tr>
              </thead>
              <tbody>
                {(selectedProduct.variantsDTO ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-cell text-center text-gray-500 py-6">No variants found for this product.</td>
                  </tr>
                ) : (
                  (selectedProduct.variantsDTO ?? []).map((v: ProductVariant) => (
                    <tr key={v.variantId} className="table-row table-row-hover">
                      <td className="table-cell">{v.packageName || "-"}</td>
                      <td className="table-cell">{v.upc || "-"}</td>
                      <td className="table-cell">{formatMoney(v.unitPrice)}</td>
                      <td className="table-cell">{v.approvalStatus || "-"}</td>
                      <td className="table-cell">{v.isLive ? "Yes" : "No"}</td>
                      <td className="table-cell">{v.storageInstructions || "-"}</td>
                      <td className="table-cell">{v.dimensionsCm || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DetailModal
        open={detailOpen}
        title={isCreating ? `Add New ${TAB_LABELS[activeTab]}` : `${TAB_LABELS[activeTab]} Detail`}
        row={selectedRow}
        loading={saveLoading || detailLoading}
        onClose={() => { setDetailOpen(false); setIsCreating(false); }}
        onSave={isCreating ? handleCreate : handleSave}
        onDelete={handleDelete}
        isCreating={isCreating}
      />
    </div>
  );
}
