"use client"

import { useMemo } from "react"
import {
  LayoutDashboard,
  Users,
  Shield,
  Tag,
  ShoppingCart,
  Store,
  ClipboardList,
  Ticket,
  Star,
  Map,
  BarChart3,
  ArrowLeftRight,
  MessageSquare,
  ScrollText,
  LogOut,
  Menu,
  ChevronLeft,
} from "lucide-react"
import type { AdminSession } from "../app"

interface SidebarProps {
  activeModule: string
  onModuleChange: (module: string) => void
  isOpen: boolean
  onToggle: () => void
  session: AdminSession
  onLogout: () => void
}

const ALL_MODULES = [
  { id: "dashboard",  label: "Dashboard",                   icon: LayoutDashboard, flagKey: "dashboard" },
  { id: "users",      label: "Users",                       icon: Users,           flagKey: "users" },
  { id: "roles",      label: "Roles",                       icon: Shield,          flagKey: "roles" },
  { id: "brands",     label: "Brands, Categories, Packages", icon: Tag,            flagKey: "brands" },
  { id: "products",   label: "Products",                    icon: ShoppingCart,    flagKey: "products" },
  { id: "stores",     label: "Stores",                      icon: Store,           flagKey: "stores" },
  { id: "orders",     label: "Orders",                      icon: ClipboardList,   flagKey: "orders" },
  { id: "coupon",     label: "Coupon & Voucher",            icon: Ticket,          flagKey: "coupon" },
  { id: "top-picks",  label: "Top Picks",                   icon: Star,            flagKey: "topPicks" },
  { id: "zones",      label: "Zones",                       icon: Map,             flagKey: "zones" },
  { id: "reports",    label: "Reports",                     icon: BarChart3,       flagKey: "reports" },
  { id: "substitute", label: "Substitute",                  icon: ArrowLeftRight,  flagKey: "substitute" },
  { id: "reasons",    label: "Reasons",                     icon: MessageSquare,   flagKey: "reasons" },
  { id: "audit-logs", label: "Audit Logs",                  icon: ScrollText,      flagKey: "audit" },
]

const FEATURE_FLAGS = {
  dashboard:  process.env.NEXT_PUBLIC_FEATURE_DASHBOARD  === "true",
  users:      process.env.NEXT_PUBLIC_FEATURE_USERS      === "true",
  roles:      process.env.NEXT_PUBLIC_FEATURE_ROLES      === "true",
  brands:     process.env.NEXT_PUBLIC_FEATURE_BRANDS     === "true",
  products:   process.env.NEXT_PUBLIC_FEATURE_PRODUCTS   === "true",
  stores:     process.env.NEXT_PUBLIC_FEATURE_STORES     === "true",
  orders:     process.env.NEXT_PUBLIC_FEATURE_ORDERS     === "true",
  coupon:     process.env.NEXT_PUBLIC_FEATURE_COUPON     === "true",
  topPicks:   process.env.NEXT_PUBLIC_FEATURE_TOP_PICKS  === "true",
  zones:      process.env.NEXT_PUBLIC_FEATURE_ZONES      === "true",
  reports:    process.env.NEXT_PUBLIC_FEATURE_REPORTS    === "true",
  substitute: process.env.NEXT_PUBLIC_FEATURE_SUBSTITUTE === "true",
  reasons:    process.env.NEXT_PUBLIC_FEATURE_REASONS    === "true",
  audit:      process.env.NEXT_PUBLIC_FEATURE_AUDIT      === "true",
}

export function Sidebar({ activeModule, onModuleChange, isOpen, onToggle, session, onLogout }: SidebarProps) {
  const modules = useMemo(
    () => ALL_MODULES.filter((m) => !!FEATURE_FLAGS[m.flagKey as keyof typeof FEATURE_FLAGS]),
    []
  )

  return (
    <>
      {/* Sidebar panel */}
      <aside
        className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 shadow-sm flex flex-col transition-all duration-300 z-40 overflow-hidden ${
          isOpen ? "w-64" : "w-0"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 min-h-[64px]">
          <img src="/Sipstr.PNG" alt="Sipstr" className="h-10 w-auto object-contain" />
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-gray-500"
            title="Collapse sidebar"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {modules.map((module) => {
            const Icon = module.icon
            const isActive = activeModule === module.id
            return (
              <button
                key={module.id}
                onClick={() => onModuleChange(module.id)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-orange-100 text-orange-600"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon size={18} className={isActive ? "text-orange-600" : "text-gray-400"} />
                <span className="truncate">{module.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          <div className="px-1">
            <p className="text-xs font-semibold text-gray-900 truncate">{session.email}</p>
            <p className="text-xs text-gray-500 capitalize">{session.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>


    </>
  )
}

