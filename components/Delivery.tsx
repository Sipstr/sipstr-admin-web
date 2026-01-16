"use client";

import React, { useEffect, useState } from "react";
import { deliveryZoneService } from "../services/deliveryZone";
import { apiService } from "../services/apiService";
import type { DeliveryZone, CreateDeliveryZoneRequest } from "../services/types";
import MapPreviewGoogle from "../googlemap/MapPreviewGoogle";

/* ----------------- parseKmlToPlacemarks (unchanged) ----------------- */
function parseKmlToPlacemarks(kmlText: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, "application/xml");

  let placemarkNodes: Element[] = [];
  try {
    placemarkNodes = Array.from(doc.getElementsByTagNameNS?.("*", "Placemark") || []);
  } catch (e) {
    placemarkNodes = [];
  }
  if (placemarkNodes.length === 0) {
    placemarkNodes = Array.from(doc.getElementsByTagName("Placemark") || []);
  }

  const canonicalKey = (rawKey: string) => {
    const k = rawKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const map: Record<string, string> = {
      zonename: "zoneName",
      zone: "zoneName",
      name: "zoneName",
      basefee: "baseDeliveryFee",
      "basedeliveryfee": "baseDeliveryFee",
      "permilefee": "perMileFee",
      permile: "perMileFee",
      minorder: "minOrderAmount",
      minorderamount: "minOrderAmount",
      estpreptime: "estimatedPreparationTime",
      estprep: "estimatedPreparationTime",
      estimatedpreparationtime: "estimatedPreparationTime",
      restricted: "isRestricted",
      isrestricted: "isRestricted",
      allow: "isRestricted",
    };
    return map[k] ?? rawKey;
  };

  const parseValue = (val: string) => {
    const v = String(val).trim();
    if (!v) return v;
    const low = v.toLowerCase();
    if (low === "yes" || low === "true") return true;
    if (low === "no" || low === "false") return false;
    const withoutUnits = v.replace(/\b(mins?|minutes?)\b/gi, "").trim();
    const numCandidate = withoutUnits.match(/-?\d+(\.\d+)?/);
    if (numCandidate) {
      const n = Number(numCandidate[0]);
      if (!Number.isNaN(n)) return n;
    }
    return v;
  };

  const parsed = placemarkNodes.map((pm) => {
    const nameEl = pm.getElementsByTagName("name")[0];
    const descEl = pm.getElementsByTagName("description")[0];

    let coordsEl = pm.getElementsByTagName("coordinates")[0];
    if (!coordsEl) {
      const allCoords = Array.from(pm.getElementsByTagNameNS?.("*", "coordinates") || []);
      if (allCoords.length > 0) coordsEl = allCoords[0];
    }

    const name = nameEl ? nameEl.textContent?.trim() ?? "" : "";
    const rawDescription = descEl ? descEl.textContent ?? "" : "";

    let coordinates: number[][] = [];
    if (coordsEl && coordsEl.textContent) {
      const coordsText = coordsEl.textContent.trim();
      const tokens = coordsText.split(/\s+/).map((t) => t.trim()).filter(Boolean);
      coordinates = tokens.map((tok) => {
        const parts = tok.split(",").map((p) => p.trim());
        const lon = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        return [lat, lon];
      }).filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    }

    let descData: Record<string, any> = {};
    const cleaned = (rawDescription || "").trim();
    const withNewlines = cleaned.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "\n").trim();

    try {
      if (cleaned.startsWith("{")) {
        const maybeJson = JSON.parse(cleaned);
        if (maybeJson && typeof maybeJson === "object") {
          descData = maybeJson;
        }
      } else {
        const lines = withNewlines.split("\n").map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const sepIndex = line.indexOf(":");
          if (sepIndex > -1) {
            const keyRaw = line.slice(0, sepIndex).trim();
            const valueRaw = line.slice(sepIndex + 1).trim();
            const key = canonicalKey(keyRaw);
            descData[key] = parseValue(valueRaw);
          } else {
            const dashIndex = line.indexOf(" - ");
            if (dashIndex > -1) {
              const keyRaw = line.slice(0, dashIndex).trim();
              const valueRaw = line.slice(dashIndex + 3).trim();
              const key = canonicalKey(keyRaw);
              descData[key] = parseValue(valueRaw);
            } else {
              if (!descData.notes) descData.notes = [];
              descData.notes.push(line);
            }
          }
        }
      }
    } catch (err) {
      const lines = withNewlines.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const sepIndex = line.indexOf(":");
        if (sepIndex > -1) {
          const keyRaw = line.slice(0, sepIndex).trim();
          const valueRaw = line.slice(sepIndex + 1).trim();
          const key = canonicalKey(keyRaw);
          descData[key] = parseValue(valueRaw);
        } else {
          if (!descData.notes) descData.notes = [];
          descData.notes.push(line);
        }
      }
    }

    return {
      name,
      rawDescription,
      parsedDescription: descData,
      coordinates,
    };
  });

  return parsed;
}

/* ----------------- Helpers for placemark UI ----------------- */
function labelForKey(k: string) {
  const map: Record<string, string> = {
    zoneName: "Zone",
    baseDeliveryFee: "Base Fee",
    perMileFee: "Per Mile",
    minOrderAmount: "Min Order",
    estimatedPreparationTime: "Est Prep (mins)",
    isRestricted: "Restricted",
  };
  return map[k] ?? k;
}
function formatValueForKey(key: string, value: any) {
  if (value == null || value === "") return "-";
  if (key === "isRestricted") return value ? "Yes" : "No";
  if (typeof value === "number") return value;
  return String(value);
}

/* ------------------ AlertDialog (copied & adapted from TopPicksModule) ------------------ */
type CustomAlert = {
  isOpen: boolean;
  message: string;
  isConfirm: boolean;
  onConfirm?: () => Promise<void> | void;
  onCancel?: () => void;
};

const alertStyles = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    background: "rgba(0,0,0,0.35)",
    padding: 16,
  },
  dialog: {
    width: 420,
    maxWidth: "100%",
    background: "#fff",
    borderRadius: 10,
    padding: 20,
    boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  },
  title: {
    marginBottom: 8,
    fontSize: 18,
    fontWeight: 700,
    color: "#222",
  },
  message: {
    marginBottom: 18,
    color: "#333",
    lineHeight: 1.35,
  },
  actions: (isConfirm: boolean) => ({
    display: "flex",
    gap: 10,
    justifyContent: isConfirm ? "flex-end" : "center",
  }),
  cancelButton: {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
  },
  confirmButton: {
    padding: "8px 14px",
    borderRadius: 6,
    border: "none",
    background: "#FF6600",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
    boxShadow: "0 4px 12px rgba(255,102,0,0.12)",
  },
};

const AlertDialog: React.FC<{ alert: CustomAlert; onClose: () => void }> = ({ alert, onClose }) => {
  if (!alert.isOpen) return null;

  const handleConfirm = async () => {
    if (alert.onConfirm) await alert.onConfirm();
    onClose();
  };

  const handleCancel = () => {
    alert.onCancel?.();
    onClose();
  };

  return (
    <div role={alert.isConfirm ? "dialog" : "alertdialog"} aria-modal="true" style={alertStyles.overlay} onClick={onClose}>
      <div style={alertStyles.dialog} onClick={(e) => e.stopPropagation()}>
        <div style={alertStyles.title}>{alert.isConfirm ? "Please confirm" : "Notice"}</div>
        <div style={alertStyles.message}>{alert.message}</div>
        <div style={alertStyles.actions(alert.isConfirm)}>
          {alert.isConfirm && (
            <button onClick={handleCancel} style={alertStyles.cancelButton}>
              Cancel
            </button>
          )}
          <button onClick={handleConfirm} style={alertStyles.confirmButton}>
            {alert.isConfirm ? "Confirm" : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ----------------- Component ----------------- */
export default function DeliveryZonesAdmin() {
  const [storeName, setStoreName] = useState("");
  const [stores, setStores] = useState<{ uuid: string; storeName: string }[]>([]);
  const [selectedStoreUuid, setSelectedStoreUuid] = useState<string | null>(null);

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const [showModal, setShowModal] = useState(false);
  const [parsedPlacemarks, setParsedPlacemarks] = useState<any[]>([]);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [isAddHover, setIsAddHover] = useState(false);

  // editing states
  const [editingPlacemarkIndex, setEditingPlacemarkIndex] = useState<number | null>(null);
  const [editingZoneId, setEditingZoneId] = useState<number | null>(null);

  const [form, setForm] = useState<CreateDeliveryZoneRequest>({
    zoneName: "",
    baseDeliveryFee: 0,
    perMileFee: 0,
    minOrderAmount: 0,
    estimatedPreparationTime: 0,
    restricted: false,
    coordinates: [[0, 0]],
    storeUuid: "",
  });

  /* --- Alert state & helpers (from TopPicks) --- */
  const [customAlert, setCustomAlert] = useState<CustomAlert>({ isOpen: false, message: "", isConfirm: false });
  const showAlert = (message: string, isConfirm = false, onConfirm?: () => Promise<void> | void, onCancel?: () => void) => {
    setCustomAlert({ isOpen: true, message, isConfirm, onConfirm, onCancel });
  };
  const closeAlert = () => setCustomAlert((s) => ({ ...s, isOpen: false }));

  /* --- Load stores --- */
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await apiService.getStores();
        if (!mounted) return;
        const mapped = (res as any[]).map((s) => ({
          uuid: s.uuid ?? s.storeUuid ?? s.storeId ?? s.id,
          storeName: s.storeName ?? s.name ?? s.store_name ?? s.name,
        }));
        setStores(mapped);
      } catch (err) {
        console.warn("failed to load stores", err);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  /* --- storeName -> uuid resolution --- */
  useEffect(() => {
    if (!storeName.trim()) {
      setSelectedStoreUuid(null);
      return;
    }
    const exact = stores.find((s) => s.storeName?.toLowerCase() === storeName.trim().toLowerCase());
    if (exact) {
      setSelectedStoreUuid(exact.uuid);
      return;
    }
    const prefix = stores.find((s) => s.storeName?.toLowerCase().startsWith(storeName.trim().toLowerCase()));
    if (prefix) {
      setSelectedStoreUuid(prefix.uuid);
      return;
    }
    setSelectedStoreUuid(null);
  }, [storeName, stores]);

  /* --- Fetch zones --- */
  const fetchZones = async () => {
    if (!selectedStoreUuid) {
      setError("Select a valid store first");
      showAlert("Select a valid store first");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await deliveryZoneService.getDeliveryZones(selectedStoreUuid);
      setZones(data || []);
    } catch (err) {
      console.error(err);
      showAlert("Failed to fetch zones.");
    } finally {
      setLoading(false);
    }
  };

  /* --- File upload (KML) --- */
  const handleFileUpload = async (file: File | null) => {
    setParsingError(null);
    setParsedPlacemarks([]);
    setEditingPlacemarkIndex(null);
    if (!file) return;
    const name = file.name || "";
    const ext = name.split(".").pop()?.toLowerCase();
    if (!ext || !["kml", "kmz"].includes(ext)) {
      setParsingError("Please upload a .kml or .kmz file.");
      setShowModal(true);
      return;
    }

    if (ext === "kmz") {
      setParsingError("KMZ upload detected. KMZ is not supported in-browser yet. Please extract KML or upload .kml.");
      setShowModal(true);
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseKmlToPlacemarks(text);
      if (!parsed.length) setParsingError("No placemarks found in KML");
      setParsedPlacemarks(parsed);
      setShowModal(true);
      setEditingPlacemarkIndex(null);
      setEditingZoneId(null);
    } catch (err) {
      console.error(err);
      setParsingError("Failed to parse KML file.");
      setShowModal(true);
    }
  };

  /* --- Review imported placemark --- */
  const reviewPlacemark = (pm: any, idx: number) => {
    const coords = pm.coordinates.length ? pm.coordinates : [[0, 0]];
    const createReq: CreateDeliveryZoneRequest = {
      zoneName: pm.parsedDescription?.zoneName ?? pm.name ?? "Imported Zone",
      baseDeliveryFee: Number(pm.parsedDescription?.baseDeliveryFee ?? 0),
      perMileFee: Number(pm.parsedDescription?.perMileFee ?? 0),
      minOrderAmount: Number(pm.parsedDescription?.minOrderAmount ?? 0),
      estimatedPreparationTime: Number(pm.parsedDescription?.estimatedPreparationTime ?? 0),
      restricted: Boolean(pm.parsedDescription?.isRestricted ?? false),
      coordinates: coords,
      storeUuid: selectedStoreUuid ?? "",
    };
    setForm(createReq);
    setEditingPlacemarkIndex(idx);
    setEditingZoneId(null);
  };

  /* --- Create/import a single placemark --- */
  const createFromPlacemark = async (pm: any, idx: number) => {
    if (!selectedStoreUuid) {
      showAlert("Please select a store first.");
      return;
    }
    const coords = pm.coordinates.length ? pm.coordinates : [[0, 0]];
    const payload: CreateDeliveryZoneRequest = {
      zoneName: pm.parsedDescription?.zoneName ?? pm.name ?? `Imported Zone ${idx + 1}`,
      baseDeliveryFee: Number(pm.parsedDescription?.baseDeliveryFee ?? 0),
      perMileFee: Number(pm.parsedDescription?.perMileFee ?? 0),
      minOrderAmount: Number(pm.parsedDescription?.minOrderAmount ?? 0),
      estimatedPreparationTime: Number(pm.parsedDescription?.estimatedPreparationTime ?? 0),
      restricted: Boolean(pm.parsedDescription?.isRestricted ?? false),
      coordinates: coords,
      storeUuid: selectedStoreUuid!,
    };

    try {
      setUploadingIndex(idx);
      await deliveryZoneService.createDeliveryZone(payload);
      await fetchZones();
      showAlert("Zone created successfully!");

      setParsedPlacemarks((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        if (next.length === 0) {
          setShowModal(false);
          setEditingPlacemarkIndex(null);
        }
        return next;
      });

      if (editingPlacemarkIndex === idx) {
        setEditingPlacemarkIndex(null);
        setForm({
          zoneName: "",
          baseDeliveryFee: 0,
          perMileFee: 0,
          minOrderAmount: 0,
          estimatedPreparationTime: 0,
          restricted: false,
          coordinates: [[0, 0]],
          storeUuid: "",
        });
      }
    } catch (err) {
      console.error(err);
      showAlert("Failed to create zone from placemark");
    } finally {
      setUploadingIndex(null);
    }
  };

  const createAllPlacemarks = async () => {
    if (!selectedStoreUuid) {
      showAlert("Please select a store first.");
      return;
    }
    try {
      for (let i = 0; i < parsedPlacemarks.length; i++) {
        await createFromPlacemark(parsedPlacemarks[i], i);
      }
    } catch (err) {
      console.error(err);
      showAlert("Some placemarks may not have been created.");
    } finally {
      setParsedPlacemarks([]);
      setEditingPlacemarkIndex(null);
      setShowModal(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.storeUuid && selectedStoreUuid) {
      form.storeUuid = selectedStoreUuid;
    }
    if (!form.storeUuid) {
      showAlert("Missing store UUID. Select a store first.");
      return;
    }
    setLoading(true);
    try {
      if (editingZoneId != null) {
        await deliveryZoneService.updateDeliveryZone(String(editingZoneId), form);
        showAlert("Zone updated successfully!");
      } else {
        await deliveryZoneService.createDeliveryZone(form);
        showAlert("Zone created successfully!");
      }

      setShowModal(false);
      setParsedPlacemarks([]);
      setEditingPlacemarkIndex(null);
      setEditingZoneId(null);
      await fetchZones();
    } catch (err) {
      console.error(err);
      showAlert(editingZoneId != null ? "Failed to update delivery zone" : "Failed to create delivery zone");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (zone: DeliveryZone) => {
    if (!zone.zoneId) return;
    // replace browser confirm with our AlertDialog confirm
    showAlert(`Delete zone "${zone.zoneName}"?`, true, async () => {
      setLoading(true);
      try {
        await deliveryZoneService.deleteDeliveryZone(zone.zoneId!.toString());
        showAlert("Zone deleted successfully!");
        await fetchZones();
      } catch (err) {
        console.error(err);
        showAlert("Failed to delete zone");
      } finally {
        setLoading(false);
      }
    });
  };

  const openEditForZone = (zone: DeliveryZone) => {
    setForm({
      zoneName: zone.zoneName,
      baseDeliveryFee: zone.baseDeliveryFee,
      perMileFee: zone.perMileFee,
      minOrderAmount: zone.minOrderAmount,
      estimatedPreparationTime: zone.estimatedPreparationTime ?? 0,
      restricted: zone.restricted,
      coordinates: zone.coordinates as [number, number][],
      storeUuid: zone.storeUuid,
    });
    setEditingZoneId(zone.zoneId ?? null);
    setEditingPlacemarkIndex(null);
    setParsedPlacemarks([]);
    setShowModal(true);
  };

  const storeSuggestions = storeName.trim()
    ? stores.filter((s) => s.storeName.toLowerCase().includes(storeName.trim().toLowerCase()))
    : stores.slice(0, 8);

  return (
    <div style={{ display: "flex", gap: 24, padding: 20, alignItems: "flex-start", fontFamily: "'Inter', system-ui, Arial" }}>
      <div style={{ flex: 1, minHeight: 520, borderRadius: 10, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.06)", padding: 12 }}>
        <MapPreviewGoogle zones={zones} height={520} />
      </div>

      {/* Right: Panel */}
      <aside style={{ width: 380 }}>
        <div style={{ background: "#fff", padding: 18, borderRadius: 10, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 20 }}>Delivery Zones</h3>
              <div style={{ fontSize: 13, color: "#666" }}>Create and manage delivery areas</div>
            </div>

            {/* Add + Upload */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onMouseEnter={() => setIsAddHover(true)}
                onMouseLeave={() => setIsAddHover(false)}
                onClick={() => {
                  setParsedPlacemarks([]);
                  setParsingError(null);
                  setEditingPlacemarkIndex(null);
                  setEditingZoneId(null);
                  setForm({
                    zoneName: "",
                    baseDeliveryFee: 0,
                    perMileFee: 0,
                    minOrderAmount: 0,
                    estimatedPreparationTime: 0,
                    restricted: false,
                    coordinates: [[0, 0]],
                    storeUuid: selectedStoreUuid ?? "",
                  });
                  setShowModal(true);
                }}
                style={{
                  background: isAddHover ? "#FF6600" : "#ffffff",
                  color: isAddHover ? "#ffffff" : "#000000",
                  border: "1px solid #e6eef7",
                  padding: "8px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                aria-label="Add Zone"
              >
                + Add Zone
              </button>

              <label style={{ display: "inline-flex", alignItems: "center", padding: "6px 8px", background: "#f3f6f9", borderRadius: 8, cursor: "pointer", border: "1px dashed #ddd" }}>
                <input
                  type="file"
                  accept=".kml"
                  onChange={(e) => handleFileUpload(e.target.files ? e.target.files[0] : null)}
                  style={{ display: "none" }}
                />
                Upload
              </label>
            </div>
          </div>

          {/* store input */}
          <div style={{ marginTop: 12 }}>
            <input
              type="text"
              placeholder="Type or pick Store"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e6eef7" }}
              aria-label="Store name"
            />
            {storeSuggestions.length > 0 && storeName.trim() !== "" && (
              <div style={{ marginTop: 6, background: "#fff", border: "1px solid #eee", borderRadius: 8, maxHeight: 160, overflowY: "auto" }}>
                {storeSuggestions.map((s, i) => (
                  <div
                    key={i}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      setStoreName(s.storeName);
                      setSelectedStoreUuid(s.uuid);
                    }}
                    style={{ padding: 10, cursor: "pointer", borderBottom: "1px solid #f6f6f6" }}
                  >
                    {s.storeName}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={fetchZones}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#e65c00")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#FF6600")}
                style={{ flex: 1, padding: 10, borderRadius: 8, background: "#FF6600", color: "#fff", border: "none" }}
              >
                Load Zones
              </button>
            </div>
          </div>

          {/* zones selector + card */}
          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: 15 }}>Available Zones</strong>
              <span style={{ fontSize: 13, color: "#999" }}>{zones.length}</span>
            </div>

            <div style={{ marginTop: 10 }}>
              <select
                onChange={(e) => {
                  const zid = e.target.value;
                  const z = zones.find((zz) => String(zz.zoneId) === zid);
                  if (z) {
                    setZones((prev) => [z, ...prev.filter((p) => p.zoneId !== z.zoneId)]);
                  }
                }}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #eee" }}
                defaultValue=""
              >
                <option value="" disabled>
                  Select zone...
                </option>
                {zones.map((z) => (
                  <option key={z.zoneId} value={z.zoneId}>
                    {z.zoneName}
                  </option>
                ))}
              </select>
            </div>

            {zones.length > 0 && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fff", border: "1px solid #f0f3f6" }}>
                {(() => {
                  const zone = zones[0];
                  const examples = (() => {
                    const distances = [1, 3, 5];
                    return distances.map((d) => {
                      const cost = Number(zone.baseDeliveryFee || 0) + Number(zone.perMileFee || 0) * d;
                      return { miles: d, cost: Number(cost.toFixed(2)) };
                    });
                  })();
                  return (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600 }}>{zone.zoneName}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>{zone.restricted ? "Restricted" : "Open"}</div>
                        </div>
                        <div>
                          <button
                            onClick={() => openEditForZone(zone)}
                            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #e6eef7", background: "#fff", cursor: "pointer" }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(zone)}
                            style={{ marginLeft: 8, padding: "6px 10px", borderRadius: 8, border: "none", background: "#ffdddd", cursor: "pointer" }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                        <div style={{ padding: 12, borderRadius: 8, background: "#f8fafb", textAlign: "center" }}>
                          <div style={{ fontSize: 13, color: "#777" }}>Base Fee</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>${zone.baseDeliveryFee.toFixed(2)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: "#f8fafb", textAlign: "center" }}>
                          <div style={{ fontSize: 13, color: "#777" }}>Per Mile</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>${zone.perMileFee.toFixed(2)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: "#f8fafb", textAlign: "center" }}>
                          <div style={{ fontSize: 13, color: "#777" }}>Min Order</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>${zone.minOrderAmount.toFixed(2)}</div>
                        </div>
                        <div style={{ padding: 12, borderRadius: 8, background: "#f8fafb", textAlign: "center" }}>
                          <div style={{ fontSize: 13, color: "#777" }}>Prep Time</div>
                          <div style={{ fontSize: 18, fontWeight: 700 }}>{zone.estimatedPreparationTime || "min"}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontWeight: 600 }}>Delivery Cost</div>
                        <ul style={{ marginTop: 8 }}>
                          {examples.map((ex) => (
                            <li key={ex.miles} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f6f9" }}>
                              <div>{ex.miles} mile delivery:</div>
                              <div style={{ fontWeight: 700 }}>${ex.cost.toFixed(2)}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {zones.length === 0 && !loading && <div style={{ marginTop: 10, color: "#777" }}>No zones yet. Upload a KML or create a new zone.</div>}
            {loading && <div style={{ marginTop: 12 }}>Loading...</div>}
            {error && <div style={{ marginTop: 12, color: "red" }}>{error}</div>}
          </div>

          {parsingError && <div style={{ marginTop: 12, color: "red" }}>{parsingError}</div>}
        </div>
      </aside>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(0,0,0,0.35)",
            zIndex: 60,
          }}
        >
          <div style={{ width: 680, maxHeight: "85vh", overflowY: "auto", background: "#fff", borderRadius: 10, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{editingPlacemarkIndex != null ? "Review Placemark" : parsedPlacemarks.length ? "Imported Placemarks" : editingZoneId != null ? "Edit Zone" : "Add Zone"}</h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingPlacemarkIndex(null);
                  setEditingZoneId(null);
                }}
                style={{ border: "none", background: "transparent", cursor: "pointer" }}
              >
                Close
              </button>
            </div>

            {/* Compact imported list */}
            {parsedPlacemarks.length > 0 && editingPlacemarkIndex == null && (
              <div style={{ marginTop: 12, position: "relative" }}>
                {/* card that holds the list; add bottom padding so absolute buttons don't overlap content */}
                <div
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: "#fff",
                    border: "1px solid #f3f6f9",
                    boxShadow: "0 4px 10px rgba(12,18,28,0.03)",
                    maxHeight: 420,
                    overflowY: "auto",
                    paddingBottom: 64, // leave space for bottom-right buttons
                  }}
                >
                  <div style={{ marginBottom: 12, color: "#222", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 15 }}>Imported Placemarks ({parsedPlacemarks.length})</strong>
                    {/* small helper text */}
                    <span style={{ fontSize: 12, color: "#888" }}>Review or import</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {parsedPlacemarks.map((pm, idx) => {
                      const pd = pm.parsedDescription || {};
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: 12,
                            borderRadius: 10,
                            background: "#fbfdff",
                            border: "1px solid #eef6fb",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: 12,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: "#0b2540" }}>{pd.zoneName ?? pm.name ?? `Placemark ${idx + 1}`}</div>

                            {/* CLEANED KEY/VALUE CHIPS */}
                            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {/* chip factory */}
                              {[
                                { k: "baseDeliveryFee", v: pd.baseDeliveryFee },
                                { k: "perMileFee", v: pd.perMileFee },
                                { k: "minOrderAmount", v: pd.minOrderAmount },
                                { k: "isRestricted", v: pd.isRestricted ?? false },
                              ].map((item) => (
                                <div
                                  key={item.k}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 6,
                                    padding: "6px 10px",
                                    background: "#ffffff",
                                    border: "1px solid #eef3f7",
                                    borderRadius: 999,
                                    boxShadow: "0 1px 0 rgba(16,24,40,0.02)",
                                    fontSize: 13,
                                    color: "#334155",
                                    minHeight: 30,
                                  }}
                                >
                                  <strong style={{ fontWeight: 600, fontSize: 12, color: "#0b2540" }}>{labelForKey(item.k)}:</strong>
                                  <span style={{ fontWeight: 600 }}>{formatValueForKey(item.k, item.v ?? "-")}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* action buttons for each placemark */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <button
                              onClick={() => reviewPlacemark(pm, idx)}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                background: "#eef6ff",
                                border: "1px solid #e6f0ff",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                            >
                              Review
                            </button>

                            <button
                              onClick={() => createFromPlacemark(pm, idx)}
                              disabled={uploadingIndex === idx}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 8,
                                background: "#e6ffef",
                                border: "1px solid #dff5e8",
                                cursor: uploadingIndex === idx ? "not-allowed" : "pointer",
                                fontWeight: 600,
                              }}
                            >
                              {uploadingIndex === idx ? "Creating..." : "Create"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div
                  style={{
                    position: "absolute",
                    right: 8,
                    bottom: 4,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setParsedPlacemarks([])}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "#fff",
                      border: "1px solid #e6eef7",
                      cursor: "pointer",
                    }}
                  >
                    Clear
                  </button>

                  <button
                    onClick={createAllPlacemarks}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "#FF6600",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      boxShadow: "0 6px 18px rgba(255,102,0,0.14)",
                    }}
                  >
                    Create All
                  </button>
                </div>
              </div>
            )}

            {(editingPlacemarkIndex != null || parsedPlacemarks.length === 0 || editingZoneId != null) && (
              <>
                {editingPlacemarkIndex != null && parsedPlacemarks[editingPlacemarkIndex] && (
                  <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "#fbfbff", border: "1px solid #eef2ff" }}>
                    <div style={{ fontWeight: 700 }}>{parsedPlacemarks[editingPlacemarkIndex].parsedDescription?.zoneName ?? parsedPlacemarks[editingPlacemarkIndex].name}</div>
                    <div style={{ fontSize: 13, color: "#666" }}>{(parsedPlacemarks[editingPlacemarkIndex].parsedDescription?.notes ?? parsedPlacemarks[editingPlacemarkIndex].rawDescription)?.toString().slice(0, 180)}</div>
                  </div>
                )}

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column" }}>
                    Zone name
                    <input value={form.zoneName} onChange={(e) => setForm({ ...form, zoneName: e.target.value })} style={{ padding: 10, borderRadius: 6, border: "1px solid #eee" }} />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column" }}>
                    Base fee
                    <input type="number" value={form.baseDeliveryFee} onChange={(e) => setForm({ ...form, baseDeliveryFee: Number(e.target.value) })} style={{ padding: 10, borderRadius: 6, border: "1px solid #eee" }} />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column" }}>
                    Per mile
                    <input type="number" value={form.perMileFee} onChange={(e) => setForm({ ...form, perMileFee: Number(e.target.value) })} style={{ padding: 10, borderRadius: 6, border: "1px solid #eee" }} />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column" }}>
                    Min order
                    <input type="number" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })} style={{ padding: 10, borderRadius: 6, border: "1px solid #eee" }} />
                  </label>

                  <label style={{ display: "flex", flexDirection: "column" }}>
                    Estimated prep time (mins)
                    <input type="number" value={form.estimatedPreparationTime} onChange={(e) => setForm({ ...form, estimatedPreparationTime: Number(e.target.value) })} style={{ padding: 10, borderRadius: 6, border: "1px solid #eee" }} />
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={form.restricted} onChange={(e) => setForm({ ...form, restricted: e.target.checked })} />
                    <span>Restricted</span>
                  </label>

                  <label style={{ display: "flex", flexDirection: "column" }}>
                    Store UUID (auto)
                    <input value={form.storeUuid || selectedStoreUuid || ""} readOnly style={{ padding: 10, borderRadius: 6, border: "1px solid #eee", background: "#fafafa" }} />
                  </label>
                </div>

                {/* coordinates */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 600 }}>Coordinates</div>
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                    {form.coordinates.map((coord, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          type="number"
                          value={coord[0]}
                          onChange={(e) => {
                            const copy = [...form.coordinates];
                            copy[idx] = [Number(e.target.value), copy[idx][1]];
                            setForm({ ...form, coordinates: copy });
                          }}
                          style={{ padding: 8, width: 140, borderRadius: 6, border: "1px solid #eee" }}
                        />
                        <input
                          type="number"
                          value={coord[1]}
                          onChange={(e) => {
                            const copy = [...form.coordinates];
                            copy[idx] = [copy[idx][0], Number(e.target.value)];
                            setForm({ ...form, coordinates: copy });
                          }}
                          style={{ padding: 8, width: 140, borderRadius: 6, border: "1px solid #eee" }}
                        />
                        <button
                          onClick={() => {
                            setForm({ ...form, coordinates: form.coordinates.filter((_, i) => i !== idx) });
                          }}
                          style={{ padding: 8, borderRadius: 6, background: "#ffefef", border: "none", cursor: "pointer" }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <button onClick={() => setForm({ ...form, coordinates: [...form.coordinates, [0, 0]] })} style={{ padding: 10, borderRadius: 8, background: "#eef6ff", border: "none", cursor: "pointer" }}>
                      Add coordinate
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  {editingPlacemarkIndex != null && (
                    <button
                      onClick={() => {
                        setEditingPlacemarkIndex(null); /* keep parsed list */
                      }}
                      style={{ padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid #eee" }}
                    >
                      Back
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingPlacemarkIndex(null);
                      setEditingZoneId(null);
                    }}
                    style={{ padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid #eee" }}
                  >
                    Cancel
                  </button>
                  <button onClick={handleSubmit} style={{ padding: "8px 12px", borderRadius: 8, background: "#FF6600", color: "#fff", border: "none" }}>
                    {editingZoneId != null ? "Update" : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <AlertDialog alert={customAlert} onClose={closeAlert} />
    </div>
  );
}
