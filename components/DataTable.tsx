"use client";

import { useEffect, useMemo, useState } from "react";
import { Columns3, Pencil, Trash2 } from "lucide-react";
import { PaginationControls } from "./PaginationControls";

/* ─── Types ─── */
export type ColumnDef<T = any> = {
  key: string;
  label: string;
  getValue?: (row: T) => string | number | boolean | null | undefined;
  render?: (value: any, row: T) => React.ReactNode;
  hidden?: boolean;
};

type SortDirection = "asc" | "desc";

export type DataTableAction<T = any> = {
  label?: string;
  icon?: "edit" | "delete";
  className?: string;
  onClick: (row: T) => void;
  show?: (row: T) => boolean;
};

export interface DataTableProps<T = any> {
  /** Unique key for persisting column preferences */
  storageKey: string;
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Default visible column keys (if user hasn't customized) */
  defaultVisibleColumns?: string[];
  /** Data rows */
  data: T[];
  /** Row key extractor */
  getRowId: (row: T) => string;
  /** Loading state */
  loading?: boolean;
  /** Actions per row */
  actions?: DataTableAction<T>[];
  /** Global search placeholder */
  searchPlaceholder?: string;
  /** Callback when a row is clicked */
  onRowClick?: (row: T) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** External search (controlled) */
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  /** External pagination (server-side) */
  serverPagination?: {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  /** Extra header content (buttons, etc) */
  headerExtra?: React.ReactNode;
}

function compareValues(a: unknown, b: unknown) {
  const aNum = Number(a);
  const bNum = Number(b);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

export function DataTable<T = any>({
  storageKey,
  columns,
  defaultVisibleColumns,
  data,
  getRowId,
  loading = false,
  actions,
  searchPlaceholder = "Search...",
  onRowClick,
  emptyMessage = "No records found.",
  searchTerm: externalSearch,
  onSearchChange: externalSearchChange,
  serverPagination,
  headerExtra,
}: DataTableProps<T>) {
  // Column visibility
  const PREFS_KEY = `dt-cols-${storageKey}`;
  const [visibleKeys, setVisibleKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultVisibleColumns ?? columns.filter((c) => !c.hidden).map((c) => c.key);
    try {
      const saved = window.localStorage.getItem(PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return defaultVisibleColumns ?? columns.filter((c) => !c.hidden).map((c) => c.key);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(PREFS_KEY, JSON.stringify(visibleKeys)); } catch {}
  }, [visibleKeys, PREFS_KEY]);

  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [localSearch, setLocalSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortState, setSortState] = useState<{ key: string; dir: SortDirection } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const searchTerm = externalSearch ?? localSearch;
  const setSearchTerm = externalSearchChange ?? setLocalSearch;

  const activeColumns = useMemo(() => columns.filter((c) => visibleKeys.includes(c.key)), [columns, visibleKeys]);

  const toggleColumn = (key: string) => {
    setVisibleKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  };

  // Get cell value
  const getCellValue = (col: ColumnDef<T>, row: T): any => {
    if (col.getValue) return col.getValue(row);
    return (row as any)[col.key] ?? null;
  };

  // Filtering
  const filteredData = useMemo(() => {
    let rows = [...data];
    // Global search
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) =>
        columns.some((col) => {
          const val = getCellValue(col, row);
          return String(val ?? "").toLowerCase().includes(q);
        })
      );
    }
    // Column filters
    Object.entries(columnFilters).forEach(([key, filter]) => {
      if (!filter) return;
      const col = columns.find((c) => c.key === key);
      if (!col) return;
      rows = rows.filter((row) => {
        const val = getCellValue(col, row);
        return String(val ?? "").toLowerCase().includes(filter.toLowerCase());
      });
    });
    return rows;
  }, [data, searchTerm, columnFilters, columns]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortState) return filteredData;
    const col = columns.find((c) => c.key === sortState.key);
    if (!col) return filteredData;
    const copy = [...filteredData];
    copy.sort((a, b) => {
      const aVal = getCellValue(col, a);
      const bVal = getCellValue(col, b);
      const compared = compareValues(aVal, bVal);
      return sortState.dir === "asc" ? compared : -compared;
    });
    return copy;
  }, [filteredData, sortState, columns]);

  // Pagination (client-side if no serverPagination)
  const totalItems = sortedData.length;
  const totalPages = serverPagination ? serverPagination.totalPages : Math.max(1, Math.ceil(totalItems / pageSize));
  const pagedData = useMemo(() => {
    if (serverPagination) return sortedData;
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize, serverPagination]);

  useEffect(() => {
    if (serverPagination) return;
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages, serverPagination]);

  useEffect(() => {
    if (!serverPagination) setPage(1);
  }, [searchTerm, columnFilters, serverPagination]);

  const onToggleSort = (key: string) => {
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const setFilterValue = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Determine if a value looks like an image URL
  const isImageValue = (key: string, val: any) => {
    if (!val || typeof val !== "string") return false;
    const k = key.toLowerCase();
    if (k.includes("imageurl") || k.includes("image_url") || k === "thumbnailimageurl" || k === "fullsizeimageurl") return true;
    if (/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(val)) return true;
    return false;
  };

  return (
    <div className="space-y-4">
      {/* Search + Column picker */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <input
            className="filter-input w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
          />
          {headerExtra}
          <div className="relative">
            <button className="secondary-btn h-10 inline-flex items-center gap-2" onClick={() => setShowColumnPicker((v) => !v)}>
              <Columns3 size={16} />
              <span>Columns</span>
            </button>
            {showColumnPicker && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 max-h-80 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-500 mb-2">Choose columns ({columns.length} available)</p>
                <div className="space-y-2">
                  {columns.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={visibleKeys.includes(col.key)} onChange={() => toggleColumn(col.key)} />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-shell">
        <table className="table-base">
          <thead>
            <tr className="table-head-row">
              {activeColumns.map((col) => {
                const isCurrent = sortState?.key === col.key;
                const arrow = !isCurrent ? "↕" : sortState?.dir === "asc" ? "↑" : "↓";
                return (
                  <th key={col.key} className="table-head-cell">
                    <button className="inline-flex items-center gap-1 hover:text-orange-600" onClick={() => onToggleSort(col.key)}>
                      <span>{col.label}</span>
                      <span className="text-xs">{arrow}</span>
                    </button>
                  </th>
                );
              })}
              {actions && actions.length > 0 && <th className="table-head-cell">Actions</th>}
            </tr>
            <tr className="table-head-row">
              {activeColumns.map((col) => (
                <th key={`${col.key}-filter`} className="table-head-cell py-2 normal-case">
                  <input
                    className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
                    value={columnFilters[col.key] ?? ""}
                    onChange={(e) => setFilterValue(col.key, e.target.value)}
                    placeholder="Filter"
                  />
                </th>
              ))}
              {actions && actions.length > 0 && <th className="table-head-cell py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={activeColumns.length + (actions ? 1 : 0)} className="table-cell text-center text-gray-500 py-6">
                  Loading...
                </td>
              </tr>
            ) : pagedData.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + (actions ? 1 : 0)} className="table-cell text-center text-gray-500 py-6">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedData.map((row) => (
                <tr
                  key={getRowId(row)}
                  className="table-row table-row-hover"
                  onClick={() => onRowClick?.(row)}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {activeColumns.map((col) => {
                    const val = getCellValue(col, row);
                    return (
                      <td key={`${getRowId(row)}-${col.key}`} className="table-cell">
                        {col.render ? (
                          col.render(val, row)
                        ) : isImageValue(col.key, val) ? (
                          <img src={String(val)} alt="" className="w-10 h-10 object-cover rounded border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          String(val ?? "-")
                        )}
                      </td>
                    );
                  })}
                  {actions && actions.length > 0 && (
                    <td className="table-cell">
                      <div className="flex items-center gap-1.5">
                        {actions.map((action, idx) => {
                          if (action.show && !action.show(row)) return null;
                          if (action.icon === "edit") {
                            return (
                              <button
                                key={idx}
                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                                title={action.label ?? "Edit"}
                                onClick={(e) => { e.stopPropagation(); action.onClick(row); }}
                              >
                                <Pencil size={14} />
                              </button>
                            );
                          }
                          if (action.icon === "delete") {
                            return (
                              <button
                                key={idx}
                                className="inline-flex h-8 w-8 items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50"
                                title={action.label ?? "Delete"}
                                onClick={(e) => { e.stopPropagation(); action.onClick(row); }}
                              >
                                <Trash2 size={14} />
                              </button>
                            );
                          }
                          return (
                            <button
                              key={idx}
                              className={action.className ?? "px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"}
                              onClick={(e) => { e.stopPropagation(); action.onClick(row); }}
                            >
                              {action.label ?? "Action"}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <PaginationControls
          page={serverPagination?.page ?? page}
          totalPages={serverPagination?.totalPages ?? totalPages}
          totalItems={serverPagination?.totalItems ?? totalItems}
          pageSize={serverPagination?.pageSize ?? pageSize}
          onPageChange={serverPagination?.onPageChange ?? setPage}
          onPageSizeChange={serverPagination?.onPageSizeChange ?? ((next) => { setPageSize(next); setPage(1); })}
          disabled={loading}
          showPageSize
        />
      </div>
    </div>
  );
}
