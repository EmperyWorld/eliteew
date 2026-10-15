/**
 * ========================================
 * FILE: StatusBadge.tsx
 * PURPOSE: Reusable status badge component for projects and analyses
 * ========================================
 *
 * CREATED: 2025-10-24
 * AUTHOR: react-specialist agent (Zahoz 1.4)
 *
 * FEATURES:
 * - Color-coded status indicators
 * - Multiple size variants (xs, sm, md, lg)
 * - Project status support
 * - Analysis status support
 * - Customizable colors
 * - Accessible labels
 *
 * USAGE:
 * import { StatusBadge, ProjectStatusBadge, AnalysisStatusBadge } from '@/components/ui/StatusBadge';
 *
 * <StatusBadge status="active" type="project" />
 * <ProjectStatusBadge status="completed" />
 * <AnalysisStatusBadge status="running" size="sm" />
 *
 * ========================================
 */

import * as React from 'react';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Project Status Types
 * Matches backend: api/models/database_models.py::Project.status
 */
export type ProjectStatus =
	| 'active'
	| 'completed'
	| 'paused'
	| 'on_hold'
	| 'cancelled'
	| 'archived';

/**
 * Analysis Status Types
 * Matches backend BI Airflow statuses
 */
export type AnalysisStatus =
	| 'pending'
	| 'running'
	| 'completed'
	| 'success'
	| 'failed';

/**
 * Badge Size Variants
 */
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Badge Type (determines color scheme)
 */
export type BadgeType = 'project' | 'analysis' | 'custom';

/**
 * Status Configuration
 */
interface StatusConfig {
	label: string;
	color: string;
	description?: string;
}

// ============================================================================
// STATUS CONFIGURATIONS
// ============================================================================

/**
 * Project Status Configurations
 */
const PROJECT_STATUS_CONFIGS: Record<ProjectStatus, StatusConfig> = {
	active: {
		label: 'Активен',
		color: 'bg-green-500/20 text-green-400 border-green-500/30',
		description: 'Проект в активной разработке',
	},
	completed: {
		label: 'Завершён',
		color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
		description: 'Проект успешно завершён',
	},
	paused: {
		label: 'Приостановлен',
		color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
		description: 'Проект временно приостановлен',
	},
	on_hold: {
		label: 'Ожидание',
		color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
		description: 'Проект ожидает решения',
	},
	cancelled: {
		label: 'Отменён',
		color: 'bg-red-500/20 text-red-400 border-red-500/30',
		description: 'Проект отменён',
	},
	archived: {
		label: 'Архив',
		color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
		description: 'Проект в архиве',
	},
};

/**
 * Analysis Status Configurations
 */
const ANALYSIS_STATUS_CONFIGS: Record<AnalysisStatus, StatusConfig> = {
	pending: {
		label: 'Ожидание',
		color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
		description: 'Анализ в очереди',
	},
	running: {
		label: 'Выполняется',
		color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
		description: 'Анализ выполняется',
	},
	completed: {
		label: 'Завершён',
		color: 'bg-green-500/20 text-green-400 border-green-500/30',
		description: 'Анализ завершён успешно',
	},
	success: {
		label: 'Успешно',
		color: 'bg-green-500/20 text-green-400 border-green-500/30',
		description: 'Анализ выполнен успешно',
	},
	failed: {
		label: 'Ошибка',
		color: 'bg-red-500/20 text-red-400 border-red-500/30',
		description: 'Анализ завершился с ошибкой',
	},
};

/**
 * Size Class Mappings
 */
const SIZE_CLASSES: Record<BadgeSize, string> = {
	xs: 'px-1 py-0.5 text-[9px]',
	sm: 'px-1.5 py-0.5 text-[10px]',
	md: 'px-2 py-0.5 text-xs',
	lg: 'px-2.5 py-1 text-sm',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface StatusBadgeProps {
	/** Status value */
	status: ProjectStatus | AnalysisStatus | string;

	/** Badge type (determines color scheme) */
	type?: BadgeType;

	/** Size variant */
	size?: BadgeSize;

	/** Custom label (overrides default) */
	label?: string;

	/** Custom color classes (overrides default) */
	color?: string;

	/** Show icon */
	showIcon?: boolean;

	/** Additional CSS classes */
	className?: string;
}

/**
 * StatusBadge Component
 *
 * Displays a color-coded status badge with configurable size and style.
 *
 * @example
 * // Project status
 * <StatusBadge status="active" type="project" />
 *
 * // Analysis status
 * <StatusBadge status="running" type="analysis" size="sm" />
 *
 * // Custom status
 * <StatusBadge
 *   status="custom"
 *   label="Custom"
 *   color="bg-purple-500/20 text-purple-400 border-purple-500/30"
 * />
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
	status,
	type = 'project',
	size = 'md',
	label,
	color,
	showIcon = false,
	className = '',
}) => {
	// Get configuration based on type
	const getConfig = (): StatusConfig => {
		if (type === 'project' && status in PROJECT_STATUS_CONFIGS) {
			return PROJECT_STATUS_CONFIGS[status as ProjectStatus];
		}

		if (type === 'analysis' && status in ANALYSIS_STATUS_CONFIGS) {
			return ANALYSIS_STATUS_CONFIGS[status as AnalysisStatus];
		}

		// Fallback for custom statuses
		return {
			label: label || status,
			color: color || 'bg-gray-500/20 text-gray-400 border-gray-500/30',
			description: '',
		};
	};

	const config = getConfig();
	const displayLabel = label || config.label;
	const displayColor = color || config.color;
	const sizeClass = SIZE_CLASSES[size];

	return (
		<span
			className={`inline-flex items-center gap-1 ${sizeClass} rounded-sm border font-medium ${displayColor} ${className}`}
			title={config.description || displayLabel}
			role="status"
			aria-label={displayLabel}
		>
			{showIcon && <StatusIcon status={status} type={type} />}
			<span>{displayLabel}</span>
		</span>
	);
};

// ============================================================================
// SPECIALIZED COMPONENTS
// ============================================================================

/**
 * ProjectStatusBadge Component
 *
 * Pre-configured badge for project statuses.
 *
 * @example
 * <ProjectStatusBadge status="active" />
 * <ProjectStatusBadge status="completed" size="lg" />
 */
export const ProjectStatusBadge: React.FC<Omit<StatusBadgeProps, 'type'>> = (
	props
) => <StatusBadge {...props} type="project" />;

/**
 * AnalysisStatusBadge Component
 *
 * Pre-configured badge for analysis statuses.
 *
 * @example
 * <AnalysisStatusBadge status="running" />
 * <AnalysisStatusBadge status="completed" size="sm" />
 */
export const AnalysisStatusBadge: React.FC<Omit<StatusBadgeProps, 'type'>> = (
	props
) => <StatusBadge {...props} type="analysis" />;

// ============================================================================
// STATUS ICON COMPONENT
// ============================================================================

interface StatusIconProps {
	status: ProjectStatus | AnalysisStatus | string;
	type: BadgeType;
}

/**
 * StatusIcon Component
 *
 * Displays an icon based on status type.
 */
const StatusIcon: React.FC<StatusIconProps> = ({ status, type }) => {
	// Simple dot indicator for now
	// Can be extended with lucide-react icons
	const getColor = () => {
		if (type === 'project') {
			const config = PROJECT_STATUS_CONFIGS[status as ProjectStatus];
			if (!config) {
				return 'bg-gray-400';
			}

			if (status === 'active') {
				return 'bg-green-400';
			}
			if (status === 'completed') {
				return 'bg-blue-400';
			}
			if (status === 'paused') {
				return 'bg-yellow-400';
			}
			if (status === 'on_hold') {
				return 'bg-orange-400';
			}
			if (status === 'cancelled') {
				return 'bg-red-400';
			}
			if (status === 'archived') {
				return 'bg-gray-400';
			}
		}

		if (type === 'analysis') {
			if (status === 'pending') {
				return 'bg-gray-400';
			}
			if (status === 'running') {
				return 'bg-blue-400 animate-pulse';
			}
			if (status === 'completed' || status === 'success') {
				return 'bg-green-400';
			}
			if (status === 'failed') {
				return 'bg-red-400';
			}
		}

		return 'bg-gray-400';
	};

	return (
		<span
			className={`w-1.5 h-1.5 rounded-full ${getColor()}`}
			aria-hidden="true"
		/>
	);
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get status configuration
 *
 * @param status - Status value
 * @param type - Badge type
 * @returns Status configuration
 *
 * @example
 * const config = getStatusConfig('active', 'project');
 * log.info(config.label); // "Активен"
 * log.info(config.color); // "bg-green-500/20..."
 */
export const getStatusConfig = (
	status: ProjectStatus | AnalysisStatus | string,
	type: BadgeType = 'project'
): StatusConfig => {
	if (type === 'project' && status in PROJECT_STATUS_CONFIGS) {
		return PROJECT_STATUS_CONFIGS[status as ProjectStatus];
	}

	if (type === 'analysis' && status in ANALYSIS_STATUS_CONFIGS) {
		return ANALYSIS_STATUS_CONFIGS[status as AnalysisStatus];
	}

	return {
		label: status,
		color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
		description: '',
	};
};

/**
 * Check if status is terminal (completed/failed)
 *
 * @param status - Status value
 * @param type - Badge type
 * @returns True if status is terminal
 *
 * @example
 * isTerminalStatus('completed', 'project'); // true
 * isTerminalStatus('active', 'project'); // false
 * isTerminalStatus('failed', 'analysis'); // true
 */
export const isTerminalStatus = (
	status: ProjectStatus | AnalysisStatus | string,
	type: BadgeType = 'project'
): boolean => {
	if (type === 'project') {
		return ['completed', 'cancelled', 'archived'].includes(status);
	}

	if (type === 'analysis') {
		return ['completed', 'success', 'failed'].includes(status);
	}

	return false;
};

/**
 * Check if status is active/running
 *
 * @param status - Status value
 * @param type - Badge type
 * @returns True if status is active/running
 *
 * @example
 * isActiveStatus('active', 'project'); // true
 * isActiveStatus('running', 'analysis'); // true
 * isActiveStatus('completed', 'project'); // false
 */
export const isActiveStatus = (
	status: ProjectStatus | AnalysisStatus | string,
	type: BadgeType = 'project'
): boolean => {
	if (type === 'project') {
		return status === 'active';
	}

	if (type === 'analysis') {
		return status === 'running';
	}

	return false;
};

// ============================================================================
// EXPORTS
// ============================================================================

export default StatusBadge;

/**
 * ========================================
 * USAGE EXAMPLES
 * ========================================
 *
 * 1. PROJECT STATUS BADGES:
 *
 * <ProjectStatusBadge status="active" />
 * <ProjectStatusBadge status="completed" size="lg" />
 * <ProjectStatusBadge status="paused" showIcon />
 *
 * ========================================
 *
 * 2. ANALYSIS STATUS BADGES:
 *
 * <AnalysisStatusBadge status="running" />
 * <AnalysisStatusBadge status="completed" size="sm" />
 * <AnalysisStatusBadge status="failed" showIcon />
 *
 * ========================================
 *
 * 3. CUSTOM STATUS BADGES:
 *
 * <StatusBadge
 *   status="custom"
 *   label="In Review"
 *   color="bg-purple-500/20 text-purple-400 border-purple-500/30"
 *   size="md"
 * />
 *
 * ========================================
 *
 * 4. WITH UTILITY FUNCTIONS:
 *
 * const ProjectCard = ({ project }) => {
 *   const config = getStatusConfig(project.status, 'project');
 *   const isActive = isActiveStatus(project.status, 'project');
 *   const isTerminal = isTerminalStatus(project.status, 'project');
 *
 *   return (
 *     <div>
 *       <h3>{project.name}</h3>
 *       <ProjectStatusBadge status={project.status} />
 *       {isActive && <span>Currently working on it!</span>}
 *       {isTerminal && <span>No longer active</span>}
 *     </div>
 *   );
 * };
 *
 * ========================================
 */
