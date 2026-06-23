// "use client"

// interface CrudTableProps {
//   columns: string[]
//   data: Array<{
//     id: string
//     cells: (string | number)[]
//     actions?: Array<{ label: string; onClick: () => void }>
//   }>
//   loading: boolean
// }

// export function CrudTable({ columns, data, loading }: CrudTableProps) {
//   return (
//     <div
//       style={{
//         backgroundColor: "white",
//         borderRadius: "8px",
//         boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
//         overflow: "hidden",
//       }}
//     >
//       <table
//         style={{
//           width: "100%",
//           borderCollapse: "collapse",
//         }}
//       >
//         <thead>
//           <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "1px solid #e0e0e0" }}>
//             {columns.map((col, idx) => (
//               <th
//                 key={idx}
//                 style={{
//                   padding: "12px",
//                   textAlign: "left",
//                   fontSize: "14px",
//                   fontWeight: "600",
//                   color: "#333",
//                 }}
//               >
//                 {col}
//               </th>
//             ))}
//           </tr>
//         </thead>
//         {/* <tbody>
//           {loading ? (
//             <tr>
//               <td colSpan={columns.length} style={{ padding: "20px", textAlign: "center", color: "#666" }}>
//                 Loading...
//               </td>
//             </tr>
//           ) : data.length === 0 ? (
//             <tr>
//               <td colSpan={columns.length} style={{ padding: "20px", textAlign: "center", color: "#666" }}>
//                 No data available
//               </td>
//             </tr>
//           ) : (
//             data.map((row) => (
//               <tr key={row.id} style={{ borderBottom: "1px solid #e0e0e0" }}>
//                 {row.cells.map((cell, idx) => (
//                   <td
//                     key={idx}
//                     style={{
//                       padding: "12px",
//                       fontSize: "14px",
//                       color: "#333",
//                     }}
//                   >
//                     {cell}
//                   </td>
//                 ))}
//                 {row.actions && row.actions.length > 0 && (
//                   <td style={{ padding: "12px", fontSize: "14px" }}>
//                     <div style={{ display: "flex", gap: "8px" }}>
//                       {row.actions.map((action, idx) => (
//                         <button
//                           key={idx}
//                           onClick={action.onClick}
//                           style={{
//                             padding: "6px 12px",
//                             backgroundColor: "#FF6600",
//                             color: "white",
//                             border: "none",
//                             borderRadius: "4px",
//                             cursor: "pointer",
//                             fontSize: "12px",
//                             fontWeight: "500",
//                           }}
//                         >
//                           {action.label}
//                         </button>
//                       ))}
//                     </div>
//                   </td>
//                 )}
//               </tr>
//             ))
//           )}
//         </tbody> */}
//         <tbody>
//   {loading ? (
//     <tr key="loading">
//       <td colSpan={columns.length} style={{ padding: "20px", textAlign: "center", color: "#666" }}>
//         Loading...
//       </td>
//     </tr>
//   ) : data.length === 0 ? (
//     <tr key="empty">
//       <td colSpan={columns.length} style={{ padding: "20px", textAlign: "center", color: "#666" }}>
//         No data available
//       </td>
//     </tr>
//   ) : (
//     data.map((row) => (
//       <tr key={row.id} style={{ borderBottom: "1px solid #e0e0e0" }}>
//         {row.cells.map((cell, idx) => (
//           <td
//             key={idx}
//             style={{
//               padding: "12px",
//               fontSize: "14px",
//               color: "#333",
//             }}
//           >
//             {cell}
//           </td>
//         ))}
//         {row.actions && row.actions.length > 0 && (
//           <td style={{ padding: "12px", fontSize: "14px" }}>
//             <div style={{ display: "flex", gap: "8px" }}>
//               {row.actions.map((action, idx) => (
//                 <button
//                   key={idx}
//                   onClick={action.onClick}
//                   style={{
//                     padding: "6px 12px",
//                     backgroundColor: "#FF6600",
//                     color: "white",
//                     border: "none",
//                     borderRadius: "4px",
//                     cursor: "pointer",
//                     fontSize: "12px",
//                     fontWeight: "500",
//                   }}
//                 >
//                   {action.label}
//                 </button>
//               ))}
//             </div>
//           </td>
//         )}
//       </tr>
//     ))
//   )}
// </tbody>

//       </table>
//     </div>
//   )
// }

"use client"

import { useEffect, useMemo, useState } from "react"
import { PaginationControls } from "./PaginationControls"

interface CrudTableProps {
  columns: string[]
  data: Array<{
    id?: string
    cells: (string | number)[]
    actions?: Array<{ label: string; onClick: () => void }>
  }>
  loading: boolean
  paginate?: boolean
  defaultPageSize?: number
  pageSizeOptions?: number[]
}

export function CrudTable({
  columns,
  data,
  loading,
  paginate = true,
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
}: CrudTableProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data?.length ?? 0) / pageSize)),
    [data?.length, pageSize]
  )

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages))
  }, [totalPages])

  useEffect(() => {
    setPage(1)
  }, [data?.length, pageSize])

  const pagedData = useMemo(() => {
    if (!paginate) return data
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page, pageSize, paginate])

  return (
    <div className="table-shell">
      <table className="table-base">
        <thead>
          <tr className="table-head-row">
            {columns.map((col, idx) => (
              <th key={idx} className="table-head-cell">
                {col}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? (
            <tr key="loading">
              <td colSpan={columns.length} className="table-cell text-center text-gray-500 py-6">
                Loading...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr key="empty">
              <td colSpan={columns.length} className="table-cell text-center text-gray-500 py-6">
                No data available
              </td>
            </tr>
          ) : (
            pagedData.map((row, rowIdx) => {
              // defensive unique key: prefer provided id, otherwise fallback to row index
              const absoluteIdx = paginate ? (page - 1) * pageSize + rowIdx : rowIdx
              const rowKey = row.id && row.id !== "" ? row.id : `row-${absoluteIdx}`;

              return (
                <tr key={rowKey} className="table-row table-row-hover">
                  {row.cells.map((cell, cellIdx) => (
                    // include rowIdx in key to avoid duplicate keys across different rows/cells
                    <td key={`r${absoluteIdx}-c${cellIdx}`} className="table-cell">
                      {cell}
                    </td>
                  ))}

                  {row.actions && row.actions.length > 0 && (
                    <td className="table-action-cell">
                      <div className="table-actions">
                        {row.actions.map((action, actionIdx) => (
                          <button
                            key={`r${absoluteIdx}-a${actionIdx}`}
                            onClick={action.onClick}
                            className="table-action-btn-primary"
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {paginate && !loading && data.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200">
          <PaginationControls
            page={page}
            totalPages={totalPages}
            totalItems={data.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      )}
    </div>
  );
}
