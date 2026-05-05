"use client"
import type { AdminSession } from "../app"
import { useMemo } from "react"

interface SidebarProps {
  activeModule: string
  onModuleChange: (module: any) => void
  isOpen: boolean
  onToggle: () => void
  session: AdminSession
  onLogout: () => void
}

/** Use simple flagKey names (not the raw env var names) */
const ALL_MODULES = [
  { id: "dashboard", label: "Dashboard", icon: "📊", flagKey: "dashboard" },
  { id: "users", label: "Users", icon: "🧑‍🤝‍🧑", flagKey: "users" },
  { id: "roles", label: "Roles", icon: "🛡️", flagKey: "roles" },
  { id: "brands", label: "Brands, Categories, Packages", icon: "🏷️", flagKey: "brands" },
  { id: "products", label: "Products", icon: "🛒", flagKey: "products" },
  { id: "stores", label: "Stores", icon: "🏬", flagKey: "stores" },
  { id: "orders", label: "Orders", icon: "🧾", flagKey: "orders" },
  { id: "coupon", label: "Coupon & Voucher", icon: "🎟️", flagKey: "coupon" },
  { id: "top-picks", label: "Top Picks", icon: "🌟", flagKey: "topPicks" },
  { id: "zones", label: "Zones", icon: "🗺️", flagKey: "zones" },
  { id: "reports", label: "Reports", icon: "📈", flagKey: "reports" },
  { id: "substitute", label: "Substitute", icon: "📈", flagKey: "substitute" },
  { id: "reasons", label: "Reasons", icon: "📈", flagKey: "reasons" },
  { id: "audit-logs", label: "Audit Logs", icon: "📝", flagKey: "audit" },
]

/**
 * Build a static map from known env vars.
 * IMPORTANT: use direct property access so Next.js can inline these at build time.
 */
const FEATURE_FLAGS = {
  dashboard: process.env.NEXT_PUBLIC_FEATURE_DASHBOARD === "true",
  users: process.env.NEXT_PUBLIC_FEATURE_USERS === "true",
  roles: process.env.NEXT_PUBLIC_FEATURE_ROLES === "true",
  brands: process.env.NEXT_PUBLIC_FEATURE_BRANDS === "true",
  products: process.env.NEXT_PUBLIC_FEATURE_PRODUCTS === "true",
  stores: process.env.NEXT_PUBLIC_FEATURE_STORES === "true",
  orders: process.env.NEXT_PUBLIC_FEATURE_ORDERS === "true",
  coupon: process.env.NEXT_PUBLIC_FEATURE_COUPON === "true",
  topPicks: process.env.NEXT_PUBLIC_FEATURE_TOP_PICKS === "true",
  zones: process.env.NEXT_PUBLIC_FEATURE_ZONES === "true",
  reports: process.env.NEXT_PUBLIC_FEATURE_REPORTS === "true",
  substitute: process.env.NEXT_PUBLIC_FEATURE_SUBSTITUTE === "true",
  reasons: process.env.NEXT_PUBLIC_FEATURE_REASONS === "true",
  audit: process.env.NEXT_PUBLIC_FEATURE_AUDIT === "true",
}

export function Sidebar({ activeModule, onModuleChange, isOpen, onToggle, session, onLogout }: SidebarProps) {
  // filter only enabled modules — FEATURE_FLAGS is static so this works reliably
  const modules = useMemo(
    () => ALL_MODULES.filter((m) => (m.flagKey ? !!FEATURE_FLAGS[m.flagKey as keyof typeof FEATURE_FLAGS] : true)),
    []
  )

  // optional: uncomment to debug single flag — this will show the inlined value
  // console.log("FEATURE_FLAGS.orders:", FEATURE_FLAGS.orders, "raw env:", process.env.NEXT_PUBLIC_FEATURE_ORDERS)

  return (
    <>
      <aside
        style={{
          width: isOpen ? "250px" : "0",
          backgroundColor: "#333",
          color: "white",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.3s ease",
          overflow: "hidden",
          borderRight: "1px solid #222",
          position: "relative",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderBottom: "1px solid #444",
            minHeight: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <img src="/Sipstr.PNG" alt="Sipstr" style={{ height: "32px", width: "auto", objectFit: "contain" }} />

          {isOpen && (
            <button
              onClick={onToggle}
              style={{ backgroundColor: "transparent", border: "none", color: "white", fontSize: "20px", cursor: "pointer" }}
            >
              ✕
            </button>
          )}
        </div>

        <nav style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {modules.map((module) => (
            <button
              key={module.id}
              onClick={() => onModuleChange(module.id)}
              style={{
                width: "100%",
                padding: "12px 20px",
                backgroundColor: activeModule === module.id ? "#FF6600" : "transparent",
                color: "white",
                border: "none",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                transition: "background-color 0.2s",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
              onMouseEnter={(e) => {
                if (activeModule !== module.id) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#444"
              }}
              onMouseLeave={(e) => {
                if (activeModule !== module.id) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"
              }}
            >
              <span>{module.icon}</span>
              <span>{module.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid #444", padding: "12px 20px" }}>
          <button
            onClick={onLogout}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#FF6600",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      {!isOpen && (
        <button
          onClick={onToggle}
          style={{
            position: "fixed",
            top: "16px",
            left: "16px",
            zIndex: 1000,
            backgroundColor: "#FF6600",
            color: "white",
            border: "none",
            width: "40px",
            height: "40px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "20px",
          }}
        >
          ☰
        </button>
      )}
    </>
  )
}
