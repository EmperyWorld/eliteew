/**
 * Одно контекстное меню сообщения на всё приложение GAF Chat: новое ПКМ закрывает предыдущее.
 */
import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from 'react';
import {
	GafChatMessageContextMenu,
	type GafChatMessageContextMenuPayload,
} from './GafChatMessageContextMenu';

type Api = {
	openMessageContextMenu: (payload: GafChatMessageContextMenuPayload) => void;
	closeMessageContextMenu: () => void;
};

const Ctx = createContext<Api | null>(null);

export function GafChatMessageContextMenuProvider({
	children,
}: {
	children: ReactNode;
}): React.ReactElement {
	const [payload, setPayload] =
		useState<GafChatMessageContextMenuPayload | null>(null);

	const openMessageContextMenu = useCallback(
		(next: GafChatMessageContextMenuPayload) => {
			setPayload(next);
		},
		[]
	);

	const closeMessageContextMenu = useCallback(() => {
		setPayload(null);
	}, []);

	const api = useMemo(
		() => ({ openMessageContextMenu, closeMessageContextMenu }),
		[openMessageContextMenu, closeMessageContextMenu]
	);

	return (
		<Ctx.Provider value={api}>
			{children}
			<GafChatMessageContextMenu
				open={payload !== null}
				anchor={payload?.anchor ?? null}
				onClose={closeMessageContextMenu}
				onCopy={payload?.onCopy ?? (() => {})}
				showReply={payload?.showReply ?? false}
				onReply={payload?.onReply}
				canEdit={payload?.canEdit ?? false}
				onEdit={payload?.onEdit}
				onDeleteForMe={payload?.onDeleteForMe}
				canDeleteForEveryone={payload?.canDeleteForEveryone ?? false}
				onDeleteForEveryone={payload?.onDeleteForEveryone}
			/>
		</Ctx.Provider>
	);
}

export function useGafChatMessageContextMenu(): Api {
	const v = useContext(Ctx);
	if (!v) {
		return {
			openMessageContextMenu: () => {},
			closeMessageContextMenu: () => {},
		};
	}
	return v;
}
