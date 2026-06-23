// src/components/RecentOrdersAndSubstitute.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { apiService } from "@/services/apiService";
import type {
  RecentOrder,
  Order,
  GroupedStoreInventoryResponseDTO,
  StoreInventoryVariantDTO,
  SubstitutionItemRequest,
  SubstitutionRequest,
  SelectedInventoryPick
} from "@/services/types";

export function SubstituteModule() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [resolvingStore, setResolvingStore] = useState(false);
  const [activeOrderShortId, setActiveOrderShortId] = useState<string | null>(null);
  const [orderFull, setOrderFull] = useState<any | null>(null);
  const [loadingOrderFull, setLoadingOrderFull] = useState(false);

  const [inventoryMap, setInventoryMap] = useState<Record<string, GroupedStoreInventoryResponseDTO[] | null>>({});
  const [loadingInventoryMap, setLoadingInventoryMap] = useState<Record<string, boolean>>({});

  const [itemsCancelled, setItemsCancelled] = useState<Record<number, boolean>>({});
  type LocalPreview = SubstitutionItemRequest & { storeUuid?: string };
  const [previewSubs, setPreviewSubs] = useState<LocalPreview[]>([]);
  const [activeOriginalId, setActiveOriginalId] = useState<number | null>(null);

  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventoryModalStoreUuid, setInventoryModalStoreUuid] = useState<string | null>(null);
  const [selectedInventoryPick, setSelectedInventoryPick] = useState<{
    storeInventoryId: number;
    variant?: StoreInventoryVariantDTO | null;
    productName?: string;
    qty: number;
    storeUuid?: string;
  } | null>(null);

  const [inventoryQtyMap, setInventoryQtyMap] = useState<Record<number, number | ''>>({});
  const [submitting, setSubmitting] = useState(false);

  // Load recent orders
  useEffect(() => {
    loadRecent();
  }, []);

  async function loadRecent() {
    setLoadingOrders(true);
    setError(null);
    try {
      const res = await apiService.getRecentOrders(45);
      setOrders(res || []);
    } catch (err: any) {
      console.error("loadRecent", err);
      setError(err?.message ?? "Failed to load recent orders");
    } finally {
      setLoadingOrders(false);
    }
  }

  // Open modal for an order
  async function openSubstituteFor(order: RecentOrder) {
    if (!order?.orderShortId) {
      alert("Order is missing short id");
      return;
    }
    setResolvingStore(true);
    try {
      setActiveOrderShortId(order.orderShortId);
      await openModalAndLoad(order.orderShortId);
    } catch (err: any) {
      console.error("openSubstituteFor", err);
      alert("Failed to open substitute modal: " + (err?.message ?? err));
    } finally {
      setResolvingStore(false);
    }
  }

  // open modal + load order + inventories
  async function openModalAndLoad(orderShortId: string) {
    setModalOpen(true); 
    setOrderFull(null);
    setInventoryMap({});
    setItemsCancelled({});
    setPreviewSubs([]);
    setActiveOriginalId(null);
    setSelectedInventoryPick(null);
    setInventoryQtyMap({});

    setLoadingOrderFull(true);
    try {
      const full = await apiService.getTrackedOrder(orderShortId);
      setOrderFull(full);

      // derive store list
      let storesArray: any[] = [];
      const sCandidates = (full as any)?.stores ?? (full as any)?.orderStores ?? (full as any)?.orderStoresDTO ?? null;
      if (Array.isArray(sCandidates) && sCandidates.length > 0) storesArray = sCandidates;
      else {
        const storeUuid = (full as any)?.storeUuid ?? (full as any)?.store?.uuid ?? null;
        if (storeUuid) {
          storesArray = [{ storeUuid, storeName: (full as any)?.store?.storeName ?? (full as any)?.storeName ?? "Store", items: (full as any)?.items ?? [] }];
        }
      }

      // fetch inventory per store
      const invMap: Record<string, GroupedStoreInventoryResponseDTO[] | null> = {};
      const loadFlags: Record<string, boolean> = {};
      await Promise.all(
        storesArray.map(async (s) => {
          const uuid = s.storeUuid ?? s.uuid ?? s.store?.uuid ?? s.store?.storeUuid;
          if (!uuid) return;
          loadFlags[uuid] = true;
          try {
            const pg = await apiService.getStoreInventory(uuid, 0, 200);
            const content = (pg as any)?.content ?? pg;
            invMap[uuid] = Array.isArray(content) ? content : [];
          } catch (err) {
            console.warn(`Failed loading inventory for ${uuid}`, err);
            invMap[uuid] = null;
          } finally {
            loadFlags[uuid] = false;
          }
        })
      );
      setInventoryMap(invMap);
      setLoadingInventoryMap(loadFlags);
    } catch (err: any) {
      console.error("load full order", err);
      alert("Failed to load order details: " + (err?.message ?? err));
      setModalOpen(false);
      return;
    } finally {
      setLoadingOrderFull(false);
    }
  }

  // storesInOrder
  const storesInOrder = useMemo(() => {
    if (!orderFull) return [] as any[];
    const stores = (orderFull as any)?.stores ?? (orderFull as any)?.orderStores ?? (orderFull as any)?.orderStoresDTO ?? [];
    if (Array.isArray(stores) && stores.length > 0) return stores;
    const storeUuid = (orderFull as any)?.storeUuid ?? (orderFull as any)?.store?.uuid ?? null;
    if (storeUuid) {
      return [{ storeUuid, storeName: (orderFull as any)?.store?.storeName ?? (orderFull as any)?.storeName ?? "Store", items: (orderFull as any)?.items ?? [] }];
    }
    return [] as any[];
  }, [orderFull]);

  // itemsForStore: filter REPLACED_ITEM
  function itemsForStore(s: any) {
    const candidates: any[] =
      Array.isArray(s?.items) ? s.items :
      Array.isArray((orderFull as any)?.items) ? (orderFull as any).items :
      [];
    return candidates.filter((it: any) => {
      const status = (it?.status ?? "").toString().trim().toUpperCase();
      return status !== "REPLACED_ITEM";
    });
  }

  // UI actions
  function toggleCancel(itemId: number) {
    let itemStatus: string | null = null;
    for (const s of storesInOrder) {
      const its = (s && Array.isArray(s.items)) ? s.items : [];
      const found = its.find((it: any) => (it.itemId ?? it.id) === itemId);
      if (found) {
        itemStatus = (found.status ?? "").toString().toUpperCase();
        break;
      }
    }

    if (itemStatus === "REPLACED_ITEM") {
      alert("This item was already replaced and cannot be cancelled.");
      return;
    }

    setItemsCancelled((prev) => {
      const next = { ...prev };
      if (next[itemId]) delete next[itemId];
      else next[itemId] = true;
      return next;
    });
    setPreviewSubs((p) => p.filter((s) => s.originalOrderItemId !== itemId));
  }

  function startAddSub(originalOrderItemId: number, storeUuid?: string) {
    // check item status
    let itemStatus: string | null = null;
    for (const s of storesInOrder) {
      const its = (s && Array.isArray(s.items)) ? s.items : [];
      const found = its.find((it: any) => (it.itemId ?? it.id) === originalOrderItemId);
      if (found) {
        itemStatus = (found.status ?? "").toString().toUpperCase();
        break;
      }
    }

    if (itemStatus === "REPLACED_ITEM") {
      alert("Can't add a substitute for an item that is already replaced.");
      return;
    }

    setActiveOriginalId(originalOrderItemId);
    setInventoryModalStoreUuid(storeUuid ?? null);
    setSelectedInventoryPick(null);
    setInventoryModalOpen(true);
  }

  function addAdhocSub(storeUuid?: string) {
    setActiveOriginalId(-1);
    setInventoryModalStoreUuid(storeUuid ?? null);
    setSelectedInventoryPick(null);
    setInventoryModalOpen(true);
  }

  function quickAddFromInventory(v: StoreInventoryVariantDTO, storeUuid: string) {
    if (activeOriginalId == null) {
      alert("No target order item selected. Choose an order item first or use ad-hoc mode.");
      return;
    }

    const qRaw = inventoryQtyMap[v.storeInventoryId];
    const qty = qRaw === '' || qRaw == null ? 1 : Number(qRaw);
    const safeQty = Math.max(0, Math.floor(qty));
    if (safeQty <= 0) {
      alert("Please enter a quantity >= 1 to add a substitute.");
      return;
    }

    const chosenQty = Math.min(safeQty, v.quantity ?? safeQty);

    setPreviewSubs((p) => {
      const idx = p.findIndex((x) => x.originalOrderItemId === activeOriginalId);
      const entry = {
        originalOrderItemId: activeOriginalId!,
        substituteStoreInventoryId: v.storeInventoryId,
        substituteQuantity: chosenQty,
        storeUuid,
      } as LocalPreview;
      if (idx >= 0) {
        const next = [...p];
        next[idx] = entry;
        return next;
      } else {
        return [...p, entry];
      }
    });

    setInventoryModalOpen(false);
    setActiveOriginalId(null);
    setInventoryQtyMap((prev) => ({ ...prev, [v.storeInventoryId]: '' }));
  }

  function confirmInventoryPick() {
    if (!selectedInventoryPick) {
      alert("Select inventory and quantity first.");
      return;
    }
    if (activeOriginalId == null) {
      alert("No order item selected (or choose ad-hoc).");
      return;
    }

    const id = selectedInventoryPick.storeInventoryId;
    const qRaw = inventoryQtyMap[id];
    const qty = qRaw === '' || qRaw == null ? selectedInventoryPick.qty ?? 1 : Number(qRaw);
    const safeQty = Math.max(0, Math.floor(qty));

    if (safeQty <= 0) {
      alert("Please set a quantity of at least 1 to add as a substitute. Use Cancel button to cancel the item.");
      return;
    }

    const avail = selectedInventoryPick.variant?.quantity ?? 0;
    if (safeQty > avail) {
      alert(`Selected quantity (${safeQty}) exceeds available (${avail})`);
      return;
    }

    const entry: LocalPreview = {
      originalOrderItemId: activeOriginalId,
      substituteStoreInventoryId: id,
      substituteQuantity: safeQty,
      storeUuid: selectedInventoryPick.storeUuid,
    };

    setPreviewSubs((p) => {
      const idx = p.findIndex((x) => x.originalOrderItemId === activeOriginalId);
      if (idx >= 0) {
        const next = [...p];
        next[idx] = entry;
        return next;
      }
      return [...p, entry];
    });

    setInventoryModalOpen(false);
    setActiveOriginalId(null);
    setSelectedInventoryPick(null);
    setInventoryQtyMap((prev) => ({ ...prev, [id]: '' }));
  }

  function removePreviewAt(index: number) {
    setPreviewSubs((p) => p.filter((_, i) => i !== index));
  }

  // Submit
  async function handleSubmitAll() {
    const subs: LocalPreview[] = [...previewSubs];

    const cancelledIds = Object.keys(itemsCancelled)
      .map((k) => Number(k))
      .filter((id) => !subs.some((s) => s.originalOrderItemId === id));

    for (const id of cancelledIds) {
      let parentStoreUuid: string | undefined;
      for (const s of storesInOrder) {
        const its = itemsForStore(s) || [];
        if (its.some((it: any) => (it.itemId ?? it.id) === id)) {
          parentStoreUuid = s.storeUuid ?? s.uuid ?? s.store?.uuid;
          break;
        }
      }

      let candidate: number | null = null;
      if (parentStoreUuid && inventoryMap[parentStoreUuid] && inventoryMap[parentStoreUuid]?.length) {
        const firstInv = inventoryMap[parentStoreUuid]![0];
        if (firstInv && firstInv.variants && firstInv.variants.length) {
          candidate = firstInv.variants[0].storeInventoryId;
        }
      }

      if (!candidate) {
        const anyStore = Object.keys(inventoryMap)[0];
        const firstInv = anyStore ? inventoryMap[anyStore] : null;
        if (firstInv && firstInv.length && firstInv[0].variants && firstInv[0].variants.length) {
          candidate = firstInv[0].variants[0].storeInventoryId;
        }
      }

      if (!candidate) {
        alert(`Cannot cancel item ${id}: no inventory found to reference for cancellation.`);
        return;
      }

      subs.push({ originalOrderItemId: id, substituteStoreInventoryId: candidate, substituteQuantity: 0, storeUuid: parentStoreUuid });
    }

    if (subs.length === 0) {
      alert("No substitutions or cancellations to submit.");
      return;
    }

    const groups = new Map<string, SubstitutionItemRequest[]>();
    for (const s of subs) {
      const store = s.storeUuid ?? (Object.keys(inventoryMap)[0] ?? "unknown-store");
      if (!groups.has(store)) groups.set(store, []);
      groups.get(store)!.push({ originalOrderItemId: s.originalOrderItemId, substituteStoreInventoryId: s.substituteStoreInventoryId, substituteQuantity: s.substituteQuantity });
    }

    if (!activeOrderShortId) {
      alert("Internal error: missing order context.");
      return;
    }

    setSubmitting(true);
    try {
      const promises: Promise<any>[] = [];
      for (const [storeUuid, items] of groups.entries()) {
        const payload: SubstitutionRequest = { orderShortId: activeOrderShortId!, storeUuid, substitutions: items };
        promises.push(apiService.substituteItems(payload));
      }
      await Promise.all(promises);
      alert("Substitution(s) submitted successfully.");

      setPreviewSubs([]);
      setItemsCancelled({});
      setModalOpen(false);
      await loadRecent();
    } catch (err: any) {
      console.error("submit substitution", err);
      alert("Failed to submit substitution: " + (err?.message ?? err));
    } finally {
      setSubmitting(false);
    }
  }

  // Render
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-[#FF6600]">Recent Orders</h2>
        <div className="flex gap-2">
          <button onClick={loadRecent} className="px-3 py-1 rounded bg-[#FF6600] text-white" disabled={loadingOrders}>
            {loadingOrders ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="text-red-600 mb-3">Error: {error}</div>}

      {loadingOrders ? (
        <div>Loading recent orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-gray-500">No recent orders.</div>
      ) : (
        <div className="overflow-auto shadow rounded bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#FF6600] text-white">
                <th className="p-2 text-left">Short ID</th>
                <th className="p-2 text-left">Customer</th>
                <th className="p-2 text-left">Address</th>
                <th className="p-2 text-left">Total</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Updated</th>
                <th className="p-2 text-left">Sub</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderShortId} className="hover:bg-gray-100 text-black">
                  <td className="p-2 text-sm">{o.orderShortId}</td>
                  <td className="p-2 text-sm">{o.customerName ?? "-"}</td>
                  <td className="p-2 text-sm">{o.address ?? "-"}</td>
                  <td className="p-2 text-sm">{o.originalTotal ?? "-"}</td>
                  <td className="p-2 text-sm">{o.orderStatus ?? "-"}</td>
                  <td className="p-2 text-sm">{o.updatedAt ? new Date(o.updatedAt).toLocaleString() : "-"}</td>
                  <td className="p-2">
                    <button className="px-2 py-1 rounded bg-[#FF6600] text-white text-sm" onClick={() => openSubstituteFor(o)} disabled={resolvingStore}>
                      Substitute
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && orderFull && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 px-4">
          <div className="absolute inset-0 bg-black opacity-40" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded shadow-lg z-60 w-full max-w-7xl p-6 overflow-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-[#FF6600]">Substitute — Order {activeOrderShortId}</h3>
              <div>
                <button onClick={() => setModalOpen(false)} className="text-sm text-gray-600">
                  Close
                </button>
              </div>
            </div>

            {loadingOrderFull ? (
              <div>Loading order...</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {storesInOrder.map((s: any, storeIndex: number) => {
                    const storeUuid = s.storeUuid ?? s.uuid ?? s.store?.uuid ?? s.store?.storeUuid ?? `store-${storeIndex}`;
                    const items = itemsForStore(s) || [];
                    const invForStore = inventoryMap[storeUuid];
                    const loadingInv = loadingInventoryMap[storeUuid];
                    return (
                      <div key={storeUuid} className="bg-white border rounded p-3 shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          {/* Left side: Store name + UUID */}
                          <div>
                            <div className="font-medium text-sm">
                              Store Name:&nbsp;
                              <span className="text-gray-800">
                                {s.storeName ?? s.store?.storeName ?? `Store ${storeUuid}`}
                              </span>
                            </div>

                          </div>

                          {/* Right side: Single button */}
                          <button
                            onClick={() => {
                              setActiveOriginalId(-1); // ad-hoc mode
                              setInventoryModalStoreUuid(storeUuid);
                              setSelectedInventoryPick(null);
                              setInventoryModalOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-[#FF6600] text-white text-sm"
                          >
                            Browse / Add
                          </button>
                        </div>



                        <div className="mb-2">
                          <div className="text-xs text-gray-500 mb-1">Ordered items</div>
                          {items.length === 0 ? (
                            <div className="text-gray-500 text-sm">No items</div>
                          ) : (
                            <ul className="space-y-2">
                              {items.map((it: any, itIndex: number) => {
                                const itemId = it.itemId ?? it.id ?? `item-${itIndex}`;
                                const cancelled = !!itemsCancelled[itemId];
                                return (
                                  <li key={`${storeUuid}-item-${itemId}`} className={`flex items-center justify-between gap-2 p-2 border rounded ${cancelled ? "opacity-60" : ""}`}>
                                    <div>
                                      <div className="text-sm font-medium">{it.itemName ?? it.name ?? it.displayName ?? "Item"}</div>
                                      <div className="text-xs text-gray-500">Qty: {it.quantity ?? it.qty ?? 1}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button onClick={() => toggleCancel(itemId)} className={`px-2 py-1 rounded text-sm ${cancelled ? "bg-red-600 text-white" : "bg-gray-200"}`}>
                                        −
                                      </button>
                                      <button onClick={() => startAddSub(itemId, storeUuid)} className="px-2 py-1 rounded bg-[#FF6600] text-white text-sm">
                                        +
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </div>

                        <div>
                          <div className="text-xs text-gray-500 mb-1">Inventory preview</div>
                          {loadingInv ? (
                            <div className="text-sm">Loading inventory...</div>
                          ) : !invForStore || invForStore.length === 0 ? (
                            <div className="text-gray-500 text-sm">No inventory for this store</div>
                          ) : (
                            <div className="space-y-2 max-h-36 overflow-auto">
                              {invForStore.slice(0, 6).map((g, gi) => (
                                <div key={`${storeUuid}-prod-${g.productId ?? gi}`} className="p-2 border rounded bg-gray-50">
                                  <div className="text-sm font-medium">{g.productName}</div>
                                  <div className="text-xs text-gray-600">Variants: {g.variants.length}</div>
                                </div>
                              ))}
                              {invForStore.length > 6 && <div className="text-xs text-gray-400">...and more. Use Browse to see all.</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="bg-white border rounded p-3 shadow-sm">
                  <h4 className="font-medium mb-2">Preview</h4>

                  {previewSubs.length === 0 ? (
                    <div className="text-gray-500">No substitutions yet.</div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="p-2 text-left">Store</th>
                            <th className="p-2 text-left">Inventory</th>
                            <th className="p-2">Qty</th>
                            <th className="p-2">Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewSubs.map((p, i) => (
                            <tr key={`${p.storeUuid ?? "s"}-inv-${p.substituteStoreInventoryId}-orig-${p.originalOrderItemId ?? i}`} className="hover:bg-gray-50">
                              <td className="p-2">{p.storeUuid ?? "(unknown)"}</td>
                              <td className="p-2">{p.substituteStoreInventoryId}</td>
                              <td className="p-2">{p.substituteQuantity}</td>
                              <td className="p-2 text-center">
                                <button onClick={() => removePreviewAt(i)} className="px-2 py-1 rounded bg-red-500 text-white text-xs">
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {Object.keys(itemsCancelled).length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium">Cancellations</h5>
                      <ul className="text-sm text-gray-600 space-y-1 mt-2">
                        {Object.keys(itemsCancelled).map((k) => (
                          <li key={`cancel-${k}`}>
                            Item <strong>{k}</strong> — <span className="text-red-600">Cancelled</span>{" "}
                            <button onClick={() => toggleCancel(Number(k))} className="ml-3 text-xs px-2 py-1 border rounded">
                              Undo
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={() => setModalOpen(false)} className="px-3 py-1 border rounded">
                    Cancel
                  </button>
                  <button onClick={handleSubmitAll} className={`px-4 py-2 rounded text-white ${submitting ? "bg-gray-400" : "bg-[#FF6600]"}`} disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit All"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}    

{inventoryModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black opacity-40" onClick={() => setInventoryModalOpen(false)} />
    <div className="bg-white rounded shadow-lg z-60 w-[95%] max-w-4xl p-5 max-h-[85vh] overflow-auto">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-semibold">
          Select inventory to substitute 
        </h4>
        <button 
          onClick={() => setInventoryModalOpen(false)} 
          className="text-2xl text-gray-600 font-light leading-none hover:text-gray-900 transition duration-150"
          aria-label="Close modal"
        >
          &times;
        </button>
      </div>

      {inventoryModalStoreUuid && loadingInventoryMap[inventoryModalStoreUuid as keyof typeof loadingInventoryMap] ? (
        <div>Loading inventory...</div>
      ) : (
        <div className="space-y-3">
          {(
            inventoryModalStoreUuid
              ? (inventoryMap[inventoryModalStoreUuid] as GroupedStoreInventoryResponseDTO[] ?? [])
              : Object.values(inventoryMap).flatMap((x) => (x ?? []))
          ).map((g: GroupedStoreInventoryResponseDTO, gIndex: number) => {
            
            // --- CORE LOGIC FIXES ---
            const defaultVariant = g.variants?.[0];
            
            // Determine the variant whose UI controls (Dropdown, Input) are currently relevant/active.
            // If the selected pick belongs to this group, use its ID. Otherwise, default to the first variant's ID.
            const currentVariantId = selectedInventoryPick && g.variants.some(v => v.storeInventoryId === selectedInventoryPick.storeInventoryId) 
                                       ? selectedInventoryPick.storeInventoryId 
                                       : defaultVariant?.storeInventoryId;

            const selectedVariant = g.variants.find((v: StoreInventoryVariantDTO) => v.storeInventoryId === currentVariantId) || defaultVariant;

            const isPicked = selectedInventoryPick?.storeInventoryId === currentVariantId;
            
            // Quantity shown in the input box: empty string for placeholder/not set, otherwise the stored value
            const displayedQty = currentVariantId ? (inventoryQtyMap[currentVariantId] ?? "") : "";

            return (
              <div key={`${inventoryModalStoreUuid ?? "global"}-prod-${g.productId ?? gIndex}`} className="border p-3 rounded flex items-center gap-3">
                <div className="w-14 h-14 flex-shrink-0">
                  {g.variants?.[0]?.thumbnailImageUrl ? (
                    <Image
                      src={g.variants[0].thumbnailImageUrl}
                      alt={g.productName}
                      width={56}
                      height={56}
                      className="w-14 h-14 object-cover rounded"
                      unoptimized
                    />
                  ) : (
                    <div className="w-14 h-14 bg-gray-100 flex items-center justify-center text-xs">IMG</div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{g.productName}</div>
                  <div className="text-xs text-gray-500">Variants: {g.variants.length}</div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {/* VARIANT SELECT */}
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    onChange={(e) => {
                      const vid = Number(e.target.value);
                      const v = g.variants.find((x: StoreInventoryVariantDTO) => x.storeInventoryId === vid);
                      if (!v) return;

                      // Update the selected pick to this new variant
                      setSelectedInventoryPick({
                        storeInventoryId: v.storeInventoryId,
                        variant: v,
                        productName: g.productName,
                        // Use quantity from map, default to 1 if not set (for quantity preview)
                        qty: Number(inventoryQtyMap[vid] ?? 1), 
                        storeUuid: inventoryModalStoreUuid ?? undefined,
                      } as SelectedInventoryPick); // Type assertion needed here due to the complexity of JSX context
                      
                      // Ensure the quantity map has an entry for the newly selected variant
                      setInventoryQtyMap((prev) => ({ ...prev, [vid]: prev[vid] ?? "" }));
                    }}
                    value={currentVariantId ?? ""} 
                  >
                    <option value="">Select variant</option>
                    {g.variants.map((v: StoreInventoryVariantDTO, vi: number) => (
                      <option
                        key={`var-${v.storeInventoryId ?? vi}`}
                        value={v.storeInventoryId}
                      >
                        {v.packageName ?? `Variant ${v.variantId}`} — avail: {v.quantity}
                      </option>
                    ))}
                  </select>

                  {/* QUANTITY INPUT - Uses currentVariantId for isolated state */}
                  <input
                    type="number"
                    min={0}
                    placeholder="Qty" 
                    value={displayedQty} 
                    onChange={(e) => {
                      const raw = e.target.value;
                      // Allow empty string for placeholder behavior
                      const value = raw === "" ? "" : Math.max(0, Number(raw || 0));
                      const idToUpdate = selectedVariant?.storeInventoryId; 

                      if (!idToUpdate) return;
                      
                      setInventoryQtyMap((prev) => ({ ...prev, [idToUpdate]: value }));
                      
                      // If this is the active selection, also update its qty preview
                      if (selectedInventoryPick?.storeInventoryId === idToUpdate) {
                        setSelectedInventoryPick((p) => (p ? { ...p, qty: value === "" ? 0 : Number(value) } : p));
                      }
                    }}
                    className="w-24 border rounded px-2 py-1 text-sm"
                  />

                  {/* BUTTONS (Select / Quick Add) */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const v = selectedVariant;
                        if (!v) return alert("Select a variant first");
                        
                        // Get qty from map and validate
                        const qtyRaw = inventoryQtyMap[v.storeInventoryId];
                        const qtyVal = qtyRaw === "" || qtyRaw == null || Number(qtyRaw) <= 0 
                            ? 0 
                            : Number(qtyRaw);
                            
                        if (qtyVal < 1) {
                            return alert("Please input a valid quantity (>= 1) to Select.");
                        }

                        setSelectedInventoryPick({ 
                          storeInventoryId: v.storeInventoryId, 
                          variant: v, 
                          productName: g.productName, 
                          qty: qtyVal, 
                          storeUuid: inventoryModalStoreUuid ?? undefined 
                        } as SelectedInventoryPick);
                      }}
                      // Highlight green when the current variant is the selected pick AND has a valid quantity set
                      className={`px-3 py-1 rounded text-white ${isPicked && Number(displayedQty) > 0 ? "bg-green-600" : "bg-[#FF6600]"}`}
                    >
                      Select
                    </button>

                    <button
                      onClick={() => {
                        const v = selectedVariant;
                        if (!v) return alert("Select a variant first");
                        
                        const qRaw = inventoryQtyMap[v.storeInventoryId];
                        // Validation: check for quantity before quick adding
                        if (qRaw === "" || qRaw == null || Number(qRaw) <= 0) {
                          return alert("Please input a valid quantity (>= 1) to Quick Add.");
                        }

                        quickAddFromInventory(v, inventoryModalStoreUuid ?? Object.keys(inventoryMap)[0] ?? "");
                      }}
                      className="px-3 py-1 rounded border"
                    >
                      Quick Add
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {(!inventoryModalStoreUuid && Object.keys(inventoryMap).length === 0) && <div className="text-gray-500">No inventory loaded.</div>}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => setInventoryModalOpen(false)} className="px-3 py-1 border rounded">
          Cancel
        </button>
        {/* FINAL VALIDATION: Must have a pick AND the quantity must be > 0 */}
        <button 
            onClick={() => {
                if (selectedInventoryPick && selectedInventoryPick.qty > 0) {
                    confirmInventoryPick();
                    setInventoryModalOpen(false); // Optionally close the modal here
                } else {
                    alert("Please select an item and input a quantity (>= 1) before adding to preview.");
                }
            }} 
            className="px-4 py-2 rounded bg-[#FF6600] text-white" 
            disabled={!selectedInventoryPick || selectedInventoryPick.qty <= 0}
        >
          Add to Preview
        </button>
      </div>
    </div>
  </div>
)}    </div>
  );
}
