"use client"

import { useEffect, useState } from "react"
import App from "../app"

export default function Page() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="mx-auto mb-4 h-9 w-9 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-gray-900">Loading Admin Portal</h1>
          <p className="text-sm text-gray-500 mt-1">Preparing your workspace...</p>
        </div>
      </div>
    )
  }

  return <App />
}
