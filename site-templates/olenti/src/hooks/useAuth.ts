import { useUserStore } from '@store/slices/userSlice'

export const useAuth = () => {
  const { user, isAuthenticated, setUser, setToken, logout } = useUserStore()

  return {
    user,
    isAuthenticated,
    setUser,
    setToken,
    logout,
  }
}
