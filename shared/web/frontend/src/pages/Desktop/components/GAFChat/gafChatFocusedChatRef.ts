/**
 * Id выбранного чата в GAF Chat (обновляется из {@link GAFChatApp}).
 * Используется провайдером уведомлений, чтобы отличить звук «входящее в открытой переписке» от фонового beep.
 */
export const gafChatFocusedChatIdRef: { current: string | null } = {
	current: null,
};
