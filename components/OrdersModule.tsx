// components/OrdersModule.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiService } from "@/services/apiService";
import type { RecentOrder, Order } from "@/services/types";
import { PaginationControls } from "./PaginationControls";
import { DataTable, ColumnDef, DataTableAction } from "./DataTable";

/* -------------------- Helpers -------------------- */
const fmt = (n?: number) => (n ?? 0).toFixed(2);
type RefundType = "full" | "partial";

/* -------------------- parseApiError util (network-aware) -------------------- */
function parseApiError(err: any) {
  // Try structured fields
  const status = err?.status ?? err?.statusCode ?? err?.response?.status ?? err?.response?.statusCode;
  const body = err?.responseBody ?? err?.response?.data ?? err?.data ?? err?.body ?? null;
  const msgFromBody = body && (body.message || body.error || body.msg || body.detail);
  const raw = String(err?.message ?? err ?? "");
  let bodyText = "";
  try { bodyText = typeof body === "string" ? body : JSON.stringify(body || {}); } catch { bodyText = String(body); }

  // Detect browser network-level error (Fetch API throws TypeError on network failure)
  const isNetworkError =
    raw.toLowerCase().includes("failed to fetch") ||
    (err && err.name === "TypeError" && /failed to fetch/i.test(String(err.message || "")));

  const message = (msgFromBody && String(msgFromBody)) || raw || bodyText || "Something went wrong.";
  return { status, message, isNetworkError };
}

/* -------------------- Small UI primitives (modals/toasts) -------------------- */
/* InfoModal — simple single-button informational modal */
const InfoModal = ({ open, title, message, onClose }: {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}) => {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-panel p-5 w-[520px] max-w-full">
        {title && <h3 className="text-lg font-bold mb-2">{title}</h3>}
        <p className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="modal-footer">
          <button onClick={onClose} className="modal-btn-primary">OK</button>
        </div>
      </div>
    </div>
  );
};

const ConfirmModal = ({ open, title, message, onCancel, onConfirm }: {
  open: boolean; title?: string; message: string; onCancel: () => void; onConfirm: () => void;
}) => {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-panel p-5 w-[520px] max-w-full">
        {title && <h3 className="text-lg font-bold mb-2">{title}</h3>}
        <p className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="modal-footer">
          <button onClick={onCancel} className="modal-btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors">Confirm</button>
        </div>
      </div>
    </div>
  );
};

const AlertBox = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-4">
    <div className="border p-3 rounded bg-red-50 border-red-200 text-sm text-red-800">{children}</div>
  </div>
);

/* -------------------- OrderDetailsDialog -------------------- */
/* (kept same as your original) */
const OrderDetailsDialog = ({ order }: { order: Order }) => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <h3 className="text-xl font-bold mb-4">
        Order Details: <span className="text-gray-500 font-mono text-sm">{order.orderShortId ?? order.orderUuid}</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t pt-4">
        <div>
          <p className="mb-2"><strong>Customer:</strong> {order.userName}</p>
          <p className="mb-2"><strong>Address:</strong> <span className="text-gray-600">{order.address ?? "—"}</span></p>
          <p className="mb-2"><strong>Order Status:</strong> <span className="text-gray-600">{order.refundStatus}</span></p>
          <p className="mb-2"><strong>Items:</strong> <span className="text-gray-600">{order.itemOrderedCount ?? (order.items?.length ?? 0)}</span></p>
        </div>

        <div>
          <p className="mb-2"><strong>Delivery ETA:</strong> <span className="text-gray-600">{order.estimatedDeliveryTime ?? "—"}</span></p>
          <p className="mb-2"><strong>Refund Status:</strong> <span className="text-gray-600">{order.refundStatus ?? "—"}</span></p>
        </div>
      </div>

      <hr className="my-4" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="font-semibold mb-2">Totals</h4>
          <div className="text-sm text-gray-700">
            <div className="flex justify-between py-1"><span>Subtotal</span><span className="font-medium">${fmt(order.subtotal)}</span></div>
            <div className="flex justify-between py-1"><span>Total Tax</span><span className="font-medium">${fmt(order.totalTax)}</span></div>
            <div className="flex justify-between py-1"><span>Delivery Fee</span><span className="font-medium">${fmt(order.totalDeliveryFee)}</span></div>
            <div className="flex justify-between py-1"><span>Bag Fee</span><span className="font-medium">${fmt(order.totalCheckoutBagFee)}</span></div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Fees & Extras</h4>
          <div className="text-sm text-gray-700">
            <div className="flex justify-between py-1"><span>Bottle Deposit Fee</span><span className="font-medium">${fmt(order.totalBottleDepositFee)}</span></div>
            <div className="flex justify-between py-1"><span>Service Fee</span><span className="font-medium">${fmt(order.serviceFee)}</span></div>
            <div className="flex justify-between py-1"><span>Tip</span><span className="font-medium">${fmt(order.tip)}</span></div>
            <div className="flex justify-between py-1"><span>Refunded</span><span className="font-medium text-red-600">-${fmt(order.refundAmount)}</span></div>
          </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2">Summary & Discounts</h4>
          <div className="text-sm text-gray-700">
            <div className="flex justify-between py-1"><span>Store Discount</span><span className="font-medium">-${fmt(order.totalStoreDiscount)}</span></div>
            <div className="flex justify-between py-1"><span>Platform Discount</span><span className="font-medium">-${fmt(order.totalSipstrDiscount)}</span></div>
            <div className="flex justify-between py-1"><span>Original Total</span><span className="font-medium">${fmt(order.originalTotal)}</span></div>
            <div className="flex justify-between py-1"><span>Adjusted Total</span><span className="font-medium">${fmt(order.adjustedTotal)}</span></div>
            <div className="flex justify-between py-1"><span>Difference</span><span className="font-medium">${fmt(order.differenceTotal)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -------------------- OrderPreviewList (using DataTable) -------------------- */
interface OrderPreviewListProps {
  orders: RecentOrder[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onViewOrder: (shortId: string) => void;
  onFullRefund: (shortId: string) => void;
  onPartialRefund: (shortId: string) => void;
  onSubstitute: (order: RecentOrder) => void;
  limit: number;
}

const ORDER_COLUMNS: ColumnDef<RecentOrder>[] = [
  { key: "orderShortId", label: "Order ID", getValue: (o) => o.orderShortId ?? "-" },
  { key: "customerName", label: "Customer", getValue: (o) => o.customerName ?? "-" },
  { key: "address", label: "Address", getValue: (o) => o.address ?? "-" },
  { key: "originalTotal", label: "Order Total", getValue: (o) => o.originalTotal ?? 0, render: (val) => <span className="text-emerald-600 font-semibold">${(Number(val) || 0).toFixed(2)}</span> },
  { key: "deliveryTime", label: "ETA", getValue: (o) => o.deliveryTime ? new Date(o.deliveryTime).toLocaleString() : (o.updatedAt ? new Date(o.updatedAt).toLocaleString() : "-") },
  { key: "orderStatus", label: "Status", getValue: (o) => o.orderStatus ?? "-", render: (val) => <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${String(val).toUpperCase().includes('REFUND') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{val}</span> },
  { key: "storeTotal", label: "Store Total", getValue: (o) => o.storeTotal != null ? o.storeTotal : null, render: (val) => val != null ? <span>${Number(val).toFixed(2)}</span> : <span>-</span>, hidden: true },
  { key: "storeUuid", label: "Store UUID", getValue: (o) => o.storeUuid ?? "-", hidden: true },
];

const ORDER_DEFAULT_VISIBLE = ["orderShortId", "customerName", "address", "originalTotal", "deliveryTime", "orderStatus"];

const OrderPreviewList: React.FC<OrderPreviewListProps> = ({
  orders,
  loading,
  searchTerm,
  onSearchChange,
  onViewOrder,
  onFullRefund,
  onPartialRefund,
  onSubstitute,
  limit,
}) => {
  const canSubstitute = (status?: string) => {
    const s = String(status ?? "").toUpperCase();
    return ["CREATED", "ACCEPTED_BY_STORE", "PARTIALLY_ACCEPTED_BY_STORE", "SCHEDULED"].includes(s);
  };

  const actions: DataTableAction<RecentOrder>[] = [
    { label: "View", className: "table-action-btn-primary", onClick: (o) => onViewOrder(o.orderShortId) },
    { label: "Substitute", className: "px-3 py-1.5 rounded-lg text-xs font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors", onClick: (o) => onSubstitute(o), show: (o) => canSubstitute(o.orderStatus) },
    { label: "Partial Refund", className: "px-3 py-1.5 rounded-lg text-xs font-semibold border border-yellow-200 text-yellow-700 hover:bg-yellow-50 transition-colors", onClick: (o) => onPartialRefund(o.orderShortId) },
    { label: "Full Refund", className: "px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-700 hover:bg-red-50 transition-colors", onClick: (o) => onFullRefund(o.orderShortId) },
  ];

  if (loading) return <div className="text-center p-8 text-lg text-gray-600">Loading recent orders...</div>;
  if (!orders || orders.length === 0) return <div className="text-center p-8 text-lg text-gray-600">No recent orders found.</div>;

  return (
    <DataTable<RecentOrder>
      storageKey="orders-list"
      columns={ORDER_COLUMNS}
      defaultVisibleColumns={ORDER_DEFAULT_VISIBLE}
      data={orders}
      getRowId={(o) => o.orderShortId ?? String(Math.random())}
      loading={false}
      actions={actions}
      searchPlaceholder="Search by Order ID, customer, status, address..."
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      emptyMessage="No orders match current filters."
    />
  );
};

/* -------------------- FullRefundDetail (unchanged) -------------------- */
const FullRefundDetail = ({ order, onBack, onProcessRefund }: {
  order: Order; onBack: () => void; onProcessRefund: (orderId: string) => Promise<void>;
}) => {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleConfirm = async () => {
    setShowConfirm(false);
    setLoading(true);
    try { await onProcessRefund(order.orderShortId ?? order.orderUuid); } finally { setLoading(false); }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-4xl mx-auto my-8">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h3 className="text-2xl font-bold text-red-600">Full Refund Confirmation</h3>
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">&larr; Back to List</button>
      </div>

      <OrderDetailsDialog order={order} />

      <div className="mt-8 pt-4 border-t flex justify-end">
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loading || ((order.refundStatus ?? "").toString().toUpperCase() === 'FULL_REFUND')}
          className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700 disabled:opacity-50 transition"
        >
        {loading ? "Processing..." : `Process Full Refund ($${fmt(order.originalTotal)})`}
      </button>
      </div>

      <ConfirmModal open={showConfirm} title="Confirm Full Refund"
        message={`Are you absolutely sure you want to process a FULL refund of $${fmt(order.originalTotal)} for order ${order.orderShortId ?? (order.orderUuid ?? "").slice(0, 8)}? This action cannot be undone.`}
        onCancel={() => setShowConfirm(false)} onConfirm={handleConfirm} />
    </div>
  );
};

/* -------------------- PartialRefundDetail (small change: use toast through window event) -------------------- */
type RefundItem = { id: number; name: string; price?: number; finalPrice?: number; storeUuid?: string; storeName?: string, isRefunded: boolean };

const PartialRefundDetail = ({ order, onBack, onProcessRefund }: {
  order: Order;
  onBack: () => void;
  onProcessRefund: (orderId: string, itemIds: number[], deliveryfee: boolean, tip: boolean) => Promise<void>;
}) => {
  const allItems: RefundItem[] = useMemo(() =>
    (order.stores ?? []).flatMap(store =>
      (store.items ?? []).map(i => ({
        id: i.itemId,
        name: i.itemName,
        price: i.price,
        finalPrice: i.finalPrice,
        storeUuid: store.storeUuid,
        storeName: store.storeName,
        isRefunded: !!i.isRefunded
      }))
    ), [order]);

  const storesMeta = useMemo(() => (order.stores ?? []).map(s => ({
    storeUuid: s.storeUuid,
    storeName: s.storeName,
    storeDeliveryFee: (s as any).storeDeliveryFee ?? (s as any).storeDelivery ?? 0
  })), [order]);

  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [refundDeliveryFee, setRefundDeliveryFee] = useState(false);
  const [refundTip, setRefundTip] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);


  const toggleItem = (id: number) => {
    const it = allItems.find(x => x.id === id);
    if (it?.isRefunded) return; // ignore clicks for already refunded items
    setSelectedItemIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const itemsByStore = useMemo(() => {
    const map: Record<string, RefundItem[]> = {};
    (order.stores ?? []).forEach(s => { map[s.storeUuid] = []; });
    allItems.forEach(it => {
      const k = it.storeUuid ?? 'unknown';
      if (!map[k]) map[k] = [];
      map[k].push(it);
    });
    return map;
  }, [allItems, order.stores]);

  const totalItemRefund = useMemo(() =>
    allItems.filter(it => selectedItemIds.includes(it.id)).reduce((sum, it) => sum + (it.finalPrice ?? 0), 0)
  , [allItems, selectedItemIds]);

  const totalDeliveryRefund = useMemo(() => {
    if (!refundDeliveryFee) return 0;
    return storesMeta.reduce((sum, s) => {
      const hasSelectedFromStore = (itemsByStore[s.storeUuid] || []).some(it => selectedItemIds.includes(it.id));
      return sum + (hasSelectedFromStore ? (s.storeDeliveryFee ?? 0) : 0);
    }, 0);
  }, [refundDeliveryFee, storesMeta, itemsByStore, selectedItemIds]);

  const totalRefundAmount = useMemo(() => {
    let total = 0;
    total += totalItemRefund;
    total += totalDeliveryRefund;
    if (refundTip) total += (order.tip ?? 0);
    if (order.totalCheckoutBagFee) total += order.totalCheckoutBagFee;
    return total;
  }, [totalItemRefund, totalDeliveryRefund, refundTip, order.tip, order.totalCheckoutBagFee]);

  // remaining refundable amount (non-negative)
  const remainingRefundable = useMemo(() => {
    console.log("refundamount",order.refundAmount);
    return Math.max(0, (order.originalTotal ?? 0) - (order.refundAmount ?? 0));
  }, [order.originalTotal, order.refundAmount]);


  useEffect(() => {
      if (totalRefundAmount === 0) {
        setValidationError("Select items, or enable refund of delivery fee / tip.");
      } else if (totalRefundAmount > remainingRefundable) {
        setValidationError(`Refund amount cannot exceed remaining refundable amount of $${fmt(remainingRefundable)}.`);
      } else {
        setValidationError(null);
      }
    }, [totalRefundAmount, remainingRefundable]);

    const handleConfirmPartialRefund = async () => {
      if (validationError) return;

      setShowConfirm(false);
      setLoading(true);
      try {
        await onProcessRefund(order.orderShortId ?? order.orderUuid, selectedItemIds, refundDeliveryFee, refundTip);
      } finally {
        setLoading(false);
      }
    };



  return (
    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-5xl mx-auto my-8">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <h3 className="text-2xl font-bold text-yellow-600">Partial Refund Configuration</h3>
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700">&larr; Back to List</button>
      </div>

      <OrderDetailsDialog order={order} />

      <div className="mt-8 border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="text-lg font-semibold mb-3">Select Items to Refund</h4>

          <div className="space-y-4">
            {(order.stores ?? []).map(s => (
              <div key={s.storeUuid} className="border rounded-lg p-3 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium">{s.storeName}</div>
                    {s.storeAddress && <div className="text-xs text-gray-500">{s.storeAddress}</div>}
                  </div>

                  <div className="text-sm">Delivery fee: <span className="font-semibold">${fmt((s as any).storeDeliveryFee ?? (s as any).storeDelivery ?? 0)}</span></div>
                </div>

                <div className="max-h-48 overflow-y-auto border-t pt-2">
                  
                  {(itemsByStore[s.storeUuid] || []).length > 0 ? (itemsByStore[s.storeUuid] || []).map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0">
                      <label className={`text-sm cursor-pointer flex-grow ${item.isRefunded ? 'line-through text-gray-400' : ''}`}>
                        {item.name}
                        {item.isRefunded && <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Refunded</span>}
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">${fmt(item.finalPrice)}</span>
                        <input
                          type="checkbox"
                          checked={selectedItemIds.includes(item.id)}
                          onChange={() => toggleItem(item.id)}
                          className="w-4 h-4 text-yellow-600 border-gray-300 rounded"
                          disabled={item.isRefunded}
                          aria-disabled={item.isRefunded}
                        />
                      </div>
                    </div>
                  )) : <p className="text-sm text-gray-500">No refundable items for this store.</p>}

                </div>
              </div>
            ))}
          </div>

          <h4 className="text-lg font-semibold mt-6 mb-3">Select Fees to Refund</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 border rounded-lg">
              <label className="text-sm font-medium">Refund Delivery Fee</label>
              <input type="checkbox" checked={refundDeliveryFee} onChange={() => setRefundDeliveryFee(p => !p)} className="w-4 h-4 text-yellow-600 border-gray-300 rounded" />
            </div>

            <div className="flex items-center justify-between p-2 border rounded-lg">
              <label className="text-sm font-medium">Tip</label>
              <input type="checkbox" checked={refundTip} onChange={() => setRefundTip(p => !p)} className="w-4 h-4 text-yellow-600 border-gray-300 rounded" />
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 p-5 rounded-xl shadow-inner h-fit">
          <h4 className="text-lg font-bold mb-3 text-yellow-700">Refund Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Original Total:</span><span className="font-semibold">${fmt(order.originalTotal)}</span></div>
            <div className="flex justify-between">
              <span>Refunded Previously:</span>
              <span className="font-semibold text-red-600">-${fmt(order.refundAmount)}</span></div>
            <div className="flex justify-between text-sm text-gray-700">
              <span>Remaining Refundable:</span>
              <span className="font-semibold text-red-600">${fmt(remainingRefundable)}</span>
            </div>

            <hr className="my-2"/>
            <div className="flex justify-between text-base font-semibold"><span>Items Selected:</span><span className="text-yellow-700">${fmt(totalItemRefund)}</span></div>

            {storesMeta.map(s => {
              const hasSelectedFromStore = (itemsByStore[s.storeUuid] || []).some(it => selectedItemIds.includes(it.id));
              const fee = s.storeDeliveryFee ?? 0;
              return hasSelectedFromStore ? (
                <div key={s.storeUuid} className="flex justify-between text-sm">
                  <span>Delivery ({s.storeName}):</span>
                  <span className="text-yellow-700">{refundDeliveryFee ? `$${fmt(fee)}` : "$0.00"}</span>
                </div>
              ) : null;
            })}

            <div className="flex justify-between"><span>Tip Refund:</span><span className="text-yellow-700">{refundTip ? `$${fmt(order.tip ?? 0)}` : "$0.00"}</span></div>
            <div className="flex justify-between"><span>Checkout Bag Fee:</span><span className="text-yellow-700">${fmt(order.totalCheckoutBagFee ?? 0)}</span></div>
            <div className="flex justify-between text-sm"><span>Tax:</span><span className="text-gray-500 italic">As applicable</span></div>
            <hr className="my-3 border-yellow-300"/>
            <div className="flex justify-between text-xl font-extrabold text-red-600"><span>Total New Refund:</span><span>-${fmt(totalRefundAmount)}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t flex justify-end">
        <div className="mt-8 pt-4 border-t">
        {validationError && (
          <div className="mb-3 text-sm text-red-700 border rounded p-2 bg-red-50">{validationError}</div>
        )}

        <div className="flex justify-end">
          <button
            onClick={() => setShowConfirm(true)}
            disabled={loading || totalRefundAmount === 0 || !!validationError}
            className="px-6 py-3 bg-yellow-600 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-700 disabled:opacity-50 transition"
          >
            {loading ? "Processing..." : "Process Partial Refund"}
          </button>
        </div>
      </div>

      </div>

      <ConfirmModal open={showConfirm} title="Confirm Partial Refund" message={`Are you sure you want to process a PARTIAL refund for order ${order.orderShortId ?? order.orderUuid}?`} onCancel={() => setShowConfirm(false)} onConfirm={handleConfirmPartialRefund} />
    </div>
  );
};

/* -------------------- OrdersModule -------------------- */
function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/* List of statuses (copied from your backend enum) */
const ORDER_STATUSES = [
  "CREATED",
  "PAYMENT_PENDING",
  "ACCEPTED_BY_STORE",
  "PARTIALLY_ACCEPTED_BY_STORE",
  "SCHEDULED",
  "READY_TO_PICKUP",
  "CANCELLED_BY_CUSTOMER",
  "OUT_FOR_DELIVERY",
  "PARTIAL_DELIVERED",
  "CANCELLED_BY_STORE",
  "PARTIALLY_CANCELLED",
  "DAMAGED",
  "DELIVERED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const;
type OrderStatusType = (typeof ORDER_STATUSES)[number];

/* Small checkbox-dropdown component for statuses (unchanged) */
function StatusCheckboxDropdown({
  value,
  onChange,
  placeholder = "Status"
}: {
  value: OrderStatusType[];
  onChange: (v: OrderStatusType[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggle = (s: OrderStatusType) => {
    if (value.includes(s)) onChange(value.filter(x => x !== s));
    else onChange([...value, s]);
  };

  const clearAll = () => onChange([]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="filter-select h-9 flex items-center gap-2">
        <span className="text-sm">{value.length === 0 ? placeholder : `${value.length} selected`}</span>
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border rounded shadow-lg z-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-sm">Filter statuses</strong>
            <button onClick={clearAll} className="text-xs text-gray-500 hover:underline">Clear</button>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {ORDER_STATUSES.map(s => (
              <label key={s} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={value.includes(s as OrderStatusType)} onChange={() => toggle(s as OrderStatusType)} className="w-4 h-4" />
                <span className="truncate">{s}</span>
              </label>
            ))}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button onClick={() => setOpen(false)} className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function OrdersModule() {
  const [view, setView] = useState<'list' | 'details' | 'full_detail' | 'partial_detail'>('list');
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [pendingRefundType, setPendingRefundType] = useState<RefundType>('partial');
  const [searchTerm, setSearchTerm] = useState("");

  // filter controls (defaults present but not shown on landing)
  const [limit, setLimit] = useState<number>(45);
  const [statusFilter, setStatusFilter] = useState<OrderStatusType[]>([]);

  const debouncedLimit = useDebounce(limit, 500);
  const debouncedStatus = useDebounce(statusFilter, 400);

  // network online/offline state for helpful UI
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  //refund info and
  const [showAlreadyRefundedInfo, setShowAlreadyRefundedInfo] = useState(false);
  const [alreadyRefundedOrderLabel, setAlreadyRefundedOrderLabel] = useState("");
  const tempOrderRef = useRef<Order | null>(null);

  useEffect(() => {
    function onOnline() { setIsOnline(true); }
    function onOffline() { setIsOnline(false); }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  // track last fetch params so Retry can re-run the same request
  const lastFetchRef = useRef<{ type: RefundType; limit: number; statuses: OrderStatusType[] } | null>(null);

  // fetch recent orders from apiService (limit) and apply status filter client-side
  const fetchRecentOrders = useCallback(async (type: RefundType, useLimit = 45, statuses: OrderStatusType[] = []) => {
    setLoading(true); setAlert(null); setPendingRefundType(type); setView('list');
    lastFetchRef.current = { type, limit: useLimit, statuses };

    try {
      const previews = await apiService.getRecentOrders(useLimit);
      const normalized = previews ?? [];

      const filtered = (statuses && statuses.length > 0)
        ? normalized.filter(p => {
            const s = (p.orderStatus ?? "").toString().toUpperCase();
            return statuses.some(st => st.toString().toUpperCase() === s);
          })
        : normalized;

      setOrders(filtered);
    } catch (err) {
      console.error("fetchRecentOrders error (raw):", err);
      const { status, message, isNetworkError } = parseApiError(err);

      if (!isOnline) {
        // browser offline
        setAlert({ message: "You appear to be offline. Please check your network connection and try again.", type: 'error' });
      } else if (isNetworkError) {
        // network/CORS issue or server unreachable
        setAlert({
          message: `Cannot reach the server. This may be a network issue or the backend is down. ${status ? `(status ${status}) ` : ""}Click Retry to try again.`,
          type: 'error'
        });
      } else if (status === 401) {
        setAlert({ message: "You are not authorised. Please re-login.", type: 'error' });
      } else if (status === 429) {
        setAlert({ message: "Too many requests. Please wait a moment and try again.", type: 'error' });
      } else {
        setAlert({ message: `Failed to load recent orders: ${message}`, type: 'error' });
      }

      setOrders([]);
    } finally { setLoading(false); }
  }, [isOnline]);

  // When user clicks action from landing (start flow) -> go to list with defaults (limit=45, status=CREATED)
  const handleStartFetch = (type: RefundType) => {
    setPendingRefundType(type);
    fetchRecentOrders(type, limit, statusFilter);
  };

  // Auto-refetch while on list view when filters change (debounced)
  useEffect(() => {
    if (view !== 'list') return;
    fetchRecentOrders(pendingRefundType, debouncedLimit, debouncedStatus);
  }, [debouncedLimit, debouncedStatus, view, pendingRefundType, fetchRecentOrders]);

  useEffect(() => {
    fetchRecentOrders('partial', limit, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry handler (for network/CORS errors)
  const handleRetry = useCallback(() => {
    const last = lastFetchRef.current;
    if (!last) return;
    fetchRecentOrders(last.type, last.limit, last.statuses);
  }, [fetchRecentOrders]);

  const handleViewOrder = useCallback(async (orderShortId: string, mode: 'view' | 'full' | 'partial' = 'view') => {
    setLoading(true); setAlert(null);
    try {
      const full = await apiService.getTrackedOrder(orderShortId);

      const status = (full?.refundStatus ?? "").toString().toUpperCase();
      if (mode === 'full' && status === 'FULL_REFUND') {
        tempOrderRef.current = full;
        setAlreadyRefundedOrderLabel(full?.orderShortId ?? (full?.orderUuid ?? ""));
        setShowAlreadyRefundedInfo(true);
        return;
      }

      setSelectedOrder(full);
      if (mode === 'full') {
        setPendingRefundType('full');
        setView('full_detail');
      } else if (mode === 'partial') {
        setPendingRefundType('partial');
        setView('partial_detail');
      } else {
        setView('details');
      }
    } catch (err) {
      console.error("handleViewOrder error (raw):", err);
      const { message, isNetworkError } = parseApiError(err);
      if (!isOnline || isNetworkError) {
        setAlert({ message: "Cannot load order details — network error or server unreachable. Try again.", type: 'error' });
      } else {
        setAlert({ message: `Failed to load order details: ${message}`, type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  }, [isOnline]);


  const handleBackToLanding = () => {
    setSelectedOrder(null); setView('list'); setAlert(null);
  };

  const handleProcessFullRefund = useCallback(async (orderId: string) => {
    try {
      await apiService.refundOrderFull(orderId);
      setAlert({ message: `Full refund successfully processed for order ${orderId.slice(0, 8)}.`, type: 'success' });
      setSelectedOrder(null);
      // refresh using current filters
      await fetchRecentOrders('full', limit, statusFilter);
    } catch (err) {
      console.error("handleProcessFullRefund error (raw):", err);
      const { message } = parseApiError(err);
      setAlert({ message: `Full refund failed: ${message}`, type: 'error' });
      setView('list');
    }
  }, [fetchRecentOrders, limit, statusFilter]);

  const handleProcessPartialRefund = useCallback(async (orderId: string, itemIds: number[], deliveryFee: boolean, tip: boolean) => {
    try {
      await apiService.refundOrderPartial(orderId, itemIds, deliveryFee, tip);
      setAlert({ message: `Partial refund successfully processed for order ${orderId.slice(0, 8)}.`, type: 'success' });
      setSelectedOrder(null);
      // refresh
      await fetchRecentOrders('partial', limit, statusFilter);
    } catch (err) {
      console.error("handleProcessPartialRefund error (raw):", err);
      const { message } = parseApiError(err);
      setAlert({ message: `Partial refund failed: ${message}`, type: 'error' });
      setView('list');
    }
  }, [fetchRecentOrders, limit, statusFilter]);

  // RENDER
  if (view === 'list') {
    return (
      <div className="page-container-sidebar page-content p-4 md:p-6">
        <div className="page-header flex justify-between items-center">
          <h2 className="page-title">Orders</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => handleStartFetch('partial')} className="px-3 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">Refresh</button>
          </div>
        </div>

        {/* offline banner */}
        {!isOnline && (
          <div className="mb-4">
            <div className="border p-3 rounded bg-yellow-50 border-yellow-200 text-sm text-yellow-800">You are currently offline. Some actions may not work until you reconnect.</div>
          </div>
        )}

        {/* Alert with Retry button for network issues */}
        {alert && (
          <div className="mb-4 flex items-start gap-3">
            <div className="flex-1">
              <div className={`border p-3 rounded ${alert.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="text-sm">{alert.message}</div>
                  <button onClick={() => setAlert(null)} className="text-sm text-gray-600 hover:text-gray-900">✕</button>
                </div>
              </div>
            </div>

            {/* show Retry if it looks like a network/server reachability issue */}
            <div>
              <button
                onClick={handleRetry}
                className="px-3 py-2 rounded bg-orange-600 text-white text-sm hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Info modal shown when the order is already fully refunded */}
        <InfoModal
          open={showAlreadyRefundedInfo}
          title="Order Already Refunded"
          message={`Order id: ${alreadyRefundedOrderLabel} is already refunded.`}
          onClose={() => {
            setShowAlreadyRefundedInfo(false);
            if (tempOrderRef.current) {
              setSelectedOrder(tempOrderRef.current);
              setView('full_detail');
              tempOrderRef.current = null;
              setAlreadyRefundedOrderLabel("");
            }
          }}
        />

        {/* Filter toolbar (visible on list view only) */}
        <div className="flex flex-col md:flex-row items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Show:</label>
            <input type="number" min={1} max={1000} value={limit} onChange={e => setLimit(Math.max(1, Number(e.target.value || 1)))} className="filter-input w-20" />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Status:</label>
            <StatusCheckboxDropdown value={statusFilter} onChange={setStatusFilter} />
          </div>

          <div className="ml-auto text-sm text-gray-600">
            <span>Showing {orders.length} / {limit}</span>
          </div>
        </div>

        <OrderPreviewList
          orders={orders}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onViewOrder={(id) => handleViewOrder(id, 'view')}
          onPartialRefund={(id) => handleViewOrder(id, 'partial')}
          onFullRefund={(id) => handleViewOrder(id, 'full')}
          onSubstitute={(order) => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('substituteOrderId', order.orderShortId);
              window.dispatchEvent(new CustomEvent('admin:navigate', { detail: { module: 'substitute' } }));
            }
          }}
          limit={limit}
        />
      </div>
    );
  }

  if (view === 'details' && selectedOrder) {
    const canSubstitute = ["CREATED", "ACCEPTED_BY_STORE", "PARTIALLY_ACCEPTED_BY_STORE", "SCHEDULED"].includes(
      String(selectedOrder.orderStatus ?? "").toUpperCase()
    );

    return (
      <div className="page-container-sidebar page-content p-4 md:p-6">
        <div className="page-header flex justify-between items-center">
          <h2 className="page-title">Order Detail</h2>
          <button onClick={handleBackToLanding} className="text-sm text-gray-500 hover:text-gray-700 underline">&larr; Back to orders</button>
        </div>
        <OrderDetailsDialog order={selectedOrder} />

        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setView('partial_detail')} className="px-3 py-2 rounded-lg text-sm font-semibold border border-yellow-200 text-yellow-700 hover:bg-yellow-50 transition-colors">
              Partial Refund
            </button>
            <button onClick={() => setView('full_detail')} className="px-3 py-2 rounded-lg text-sm font-semibold border border-red-200 text-red-700 hover:bg-red-50 transition-colors">
              Full Refund
            </button>
            {canSubstitute && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('substituteOrderId', selectedOrder.orderShortId ?? selectedOrder.orderUuid);
                    window.dispatchEvent(new CustomEvent('admin:navigate', { detail: { module: 'substitute' } }));
                  }
                }}
                className="px-3 py-2 rounded-lg text-sm font-semibold border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
              >
                Substitute Item
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'full_detail' && selectedOrder) {
    return <FullRefundDetail order={selectedOrder} onBack={() => setView('list')} onProcessRefund={handleProcessFullRefund} />;
  }

  if (view === 'partial_detail' && selectedOrder) {
    return <PartialRefundDetail order={selectedOrder} onBack={() => setView('list')} onProcessRefund={handleProcessPartialRefund} />;
  }

  return null;
}



