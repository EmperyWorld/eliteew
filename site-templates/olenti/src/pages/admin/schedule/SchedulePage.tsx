import { Button } from '@components/atoms/Button';
import { AlertTriangle, Calendar, CheckCircle2, Clock, List, Plus, RefreshCw } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { ScheduleCalendar } from './components/schedule-calendar';
import { ScheduleDaySidebar } from './components/schedule-day-sidebar';
import { ScheduleList } from './components/schedule-list';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { ScheduleModal } from './components/schedule-modal';
import { useSchedule } from './hooks/useSchedule';
import type { PriorityFilter, StatusFilter, TypeFilter, ViewMode } from './types';

export const SchedulePage: React.FC = () => {
  const {
    currentDate,
    selectedDate,
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

    setSelectedDate,
    setFormData,
    setStatusFilter,
    setPriorityFilter,
    setTypeFilter,
    setSearchQuery,

    handleChangeMonth,
    openModal,
    closeModal,
    handleEditSlot,
    handleDeleteSlot,
    handleToggleTaskStatus,
    handleBlockDay,
    handleSubmit,
    getEntityTitle,
    refresh,
  } = useSchedule();

  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  const stats = useMemo(() => {
    const total = filteredSlots.length;
    const todayStr = new Date().toISOString().split('T')[0];
    const today = filteredSlots.filter((s) => s.date === todayStr).length;
    const pending = filteredSlots.filter((s) => s.status === 'pending').length;
    const done = filteredSlots.filter((s) => s.status === 'done').length;
    return { total, today, pending, done };
  }, [filteredSlots]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
          >
            <div className="h-4 w-24 bg-neutral-200 dark:bg-slate-700 rounded mb-2" />
            <div className="h-8 w-16 bg-neutral-200 dark:bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Продажи"
        title="Планировщик"
        titleIcon={<Calendar className="text-primary-600 dark:text-primary-400" size={24} />}
        description="Управление расписанием и задачами"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={refresh}
              className="text-sm text-neutral-600 dark:text-slate-300 hover:text-primary-700 dark:hover:text-primary-300"
            >
              <RefreshCw size={16} className="mr-2" />
              Обновить
            </Button>
            <Button type="button" onClick={() => openModal()}>
              <Plus size={20} className="mr-2" />
              Создать событие
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-gradient-to-br from-neutral-50 to-white dark:from-slate-800/50 dark:to-slate-800/30 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-neutral-500 dark:text-slate-400">
                Всего
              </p>
              <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">
                {stats.total}
              </p>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-slate-700 rounded-lg">
              <Calendar size={18} className="text-neutral-500 dark:text-slate-300" />
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-primary-200/60 dark:border-primary-700/40 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-primary-700 dark:text-primary-300">
                Сегодня
              </p>
              <p className="text-2xl font-bold text-primary-700 dark:text-primary-200 mt-1">
                {stats.today}
              </p>
            </div>
            <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-lg">
              <Clock size={18} className="text-primary-700 dark:text-primary-200" />
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-amber-200/60 dark:border-amber-700/40 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-700 dark:text-amber-300">
                В работе
              </p>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-200 mt-1">
                {stats.pending}
              </p>
            </div>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
              <AlertTriangle size={18} className="text-amber-700 dark:text-amber-200" />
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-emerald-200/60 dark:border-emerald-700/40 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Готово
              </p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-200 mt-1">
                {stats.done}
              </p>
            </div>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
              <CheckCircle2 size={18} className="text-emerald-700 dark:text-emerald-200" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'calendar'
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-slate-700'
            }`}
          >
            <Calendar size={16} className="inline mr-2" />
            Календарь
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'list'
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm'
                : 'text-neutral-600 dark:text-slate-400 hover:bg-neutral-100 dark:hover:bg-slate-700'
            }`}
          >
            <List size={16} className="inline mr-2" />
            Список
          </button>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'Все' },
              { key: 'pending', label: 'В работе' },
              { key: 'done', label: 'Готово' },
              { key: 'cancelled', label: 'Отменено' },
              { key: 'available', label: 'Доступно' },
              { key: 'full', label: 'Заполнено' },
            ].map((chip) => (
              <button
                key={chip.key}
                onClick={() => setStatusFilter(chip.key as StatusFilter)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all duration-200 ${
                  statusFilter === chip.key
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200 border-primary-200 dark:border-primary-700 shadow-sm scale-105'
                    : 'bg-neutral-100 dark:bg-slate-700 text-neutral-600 dark:text-slate-300 border-transparent hover:border-neutral-200 dark:hover:border-slate-600 hover:scale-105'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400">
            <span className="sr-only md:not-sr-only">Статус</span>
            <select
              aria-label="Фильтр по статусу"
              className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-neutral-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-colors"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">Все статусы</option>
              <option value="pending">В работе</option>
              <option value="done">Готово</option>
              <option value="cancelled">Отменено</option>
              <option value="available">Доступно</option>
              <option value="full">Заполнено</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400">
            <span className="sr-only md:not-sr-only">Тип</span>
            <select
              aria-label="Фильтр по типу"
              className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-neutral-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-colors"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">Все типы</option>
              <option value="task">Задачи</option>
              <option value="consultation">Консультации</option>
              <option value="masterclass">Мастер-классы</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-neutral-500 dark:text-slate-400">
            <span className="sr-only md:not-sr-only">Приоритет</span>
            <select
              aria-label="Фильтр по приоритету"
              className="px-3 py-1.5 text-sm border border-neutral-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-neutral-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-colors"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            >
              <option value="all">Все приоритеты</option>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
            </select>
          </label>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию или описанию"
            className="w-full md:w-64 px-3 py-1.5 text-sm border border-neutral-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-neutral-900 dark:text-slate-100 placeholder:text-neutral-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-colors"
          />
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-6">
            <ScheduleCalendar
              currentDate={currentDate}
              selectedDate={selectedDate}
              slots={filteredSlots}
              onSelectDate={setSelectedDate}
              onChangeMonth={handleChangeMonth}
              onAdd={openModal}
            />
          </div>
          <div className="xl:col-span-1 space-y-6">
            <ScheduleDaySidebar
              selectedDate={selectedDate}
              slots={filteredSlots}
              onAdd={openModal}
              onEdit={handleEditSlot}
              onDelete={handleDeleteSlot}
              onToggleTaskStatus={handleToggleTaskStatus}
              onBlockDay={handleBlockDay}
            />
          </div>
        </div>
      ) : (
        <ScheduleList
          slots={filteredSlots}
          onEdit={handleEditSlot}
          onDelete={handleDeleteSlot}
          onToggleTaskStatus={handleToggleTaskStatus}
          getEntityTitle={getEntityTitle}
        />
      )}

      <ScheduleModal
        isOpen={showModal}
        formData={formData}
        consultations={consultations}
        masterclasses={masterclasses}
        saving={saving}
        editingSlot={editingSlot}
        onChangeForm={(updater) => setFormData((prev) => updater(prev))}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />
    </div>
  );
};
