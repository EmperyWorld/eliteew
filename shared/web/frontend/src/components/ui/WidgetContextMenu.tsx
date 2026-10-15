/**
 * WidgetContextMenu - Контекстное меню для виджетов
 *
 * Правый клик на виджете открывает меню с быстрыми действиями
 */

import * as React from 'react';
import { useEffect, useRef } from 'react';
import {
	ArrowPathIcon,
	ArrowUturnLeftIcon,
	ArrowsPointingInIcon,
	ArrowsPointingOutIcon,
	Cog6ToothIcon,
	EyeSlashIcon,
	InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';
import { useDesktopWindowPortalStackBase } from '@/pages/Desktop/context/DesktopWindowPortalStackContext';

interface ContextMenuAction {
	id: string;
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	danger?: boolean;
	disabled?: boolean;
}

interface WidgetContextMenuProps {
	/** Позиция меню */
	position: { x: number; y: number } | null;
	/** Действия меню */
	actions: ContextMenuAction[];
	/** Callback при закрытии */
	onClose: () => void;
	/** Видимость меню */
	isOpen: boolean;
}

export const WidgetContextMenu: React.FC<WidgetContextMenuProps> = ({
	position,
	actions,
	onClose,
	isOpen,
}) => {
	const portalStackBase = useDesktopWindowPortalStackBase();
	const menuRef = useRef<HTMLDivElement>(null);

	// Close menu on outside click
	useEffect(() => {
		if (!isOpen) {
			return;
		}

		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen, onClose]);

	if (!isOpen || !position) {
		return null;
	}

	// Constrain menu to viewport
	const menuWidth = 200;
	const menuHeight = actions.length * 40 + 16;
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;

	let menuX = position.x;
	let menuY = position.y;

	// Adjust if menu would go off screen
	if (menuX + menuWidth > viewportWidth) {
		menuX = viewportWidth - menuWidth - 10;
	}
	if (menuY + menuHeight > viewportHeight) {
		menuY = viewportHeight - menuHeight - 10;
	}
	if (menuX < 10) {
		menuX = 10;
	}
	if (menuY < 10) {
		menuY = 10;
	}

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						className="fixed inset-0"
						style={{ zIndex: portalStackBase - 1 }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
					/>
					{/* Menu */}
					<motion.div
						ref={menuRef}
						className="fixed w-50"
						style={{
							zIndex: portalStackBase,
							left: `${menuX}px`,
							top: `${menuY}px`,
						}}
						initial={{ opacity: 0, scale: 0.95, y: -10 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: -10 }}
						transition={{ duration: 0.15 }}
					>
						<div
							className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden"
							style={{
								background:
									'linear-gradient(135deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.96) 100%)',
								backdropFilter: 'blur(24px)',
							}}
						>
							<div className="p-2">
								{actions.map((action, index) => (
									<motion.button
										key={action.id}
										onClick={() => {
											if (!action.disabled) {
												action.onClick();
												onClose();
											}
										}}
										disabled={action.disabled}
										className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                      transition-all duration-150
                      ${
												action.disabled
													? 'opacity-50 cursor-not-allowed'
													: action.danger
														? 'hover:bg-red-500/20 text-red-400'
														: 'hover:bg-white/10 text-white/90'
											}
                    `}
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.03 }}
										whileHover={!action.disabled ? { x: 4 } : {}}
										whileTap={!action.disabled ? { scale: 0.98 } : {}}
									>
										<div className={`${action.disabled ? 'opacity-50' : ''}`}>
											{action.icon}
										</div>
										<span className="text-sm font-medium">{action.label}</span>
									</motion.button>
								))}
							</div>
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
};

// Helper function to create standard widget actions (Обновить, Настройки, Скрыть and optional others)
export const createWidgetActions = (options: {
	onRefresh?: () => void;
	onToggle?: () => void;
	onReset?: () => void;
	onSettings?: () => void;
	onInfo?: () => void;
	onHide?: () => void;
	isCollapsed?: boolean;
	canCollapse?: boolean;
}): ContextMenuAction[] => {
	const {
		onRefresh,
		onToggle,
		onReset,
		onSettings,
		onInfo,
		onHide,
		isCollapsed = false,
		canCollapse = true,
	} = options;

	const actions: ContextMenuAction[] = [];

	if (onRefresh) {
		actions.push({
			id: 'refresh',
			label: 'Обновить',
			icon: <ArrowPathIcon width={16} height={16} />,
			onClick: onRefresh,
		});
	}

	if (canCollapse && onToggle) {
		actions.push({
			id: 'toggle',
			label: isCollapsed ? 'Развернуть' : 'Свернуть',
			icon: isCollapsed ? (
				<ArrowsPointingOutIcon width={16} height={16} />
			) : (
				<ArrowsPointingInIcon width={16} height={16} />
			),
			onClick: onToggle,
		});
	}

	if (onReset) {
		actions.push({
			id: 'reset',
			label: 'Сбросить позицию',
			icon: <ArrowUturnLeftIcon width={16} height={16} />,
			onClick: onReset,
		});
	}

	if (onSettings) {
		actions.push({
			id: 'settings',
			label: 'Настройки',
			icon: <Cog6ToothIcon width={16} height={16} />,
			onClick: onSettings,
		});
	}

	if (onInfo) {
		actions.push({
			id: 'info',
			label: 'Информация',
			icon: <InformationCircleIcon width={16} height={16} />,
			onClick: onInfo,
		});
	}

	if (onHide) {
		actions.push({
			id: 'hide',
			label: 'Скрыть',
			icon: <EyeSlashIcon width={16} height={16} />,
			onClick: onHide,
		});
	}

	return actions;
};
