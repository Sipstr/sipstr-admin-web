"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import type { AdminSession } from "../app"

import { Sidebar } from "./Sidebar" // Assuming Sidebar is a named export for structure
import{ UsersModule } from "./UsersModule"
import{ OrdersModule }from "./OrdersModule"
import ProductsModule from "./ProductsModule"
import{ BCPModule }from "./BrandsModule"
import{ CouponsModule }from "./CouponModule"
import{ StoresModule }from "./StoresModule"
import{ RolesModule }from "./RolesModule"
import{ TopPicksModule }from "./TopPicksModule"
import{ ReportsModule }from "./ReportsModule"
import DeliveryZonesPage from "./Delivery"
import { SubstituteModule } from "./SubstituteModule"
import { ReasonsModule } from "./ReasonsModule"
import { AuditLogsModule } from "./AuditLogsModule"

interface DashboardLayoutProps {
  session: AdminSession
  onLogout: () => void
}

type ModuleType =
  | "dashboard"
  | "users"
  |  "substitute"
  | "orders"
  | "products"
  | "brands"
  | "coupon"
  | "stores"
  | "roles"
  | "top-picks"
  | "reports"
  |  "zones"
  | "reasons"
  | "audit-logs";

export function DashboardLayout({ session, onLogout }: DashboardLayoutProps) {
  const [activeModule, setActiveModule] = useState<ModuleType>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const renderModule = () => {
    switch (activeModule) {
      case "users":        return <UsersModule />
      case "reasons":      return <ReasonsModule />
      case "substitute":   return <SubstituteModule />
      case "orders":       return <OrdersModule />
      case "zones":        return <DeliveryZonesPage />
      case "products":     return <ProductsModule />
      case "brands":       return <BCPModule />
      case "coupon":       return <CouponsModule />
      case "stores":       return <StoresModule />
      case "roles":        return <RolesModule />
      case "top-picks":    return <TopPicksModule />
      case "reports":      return <ReportsModule />
      case "audit-logs":   return <AuditLogsModule />
      default:             return <DashboardHome />
    }
  }

  const pageTitle =
    activeModule === "dashboard"
      ? "Dashboard"
      : activeModule.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={(m) => setActiveModule(m as ModuleType)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        session={session}
        onLogout={onLogout}
      />

      {/* Main content — offset by sidebar width when open */}
      <div
        className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-0"
        }`}
      >
        {/* Top header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
                title="Open sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            <h1 className="text-xl font-semibold text-gray-800 capitalize">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-semibold">
              {session.email.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-gray-600 hidden sm:block">{session.email}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {renderModule()}
        </main>
      </div>
    </div>
  )
}

function DashboardHome() {
  const stats = [
    { title: "Total Users",    value: "1,234" },
    { title: "Total Orders",   value: "5,678" },
    { title: "Total Products", value: "342"   },
    { title: "Total Stores",   value: "28"    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 border-l-4 border-l-orange-500"
        >
          <p className="text-sm text-gray-500 mb-2">{stat.title}</p>
          <p className="text-3xl font-bold text-gray-800">{stat.value}</p>
        </div>
      ))}
    </div>
  )
}
