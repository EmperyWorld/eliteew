/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Unified Content Manager UI (вкл. embedded на рабочем столе): thin shell delegating orchestration to Wave 4 controller hook.
 *
 * Invariants:
 * - Крупные вкладки и тяжёлые списки не блокируют первый paint; desktop shell — через `DesktopAppChrome`/`useDesktopShellFrame`.
 * - **`companionListingPlain`** и excerpt-поля не персистятся в `windows_snapshot` (санитайзер shell).
 *
 * Related:
 * - `desktopWindowAppContent.tsx` (ContentManagerDesktopMount), `buildEwaCompanionShellContext.ts`
 * - Wave 3 presentation: `components/ContentManagerProMainSurface.tsx`, `ContentManagerProFilesTabBridge.tsx`, `ContentManagerProModals.tsx`
 * - Wave 4 orchestration: `hooks/useContentManagerProController.ts`, `contentManagerProTypes.ts`
 */
import type * as React from 'react';
import { ContentManagerProMainSurface } from './components/ContentManagerProMainSurface';
import type {
	ContentManagerCabinetScope,
	ContentManagerProProps,
} from './contentManagerProTypes';
import { useContentManagerProController } from './hooks/useContentManagerProController';

export type { ContentManagerCabinetScope, ContentManagerProProps };

const ContentManagerPro: React.FC<ContentManagerProProps> = (props) => {
	const surfaceProps = useContentManagerProController(props);
	return <ContentManagerProMainSurface {...surfaceProps} />;
};

export default ContentManagerPro;
