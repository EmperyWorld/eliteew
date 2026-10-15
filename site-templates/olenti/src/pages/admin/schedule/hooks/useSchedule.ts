import { useToast } from '@components/atoms/Toast/Toast'
import { apiClient } from '@services/api/client'
import type { ScheduleSlot } from '@typings/admin'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { EntityOption, PriorityFilter, SlotFormData, StatusFilter, TypeFilter } from '../types'

interface RawSlot {
  id: string
  type?: string
  entityId?: string
  date?: string
  time?: string
  startTime?: string
  endTime?: string
  maxBookings?: number
  maxParticipants?: number
  currentBookings?: number
  currentParticipants?: number
  isAvailable?: boolean
  title?: string
  description?: string
  priority?: 'low' | 'medium' | 'high'
  status?: 'pending' | 'done' | 'cancelled' | 'available' | 'full'
}

export const useSchedule = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialDateParam = searchParams.get('date') || new Date().toISOString().split('T')[0]
  const initialDateObj = new Date(initialDateParam)

  const toast = useToast()
  const [currentDate, setCurrentDate] = useState(initialDateObj)
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDateParam)
  const [slots, setSlots] = useState<ScheduleSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [consultations, setConsultations] = useState<EntityOption[]>([])
  const [masterclasses, setMasterclasses] = useState<EntityOption[]>([])

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [formData, setFormData] = useState<SlotFormData>({
    entityType: 'masterclass',
    entityId: '',
    title: '',
    description: '',
    priority: 'medium',
    status: 'pending',
    date: '',
    startTime: '10:00',
    endTime: '12:00',
    maxParticipants: 8,
    notify: true,
    remindBeforeMinutes: 0,
  })

  const [editingSlot, setEditingSlot] = useState<ScheduleSlot | null>(null)
  const processedFromBookingRef = useRef<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [consRes, mcRes, slotsRes] = await Promise.all([
        apiClient.get<EntityOption[]>('/consultations'),
        apiClient.get<EntityOption[]>('/masterclasses'),
        apiClient.get('/schedule')
      ])

      setConsultations(consRes.data)
      setMasterclasses(mcRes.data)

      // Transform slots
      const transformedSlots: ScheduleSlot[] = (slotsRes.data || []).map((slot: RawSlot) => {
        const entityType = (slot.type as 'consultation' | 'masterclass' | 'task') || 'task'

        const status: ScheduleSlot['status'] =
          entityType === 'task'
            ? (slot.status as ScheduleSlot['status']) || 'pending'
            : slot.isAvailable === false
              ? 'full'
              : 'available'

        return {
          id: slot.id,
          entityType,
          entityId: slot.entityId || '',
          date: slot.date ? new Date(slot.date).toISOString().split('T')[0] : '',
          startTime: slot.time || slot.startTime || '10:00',
          endTime: slot.endTime || '12:00',
          maxParticipants: slot.maxBookings || slot.maxParticipants || 1,
          currentParticipants: slot.currentBookings || slot.currentParticipants || 0,
          status,
          title: slot.title,
          description: slot.description,
          priority: slot.priority,
        }
      })
      setSlots(transformedSlots)

      if (mcRes.data.length > 0) {
        setFormData(prev => ({ ...prev, entityId: mcRes.data[0].id }))
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      toast.error('Ошибка загрузки расписания')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // toast is stable enough usually, or we omit it. logic inside doesn't depend on props.

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (selectedDate) {
      const next = new Date(selectedDate)
      if (!Number.isNaN(next.getTime())) {
        setCurrentDate(next)
      }
    }
  }, [selectedDate])

  // Bootstrap slot in schedule from booking (when coming from "В планировщик" / duplicate)
  useEffect(() => {
    const fromBooking = searchParams.get('fromBooking')
    if (!fromBooking || processedFromBookingRef.current === fromBooking) {
      return
    }

    processedFromBookingRef.current = fromBooking

    const run = async () => {
      try {
        const { data } = await apiClient.get<any[]>('/admin/bookings')
        const booking = data.find((b) => b.id === fromBooking)
        if (!booking) {
          toast.error('Запись не найдена для планировщика')
          return
        }

        const slotType: 'consultation' | 'masterclass' | 'task' =
          booking.consultationId || booking.consultation
            ? 'consultation'
            : booking.masterclassId || booking.masterclass
              ? 'masterclass'
              : 'task'

        const dateIso = new Date(booking.date).toISOString().split('T')[0]

        await apiClient.post('/schedule', {
          date: dateIso,
          time: booking.time,
          type: slotType,
          title:
            booking.consultation?.title ||
            booking.masterclass?.title ||
            booking.slotInfo?.title ||
            'Слот по записи',
          description: booking.notes || '',
          priority: 'medium',
          status: 'pending',
          maxBookings: booking.participants || 1,
          notify: false,
          remindBeforeMinutes: 0,
        })

        await loadData()
        setSelectedDate(dateIso)
        toast.success('Слот по записи добавлен в планировщик')
      } catch (error) {
        console.error('Failed to create schedule slot from booking:', error)
        toast.error('Не удалось добавить запись в планировщик')
      } finally {
        // Убираем fromBooking из URL, чтобы не дублировать создание при обновлении
        const next = new URLSearchParams(searchParams.toString())
        next.delete('fromBooking')
        setSearchParams(next, { replace: true })
      }
    }

    void run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const formatDateForInput = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const openModal = (date?: string) => {
    setFormData({
      entityType: 'masterclass',
      entityId: masterclasses[0]?.id || '',
      title: '',
      description: '',
      priority: 'medium',
      status: 'pending',
      date: date || selectedDate || formatDateForInput(new Date()),
      startTime: '10:00',
      endTime: '12:00',
      maxParticipants: 8,
      notify: true,
      remindBeforeMinutes: 0,
    })
    setEditingSlot(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSlot(null)
  }

  const handleEditSlot = (slot: ScheduleSlot) => {
    setEditingSlot(slot)
    setFormData({
      entityType: (slot.entityType as 'consultation' | 'masterclass' | 'task') || 'task',
      entityId: slot.entityId,
      title: slot.title || '',
      description: slot.description || '',
      priority: slot.priority || 'medium',
      status: slot.status || 'pending',
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      maxParticipants: slot.maxParticipants,
      notify: false,
      remindBeforeMinutes: 0,
    })
    setShowModal(true)
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Удалить этот слот?')) return

    try {
      await apiClient.delete(`/schedule/${slotId}`)
      setSlots(prev => prev.filter(s => s.id !== slotId))
      toast.success('Слот удален')
    } catch (error) {
      console.error('Failed to delete slot:', error)
      toast.error('Ошибка удаления')
    }
  }

  const getEntityTitle = (type: string, id: string) => {
    if (type === 'task') return 'Задача'
    const list = type === 'consultation' ? consultations : masterclasses
    return list.find(e => e.id === id)?.title || (type === 'consultation' ? 'Консультация' : 'Мастер-класс')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    let slotTitle = formData.title
    if (formData.entityType !== 'task' && !slotTitle) {
      slotTitle = getEntityTitle(formData.entityType, formData.entityId)
    }

    const apiData = {
      date: formData.date,
      time: formData.startTime,
      endTime: formData.endTime,
      type: formData.entityType,
      title: slotTitle,
      description: formData.description,
      priority: formData.priority,
      status: formData.status,
      maxBookings: formData.maxParticipants,
      notify: formData.notify,
      remindBeforeMinutes: formData.remindBeforeMinutes,
    }

    try {
      if (editingSlot) {
        await apiClient.patch(`/schedule/${editingSlot.id}`, apiData)
        setSlots(slots.map(s => s.id === editingSlot.id ? {
          ...s,
          ...apiData,
          date: formData.date,
          startTime: formData.startTime,
          entityType: formData.entityType
        } : s))
        toast.success('Обновлено')
      } else {
        const { data } = await apiClient.post('/schedule', apiData)
        const newSlot: ScheduleSlot = {
          id: data.id,
          entityType: formData.entityType,
          entityId: formData.entityId,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          maxParticipants: formData.maxParticipants,
          currentParticipants: 0,
          status: formData.status,
          title: slotTitle,
          description: formData.description,
          priority: formData.priority,
        }
        setSlots([...slots, newSlot])
        toast.success(formData.notify ? 'Создано и добавлено напоминание' : 'Создано')
      }
      closeModal()
    } catch (error) {
      console.error('Failed to save slot:', error)
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleChangeMonth = (direction: 'prev' | 'next') => {
    setCurrentDate((prev) => {
      const year = prev.getFullYear()
      const month = prev.getMonth()
      return new Date(year, direction === 'prev' ? month - 1 : month + 1, 1)
    })
  }

  const handleToggleTaskStatus = async (slot: ScheduleSlot) => {
    const isDone = slot.status === 'done'
    try {
      const newStatus: ScheduleSlot['status'] = isDone ? 'pending' : 'done'
      await apiClient.patch(`/schedule/${slot.id}`, { status: newStatus })
      setSlots(prev => prev.map(s => s.id === slot.id ? { ...s, status: newStatus } : s))
      toast.success(isDone ? 'Задача возвращена в работу' : 'Задача выполнена')
    } catch {
      toast.error('Ошибка обновления статуса')
    }
  }

  const handleBlockDay = async (date: string) => {
    if (!confirm('Отметить этот день как выходной?')) return

    try {
      await apiClient.post('/schedule', {
        date,
        time: '00:00',
        endTime: '23:59',
        type: 'task',
        title: 'Выходной',
        description: 'День заблокирован',
        priority: 'high',
        status: 'pending',
        maxBookings: 0,
        isAvailable: false
      })
      await loadData()
      toast.success('День заблокирован')
    } catch (error) {
      console.error('Failed to block day:', error)
      toast.error('Ошибка при блокировке дня')
    }
  }

  const filteredSlots = slots.filter((slot) => {
    if (typeFilter !== 'all' && slot.entityType !== typeFilter) {
      return false
    }
    if (statusFilter !== 'all' && slot.status !== statusFilter) {
      return false
    }
    if (priorityFilter !== 'all' && slot.priority !== priorityFilter) {
      return false
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase()
      const title = (slot.title || '').toLowerCase()
      const description = (slot.description || '').toLowerCase()
      if (!title.includes(q) && !description.includes(q)) {
        return false
      }
    }
    return true
  })

  return {
    // State
    currentDate,
    selectedDate,
    slots,
    loading,
    showModal,
    saving,
    consultations,
    masterclasses,
    formData,
    editingSlot,
    statusFilter,
    priorityFilter,
    typeFilter,
    searchQuery,
    filteredSlots,

    // Setters
    setSelectedDate,
    setFormData,
    setStatusFilter,
    setPriorityFilter,
    setTypeFilter,
    setSearchQuery,

    // Handlers
    handleChangeMonth,
    openModal,
    closeModal,
    handleEditSlot,
    handleDeleteSlot,
    handleToggleTaskStatus,
    handleBlockDay,
    handleSubmit,
    getEntityTitle,
    refresh: loadData,
  }
}
