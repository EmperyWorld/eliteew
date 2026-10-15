/**
 * 🔥💎 REACT PORTAL - UI GOD MODAL POSITIONING 💎🔥
 *
 * Renders children in document.body to escape transform/overflow containers
 * Fixes modal positioning when parent has CSS transforms
 *
 * @version 1.0.0
 * @author React UI God
 */

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { log } from '../../utils/logger';

interface PortalProps {
	children: ReactNode;
	/** DOM element to render into (default: document.body) */
	container?: Element;
}

export const Portal: React.FC<PortalProps> = ({ children, container }) => {
	// На сервере не рендерим ничего
	if (typeof document === 'undefined') {
		return null;
	}

	// Получаем целевой элемент синхронно, как в Popover и ModalV2
	const targetElement = container || document.body;

	// Строгая проверка, что элемент существует и является валидным DOM элементом
	// Используем несколько проверок для максимальной надежности
	if (
		!targetElement ||
		!(targetElement instanceof Element) ||
		targetElement.nodeType !== Node.ELEMENT_NODE ||
		!targetElement.ownerDocument
	) {
		return null;
	}

	// Создаем портал напрямую, как в других компонентах
	// Добавляем try-catch для дополнительной защиты
	try {
		return createPortal(children, targetElement);
	} catch (error) {
		// Если произошла ошибка при создании портала, логируем и возвращаем null
		log.error('Failed to create portal:', (error as unknown as Error).message);
		return null as unknown as React.ReactPortal;
	}
};

export default Portal;
