/**
 * Tests for useAuth hook
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuth } from '../useAuth'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns initial state with no user', () => {
    localStorageMock.getItem.mockReturnValue(null)
    
    const { result } = renderHook(() => useAuth())
    
    expect(result.current.user).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('loads user from localStorage on mount', () => {
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser))
    
    const { result } = renderHook(() => useAuth())
    
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('handles login correctly', () => {
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' }
    localStorageMock.getItem.mockReturnValue(null)
    
    const { result } = renderHook(() => useAuth())
    
    act(() => {
      result.current.login(mockUser)
    })
    
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isAuthenticated).toBe(true)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'auth_user',
      JSON.stringify(mockUser)
    )
  })

  it('handles logout correctly', () => {
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser))
    
    const { result } = renderHook(() => useAuth())
    
    act(() => {
      result.current.logout()
    })
    
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_user')
  })

  it('handles invalid localStorage data', () => {
    localStorageMock.getItem.mockReturnValue('invalid json')
    
    const { result } = renderHook(() => useAuth())
    
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('updates user data correctly', () => {
    const mockUser = { id: 1, name: 'Test User', email: 'test@example.com' }
    const updatedUser = { ...mockUser, name: 'Updated User' }
    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser))
    
    const { result } = renderHook(() => useAuth())
    
    act(() => {
      result.current.updateUser(updatedUser)
    })
    
    expect(result.current.user).toEqual(updatedUser)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'auth_user',
      JSON.stringify(updatedUser)
    )
  })
})
