import { Button } from '@components/atoms/Button';
import { Input } from '@components/atoms/Input';
import { useDeletePresentation, usePresentations } from '@services/api/presentations';
import {
  Edit,
  Eye,
  FileText,
  Plus,
  Presentation,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './presentation.css';

export const PresentationsListPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const { data: presentationsData, isLoading, refetch } = usePresentations();
  const deletePresentation = useDeletePresentation();

  const presentations = useMemo(() => presentationsData?.data ?? [], [presentationsData?.data]);

  const stats = useMemo(() => {
    const total = presentations.length;
    const published = presentations.filter((p) => p.isPublished).length;
    const draft = total - published;
    return { total, published, draft };
  }, [presentations]);

  const filteredPresentations = useMemo(() => {
    return presentations.filter((p) => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.slug.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'published' && p.isPublished) ||
        (statusFilter === 'draft' && !p.isPublished);
      return matchesSearch && matchesStatus;
    });
  }, [presentations, searchQuery, statusFilter]);

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Удалить презентацию "${title}"?\n\nЭто действие нельзя отменить.`)) {
      try {
        await deletePresentation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete presentation:', error);
        alert('Ошибка удаления презентации. Пожалуйста, попробуйте еще раз.');
      }
    }
  };

  const activeFiltersCount = [statusFilter !== 'all', searchQuery.length > 0].filter(
    Boolean
  ).length;

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-neutral-900 dark:text-white flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl">
              <Presentation className="text-blue-600 dark:text-blue-400" size={24} />
            </div>
            Презентации
            {!isLoading && (
              <span className="text-lg font-normal text-neutral-400 dark:text-slate-500">
                ({stats.total})
              </span>
            )}
          </h1>
          <p className="text-neutral-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <Sparkles size={14} className="text-amber-500" />
            Управление презентациями
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="dark:text-slate-300"
            disabled={isLoading}
          >
            <RefreshCcw size={16} className={`mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
          <Link to="/admin/presentations/new">
            <Button className="shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-shadow">
              <Plus size={18} className="mr-1" />
              Создать презентацию
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/40 dark:to-slate-800 border-primary-200/50 dark:border-primary-700/30 shadow-lg shadow-primary-500/5 dark:shadow-primary-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                Всего
              </p>
              <p className="text-2xl font-bold text-primary-900 dark:text-primary-100 mt-1">
                {stats.total}
              </p>
            </div>
            <div className="p-2.5 bg-primary-100 dark:bg-primary-800/50 rounded-xl">
              <Presentation size={20} className="text-primary-600 dark:text-primary-400" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/40 dark:to-slate-800 border-emerald-200/50 dark:border-emerald-700/30 shadow-lg shadow-emerald-500/5 dark:shadow-emerald-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Опубликовано
              </p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
                {stats.published}
              </p>
            </div>
            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-800/50 rounded-xl">
              <Eye size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl border bg-gradient-to-br from-amber-50 to-white dark:from-amber-900/40 dark:to-slate-800 border-amber-200/50 dark:border-amber-700/30 shadow-lg shadow-amber-500/5 dark:shadow-amber-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Черновики
              </p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mt-1">
                {stats.draft}
              </p>
            </div>
            <div className="p-2.5 bg-amber-100 dark:bg-amber-800/50 rounded-xl">
              <FileText size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-slate-500"
              size={18}
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию..."
              className="pl-10 dark:bg-slate-900 dark:border-slate-600 dark:text-white dark:placeholder-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Фильтр по статусу презентации"
              className="rounded-xl border border-neutral-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-neutral-700 dark:text-slate-300 focus:border-primary-300 dark:focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900"
            >
              <option value="all">Все статусы</option>
              <option value="published">Опубликовано</option>
              <option value="draft">Черновики</option>
            </select>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors"
              >
                <X size={14} />
                <span className="hidden sm:inline">Сбросить</span>
                <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Presentations List */}
      {isLoading && presentations.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
            >
              <div className="h-4 w-3/4 bg-neutral-200 dark:bg-slate-700 rounded mb-2" />
              <div className="h-3 w-1/2 bg-neutral-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPresentations.map((presentation, index: number) => (
            <div
              key={presentation.id}
              className="p-6 rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200 presentation-card-animation"
              style={
                {
                  '--animation-delay': `${index * 50}ms`,
                } as React.CSSProperties
              }
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-1">
                    {presentation.title}
                  </h3>
                  <p className="text-sm text-neutral-500 dark:text-slate-400">
                    {presentation.slides.length} слайд{presentation.slides.length !== 1 ? 'ов' : ''}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-lg ${
                    presentation.isPublished
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}
                >
                  {presentation.isPublished ? 'Опубликовано' : 'Черновик'}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs px-2 py-1 bg-neutral-100 dark:bg-slate-700 rounded-lg text-neutral-600 dark:text-slate-300">
                  {presentation.format === 'classic'
                    ? 'Классический'
                    : presentation.format === 'modern'
                      ? 'Современный'
                      : presentation.format === 'ollenti'
                        ? 'Demo Brand 1'
                        : presentation.format === 'ollenti2'
                          ? 'Demo Brand 2'
                          : 'Минималистичный'}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-neutral-100 dark:border-slate-700">
                <Link to={`/admin/presentations/${presentation.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Edit size={14} className="mr-1" />
                    Редактировать
                  </Button>
                </Link>
                <Link to={`/presentations/${presentation.slug}`} target="_blank">
                  <Button variant="ghost" size="sm">
                    <Eye size={14} />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(presentation.id, presentation.title)}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredPresentations.length === 0 && (
        <div className="p-16 text-center rounded-2xl border bg-white dark:bg-slate-800 border-neutral-200 dark:border-slate-700 shadow-sm">
          <div className="max-w-md mx-auto">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-800/20 flex items-center justify-center">
              <Presentation size={40} className="text-primary-500 dark:text-primary-400" />
            </div>

            {activeFiltersCount > 0 ? (
              <>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                  Ничего не найдено
                </h3>
                <p className="text-neutral-500 dark:text-slate-400 mb-6">
                  По вашему запросу не найдено презентаций. Попробуйте изменить фильтры.
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  <X size={16} className="mr-1" />
                  Сбросить фильтры
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                  Нет презентаций
                </h3>
                <p className="text-neutral-500 dark:text-slate-400 mb-6">
                  Создайте первую презентацию, чтобы начать работу
                </p>
                <Link to="/admin/presentations/new">
                  <Button className="shadow-lg shadow-primary-500/20">
                    <Plus size={18} className="mr-1" />
                    Создать презентацию
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
