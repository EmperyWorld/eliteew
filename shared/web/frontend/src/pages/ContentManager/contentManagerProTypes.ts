/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Public props and cabinet scope types for Content Manager Pro shell entrypoints.
 *
 * Invariants:
 * - Embedded desktop/mobile flags stay optional with stable defaults in the component layer.
 *
 * Related:
 * - ContentManagerPro.tsx, ContentManagerProShell.tsx, useContentManagerInitialScope.ts
 */
import type {
	ContentManagerInitialFilterSnapshot,
	WindowInitialPayload,
} from '../Desktop/types/desktop.types';
import type { ContentManagerTab } from './contentManagerTypes';

export interface ContentManagerCabinetScope {
	projectId: string;
	companyId: string;
	/** Узкий UI (из маркетингового кабинета): только проводник, фильтры компании/проекта скрыты. */
	cabinetView: boolean;
	projectName?: string;
}

export interface ContentManagerProProps {
	embedded?: boolean;
	/** MobileAndroid embedded WebView — compact shell, native toolbar owns title. */
	embeddedMobile?: boolean;
	initialCabinetScope?: ContentManagerCabinetScope | null;
	/** Открытие из окна папки рабочего стола: `item_id` папки или `content` (библиотека). */
	initialDesktopFolderItemId?: string | null;
	/** Сохранённый фильтр (ярлык Пуска): начальное состояние списка и режима просмотра. */
	initialFilterSnapshot?: ContentManagerInitialFilterSnapshot | null;
	/** Фокус строки по unified content id (окно с рабочего стола). */
	initialFocusUnifiedContentId?: string | null;
	/** Открыть модалку «привязка к проекту» после фокуса (вместе с initialFocusUnifiedContentId). */
	initialOpenAssignProject?: boolean;
	/** Desktop: синхронизация opt-in контекста окна (Assistant / GAF) через merge initialPayload. */
	onWindowPayloadChange?: (patch: Partial<WindowInitialPayload>) => void;
	/** Начальная вкладка (deep link / desktop-open-app), например `brokenFiles`. */
	initialActiveTab?: ContentManagerTab | null;
}
