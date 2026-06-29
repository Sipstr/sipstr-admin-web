"use client";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  itemLabel?: string;
  showPageSize?: boolean;
  className?: string;
}

export function PaginationControls({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  disabled = false,
  itemLabel = "items",
  showPageSize = true,
  className,
}: PaginationControlsProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${className ?? ""}`.trim()}>
      <div className="text-sm text-gray-600">
        {totalItems > 0 ? `Showing ${start}-${end} of ${totalItems} ${itemLabel}` : `Showing 0 of 0 ${itemLabel}`}
      </div>

      <div className="flex items-center gap-2">
        {showPageSize && onPageSizeChange && (
          <>
            <span className="text-sm text-gray-600">Rows</span>
            <select
              aria-label="Rows per page"
              className="filter-select h-9"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={disabled}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </>
        )}

        <button
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={disabled || safePage <= 1}
          className="secondary-btn py-2 px-3 text-sm disabled:opacity-50"
        >
          Prev
        </button>
        <span className="text-sm text-gray-700">{safePage} / {safeTotalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))}
          disabled={disabled || safePage >= safeTotalPages}
          className="secondary-btn py-2 px-3 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
