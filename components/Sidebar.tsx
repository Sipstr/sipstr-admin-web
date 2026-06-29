"use client"

import { useMemo } from "react"
import {
  LayoutDashboard,
  BookOpen,
  Store,
  ClipboardList,
  Tag,
  Users,
  FileText,
  ScrollText,
  PackageCheck,
  LogOut,
  Menu,
} from "lucide-react"
import Image from "next/image"
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
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, flagKey: "dashboard" },
  { id: "orders", label: "Orders", icon: ClipboardList, flagKey: "orders" },
  { id: "catalog", label: "Catalog", icon: BookOpen, flagKey: "catalog" },
  { id: "stores", label: "Stores", icon: Store, flagKey: "stores" },
  { id: "offers", label: "Offers", icon: Tag, flagKey: "offers" },
  { id: "users", label: "Users", icon: Users, flagKey: "users" },
  { id: "reports", label: "Reports", icon: FileText, flagKey: "reports" },
  { id: "audit-logs", label: "Audit Logs", icon: ScrollText, flagKey: "audit" },
  { id: "inventory-approvals", label: "Inventory Approvals", icon: PackageCheck, flagKey: "inventoryApprovals" },
]

const FEATURE_FLAGS = {
  dashboard: process.env.NEXT_PUBLIC_FEATURE_DASHBOARD !== "false",
  catalog:
    process.env.NEXT_PUBLIC_FEATURE_PRODUCTS === "true" ||
    process.env.NEXT_PUBLIC_FEATURE_BRANDS === "true" ||
    process.env.NEXT_PUBLIC_FEATURE_PRODUCTS === undefined,
  stores: process.env.NEXT_PUBLIC_FEATURE_STORES !== "false",
  orders: process.env.NEXT_PUBLIC_FEATURE_ORDERS !== "false",
  offers: process.env.NEXT_PUBLIC_FEATURE_OFFERS !== "false" || process.env.NEXT_PUBLIC_FEATURE_COUPON === "true",
  users: process.env.NEXT_PUBLIC_FEATURE_USERS !== "false",
  reports: process.env.NEXT_PUBLIC_FEATURE_REPORTS !== "false",
  audit: process.env.NEXT_PUBLIC_FEATURE_AUDIT !== "false",
  inventoryApprovals: process.env.NEXT_PUBLIC_FEATURE_INVENTORY_APPROVALS !== "false",
}

export function Sidebar({ activeModule, onModuleChange, isOpen, onToggle, session, onLogout }: SidebarProps) {
  const modules = useMemo(
    () => ALL_MODULES.filter((m) => !!FEATURE_FLAGS[m.flagKey as keyof typeof FEATURE_FLAGS]),
    []
  )

  const initials = (session.email?.[0] || "A").toUpperCase()

  return (
    <>
      <aside
        className={`fixed left-0 top-0 h-full bg-white border-r border-gray-200 shadow-sm flex flex-col transition-all duration-300 z-40 overflow-hidden ${
          isOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 min-h-[64px]">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-gray-500"
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <Menu size={20} />
          </button>
          {isOpen && <Image src="/Sipstr.PNG" alt="Sipstr" width={120} height={40} className="h-10 w-auto object-contain" priority />}
        </div>

        {isOpen ? (
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-orange-100/50">
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Current Admin</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">{initials}</div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{session.email}</p>
                <p className="text-[11px] text-gray-500 capitalize">{session.role}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-orange-100/50 flex justify-center">
            <Image src="/Sipstr.PNG" alt="Sipstr" width={32} height={32} className="h-8 w-8 object-contain" />
          </div>
        )}

        <nav className={`flex-1 overflow-y-auto ${isOpen ? "p-3" : "p-2"} space-y-1`}>
          {modules.map((module) => {
            const Icon = module.icon
            const isActive = activeModule === module.id
            return (
              <button
                key={module.id}
                onClick={() => onModuleChange(module.id)}
                title={module.label}
                className={`group flex items-center ${isOpen ? "gap-3 px-3" : "justify-center px-2"} w-full py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-orange-100 text-orange-600"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon size={20} className={isActive ? "text-orange-600" : "text-gray-400 group-hover:text-gray-600"} />
                {isOpen && <span className="truncate">{module.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className={`border-t border-gray-100 ${isOpen ? "p-4" : "p-2"}`}>
          <button
            onClick={onLogout}
            title="Logout"
            className={`flex items-center ${isOpen ? "gap-2 px-3" : "justify-center px-2"} w-full py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors duration-200`}
          >
            <LogOut size={18} />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
