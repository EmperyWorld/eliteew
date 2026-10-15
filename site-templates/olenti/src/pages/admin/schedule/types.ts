
export interface SlotFormData {
  entityType: 'consultation' | 'masterclass' | 'task'
  entityId: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'done' | 'cancelled' | 'available' | 'full'
  date: string
  startTime: string
  endTime: string
  maxParticipants: number
  notify: boolean
  remindBeforeMinutes: number
}

export interface EntityOption {
  id: string
  title: string
}

export type ViewMode = 'calendar' | 'list'

export type StatusFilter = 'all' | 'pending' | 'done' | 'cancelled' | 'available' | 'full'
export type PriorityFilter = 'all' | 'low' | 'medium' | 'high'
export type TypeFilter = 'all' | 'task' | 'consultation' | 'masterclass'
