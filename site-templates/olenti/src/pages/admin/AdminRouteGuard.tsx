import { ADMIN_ROUTES } from '@constants/adminRoutes'
import { useAdminStore } from '@store/slices/adminSlice'
import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'

export function AdminRouteGuard() {
  const { isAuthenticated, sessionChecked, ensureSession } = useAdminStore()

  useEffect(() => {
    ensureSession().catch(() => undefined)
  }, [ensureSession])

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-10 py-8 text-center shadow-lg shadow-primary-500/5">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          <p className="text-sm text-neutral-500">Проверяем доступ...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to={ADMIN_ROUTES.LOGIN} replace />
  }

  return <AdminLayout />
}
