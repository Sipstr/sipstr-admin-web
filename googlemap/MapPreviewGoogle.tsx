"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { DeliveryZone } from "../services/types";
import { useJsApiLoader, GoogleMap, Polygon as GPolygon, Marker as GMarker, InfoWindow } from "@react-google-maps/api";

type MapPreviewGoogleProps = {
  zones?: DeliveryZone[];
  center?: [number, number];
  zoom?: number;
  height?: number | string;
};

export default function MapPreviewGoogle({
  zones = [],
  center,
  zoom = 12,
  height = 520,
}: MapPreviewGoogleProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!apiKey) {
    return (
      <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", padding: 12, textAlign: "center" }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Google Maps API key missing</div>
          <div style={{ color: "#555", fontSize: 13 }}>
            Configuration expected.
          </div>
        </div>
      </div>
    );
  }

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: ["geometry", "places"],
  });

  // derive a fallback center from the first zone first coordinate (if available)
  const fallbackCenter: [number, number] =
    center ??
    (zones?.[0]?.coordinates?.[0]?.[0]
      ? ([
          (zones[0].coordinates[0] as any)[0] as number,
          (zones[0].coordinates[0] as any)[1] as number,
        ] as [number, number])
      : [0, 0]);

  // normalize from [[lat,lng], ...] to { lat, lng } objects for maps API
  const normalizeCoords = (coords: any): any[] => {
    try {
      if (Array.isArray(coords) && coords.length && Array.isArray(coords[0]) && typeof coords[0][0] === "number") {
        return coords.map((c: any) => ({ lat: Number(c[0]), lng: Number(c[1]) }));
      }
      return [];
    } catch {
      return [];
    }
  };

  const mapCenter = useMemo(() => ({ lat: fallbackCenter[0], lng: fallbackCenter[1] }), [fallbackCenter]);

  const [openInfo, setOpenInfo] = useState<{ zoneIdx: number } | null>(null);
  const [mapInstance, setMapInstance] = useState<any | null>(null); // loose typing so TS doesn't require @types/google.maps

  // When the map loads, store instance
  const handleMapLoad = (map: any) => {
    setMapInstance(map);
  };

  // If zones change and we have a map, fit to the first zone polygon bounds (if present)
  useEffect(() => {
    if (!mapInstance) return;
    if (!zones || zones.length === 0) return;

    // find first zone with polygon coords
    for (const z of zones) {
      const poly = normalizeCoords(z.coordinates as any);
      if (poly.length > 0) {
        const bounds = new (window as any).google.maps.LatLngBounds();
        poly.forEach((p: any) => bounds.extend(p));
        try {
          mapInstance.fitBounds(bounds);
          // maintain a max zoom so map doesn't zoom too close on tiny polygons
          const listener = (window as any).google.maps.event.addListenerOnce(mapInstance, "idle", () => {
            const currentZoom = mapInstance.getZoom?.();
            const MAX_ALLOWED = 16;
            if (currentZoom && currentZoom > MAX_ALLOWED) mapInstance.setZoom(MAX_ALLOWED);
            (window as any).google.maps.event.removeListener(listener);
          });
        } catch (e) {
          // ignore fitBounds errors
        }
        break;
      }
    }
  }, [zones, mapInstance]);

  if (loadError) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>Failed to load Google Maps.</div>;
  }

  if (!isLoaded) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>Loading map…</div>;
  }

  return (
    <div style={{ width: "100%", height }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%", borderRadius: 8 }}
        center={mapCenter}
        zoom={zoom}
        onLoad={handleMapLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {zones.map((z, i) => {
          const poly = normalizeCoords(z.coordinates as any);
          return (
            <React.Fragment key={i}>
              {poly.length > 0 && (
                <GPolygon
                  paths={poly}
                  options={{
                    fillColor: z.restricted ? "#e86b4a" : "#25a18e",
                    fillOpacity: 0.12,
                    strokeColor: z.restricted ? "#e86b4a" : "#25a18e",
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                  }}
                />
              )}

              {poly.length > 0 && <GMarker position={poly[0]} onClick={() => setOpenInfo({ zoneIdx: i })} />}

              {openInfo?.zoneIdx === i && poly.length > 0 && (
                <InfoWindow position={poly[0]} onCloseClick={() => setOpenInfo(null)}>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700 }}>{z.zoneName}</div>
                    <div style={{ fontSize: 13, color: "#444" }}>{z.restricted ? "Restricted" : "Open"}</div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      Base: ${z.baseDeliveryFee?.toFixed?.(2) ?? z.baseDeliveryFee} • Per mile: ${z.perMileFee?.toFixed?.(2) ?? z.perMileFee} 
                      
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13 }}>
                      Min Order: ${z.minOrderAmount?.toFixed?.(2) ?? z.minOrderAmount}
                      
                    </div>
                  </div>
                </InfoWindow>
              )}
            </React.Fragment>
          );
        })}
      </GoogleMap>
    </div>
  );
}

/*
Notes / next steps:
- If you want strict TypeScript types, install: npm i -D @types/google.maps and change loose 'any' usages to google.maps types.
- To use this, set NEXT_PUBLIC_GOOGLE_MAPS_KEY in your .env.local and restart the dev server.
- If you'd like map selection sync (click zone in list -> highlight polygon), I can add a `selectedZoneId` prop and style the polygon differently when selected.
*/
