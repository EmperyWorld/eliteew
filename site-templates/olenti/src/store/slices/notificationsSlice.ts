import { create } from 'zustand'
import type { Notification } from '@typings/common'

interface NotificationsStore {
  notifications: Notification[]
  
  addNotification: (notification: Omit<Notification, 'id'>) => void
  removeNotification: (id: string) => void
  clearNotifications: () => void
}

export const useNotificationsStore = create<NotificationsStore>((set) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = Math.random().toString(36).substr(2, 9)
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }))
    
    if (notification.duration !== 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== id),
        }))
      }, notification.duration || 5000)
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter(n => n.id !== id),
    }))
  },

  clearNotifications: () => {
    set({ notifications: [] })
  },
}))
