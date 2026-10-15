import React from 'react'
import { Outlet } from 'react-router-dom'

export const PageLayout: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <Outlet />
    </div>
  )
}
