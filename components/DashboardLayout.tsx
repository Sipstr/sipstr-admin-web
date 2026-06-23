"use client"

import { useEffect, useMemo, useState } from "react"
import { Menu } from "lucide-react"
import type { AdminSession } from "../app"
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { apiService } from "@/services/apiService"

import { Sidebar } from "./Sidebar"
import { OrdersModule } from "./OrdersModule"
import { StoresModule } from "./StoresModule"
import { CatalogModule } from "./CatalogModule"
import { CouponsModule } from "./CouponModule"
import { UsersModule } from "./UsersModule"
import { ReportsModule } from "./ReportsModule"
import { AuditLogsModule } from "./AuditLogsModule"
import { InventoryApprovalsModule } from "./InventoryApprovalsModule"

interface DashboardLayoutProps {
  session: AdminSession
  onLogout: () => void
}

type ModuleType = "dashboard" | "orders" | "catalog" | "stores" | "offers" | "users" | "reports" | "audit-logs" | "inventory-approvals";

export function DashboardLayout({ session, onLogout }: DashboardLayoutProps) {
  const [activeModule, setActiveModule] = useState<ModuleType>("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => {
    const onNavigate = (e: Event) => {
      const custom = e as CustomEvent<{ module?: string }>
      const mod = custom.detail?.module
      if (!mod) return
      if (["dashboard", "orders", "catalog", "stores", "offers", "users", "reports", "audit-logs", "inventory-approvals"].includes(mod)) {
        setActiveModule(mod as ModuleType)
      }
    }

    window.addEventListener("admin:navigate", onNavigate)
    return () => window.removeEventListener("admin:navigate", onNavigate)
  }, [])

  const renderModule = () => {
    switch (activeModule) {
      case "orders":
        return <OrdersModule />
      case "catalog":
        return <CatalogModule />
      case "stores":
        return <StoresModule />
      case "offers":
        return <CouponsModule />
      case "users":
        return <UsersModule />
      case "reports":
        return <ReportsModule />
      case "audit-logs":
        return <AuditLogsModule />
      case "inventory-approvals":
        return <InventoryApprovalsModule />
      default:
        return <DashboardHome />
    }
  }

  const pageTitle =
    activeModule === "dashboard"
      ? "Dashboard"
      : activeModule.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      <Sidebar
        activeModule={activeModule}
        onModuleChange={(m) => setActiveModule(m as ModuleType)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        session={session}
        onLogout={onLogout}
      />

      <div
        className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-20"
        }`}
      >
        <header className="fixed top-0 right-0 left-0 z-30 bg-white border-b border-gray-200 shadow-sm transition-all duration-300" style={{ marginLeft: sidebarOpen ? "16rem" : "5rem" }}>
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
            <h1 className="text-xl font-semibold text-gray-800 capitalize px-6 py-4">{pageTitle}</h1>
          </div>
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-semibold">{session.email.charAt(0).toUpperCase()}</div>
            <span className="text-sm text-gray-600 hidden sm:block">{session.email}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16">
          <div className="min-h-full p-4 sm:p-6 pb-24">
            {renderModule()}
          </div>
        </main>
      </div>
    </div>
  )
}

function DashboardHome() {
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [storeCount, setStoreCount] = useState(0)
  const [customerCount, setCustomerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadMetrics = async () => {
      setLoading(true)
      try {
        const [orders, stores, users] = await Promise.all([
          apiService.getRecentOrders(120),
          apiService.getStores(),
          apiService.getUsers(0, 100),
        ])

        setRecentOrders(Array.isArray(orders) ? orders : [])
        setStoreCount(Array.isArray(stores) ? stores.length : 0)
        setCustomerCount(Array.isArray(users) ? users.filter((u: any) => u.roleName === "CUSTOMER").length : 0)
      } catch (err) {
        console.error("Dashboard metrics load failed", err)
      } finally {
        setLoading(false)
      }
    }

    loadMetrics()
  }, [])

  const statusData = useMemo(() => {
    const tally = recentOrders.reduce((acc: Record<string, number>, order: any) => {
      const key = String(order?.orderStatus ?? "UNKNOWN")
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    return Object.entries(tally)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [recentOrders])

  const trendData = useMemo(() => {
    const buckets = recentOrders.reduce((acc: Record<string, number>, order: any) => {
      const raw = order?.updatedAt ?? order?.deliveryTime
      if (!raw) return acc
      const dt = new Date(raw)
      if (Number.isNaN(dt.getTime())) return acc
      const key = `${dt.getMonth() + 1}/${dt.getDate()}`
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})

    return Object.entries(buckets)
      .map(([day, orders]) => ({ day, orders }))
      .slice(-10)
  }, [recentOrders])

  const kpis = [
    { title: "Total Orders", value: recentOrders.length, sub: "Recent order feed" },
    { title: "Total Customers", value: customerCount, sub: "From user directory" },
    { title: "Total Vendors (Stores)", value: storeCount, sub: "Registered active stores" },
    {
      title: "Preparation Queue",
      value: recentOrders.filter((o) => ["CREATED", "ACCEPTED_BY_STORE", "PARTIALLY_ACCEPTED_BY_STORE"].includes(String(o.orderStatus))).length,
      sub: "Needs picking/substitution checks",
    },
  ]

  const pieColors = ["#f97316", "#14b8a6", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"]

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 leading-tight">Admin Overview</h2>
        <p className="text-sm text-gray-600 mt-1 font-medium">Key platform metrics aligned with the vendor panel style.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {kpis.map((stat) => (
        <div
          key={stat.title}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
        >
          <p className="text-sm text-gray-500 mb-2">{stat.title}</p>
          <p className="text-3xl font-bold text-gray-800">{loading ? "--" : stat.value}</p>
          <p className="text-xs text-gray-500 mt-2">{stat.sub}</p>
        </div>
      ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <div className="xl:col-span-3 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Orders Trend</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#f97316" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Order Status Split</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {statusData.map((entry, index) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Top Order Status Buckets</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#fb923c" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
