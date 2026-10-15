import React from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ArrowRight } from 'lucide-react'
import { Card } from '@components/atoms/Card'

export interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  trend?: string
  color: 'primary' | 'accent' | 'blue' | 'purple' | 'green' | 'orange'
  to?: string
}

const colorConfig = {
  primary: {
    icon: 'bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/40 dark:to-primary-800/30 text-primary-600 dark:text-primary-400',
    iconHover: 'group-hover:from-primary-100 group-hover:to-primary-200 dark:group-hover:from-primary-800/50 dark:group-hover:to-primary-700/40',
    ring: 'ring-primary-200/50 dark:ring-primary-700/30',
    shadow: 'shadow-primary-500/10',
    border: 'border-primary-100 dark:border-primary-800/30',
  },
  accent: {
    icon: 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/40 dark:to-amber-800/30 text-amber-600 dark:text-amber-400',
    iconHover: 'group-hover:from-amber-100 group-hover:to-amber-200 dark:group-hover:from-amber-800/50 dark:group-hover:to-amber-700/40',
    ring: 'ring-amber-200/50 dark:ring-amber-700/30',
    shadow: 'shadow-amber-500/10',
    border: 'border-amber-100 dark:border-amber-800/30',
  },
  blue: {
    icon: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/40 dark:to-blue-800/30 text-blue-600 dark:text-blue-400',
    iconHover: 'group-hover:from-blue-100 group-hover:to-blue-200 dark:group-hover:from-blue-800/50 dark:group-hover:to-blue-700/40',
    ring: 'ring-blue-200/50 dark:ring-blue-700/30',
    shadow: 'shadow-blue-500/10',
    border: 'border-blue-100 dark:border-blue-800/30',
  },
  purple: {
    icon: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/40 dark:to-purple-800/30 text-purple-600 dark:text-purple-400',
    iconHover: 'group-hover:from-purple-100 group-hover:to-purple-200 dark:group-hover:from-purple-800/50 dark:group-hover:to-purple-700/40',
    ring: 'ring-purple-200/50 dark:ring-purple-700/30',
    shadow: 'shadow-purple-500/10',
    border: 'border-purple-100 dark:border-purple-800/30',
  },
  green: {
    icon: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/40 dark:to-emerald-800/30 text-emerald-600 dark:text-emerald-400',
    iconHover: 'group-hover:from-emerald-100 group-hover:to-emerald-200 dark:group-hover:from-emerald-800/50 dark:group-hover:to-emerald-700/40',
    ring: 'ring-emerald-200/50 dark:ring-emerald-700/30',
    shadow: 'shadow-emerald-500/10',
    border: 'border-emerald-100 dark:border-emerald-800/30',
  },
  orange: {
    icon: 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/40 dark:to-orange-800/30 text-orange-600 dark:text-orange-400',
    iconHover: 'group-hover:from-orange-100 group-hover:to-orange-200 dark:group-hover:from-orange-800/50 dark:group-hover:to-orange-700/40',
    ring: 'ring-orange-200/50 dark:ring-orange-700/30',
    shadow: 'shadow-orange-500/10',
    border: 'border-orange-100 dark:border-orange-800/30',
  },
}

export function StatCard({ title, value, icon: Icon, trend, color, to }: StatCardProps) {
  const config = colorConfig[color]

  const content = (
    <Card className={`p-5 hover:shadow-xl hover:ring-2 ${config.ring} hover:${config.shadow} transition-all duration-300 h-full group border ${config.border} bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-neutral-400 dark:text-slate-500 uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-display font-bold text-neutral-900 dark:text-white">{value}</p>
          {trend && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full w-fit">
              <TrendingUp size={10} />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${config.icon} ${config.iconHover} transition-all duration-300 group-hover:scale-110 group-hover:shadow-md`}>
          <Icon size={20} strokeWidth={2} />
        </div>
      </div>
      {to && (
        <div className="mt-4 pt-3 border-t border-neutral-100/80 dark:border-slate-700/50">
          <span className="text-xs text-neutral-500 dark:text-slate-400 font-medium flex items-center gap-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:gap-2 transition-all">
            Подробнее <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
          </span>
        </div>
      )}
    </Card>
  )

  if (to) {
    return <Link to={to} className="block h-full">{content}</Link>
  }
  return content
}
