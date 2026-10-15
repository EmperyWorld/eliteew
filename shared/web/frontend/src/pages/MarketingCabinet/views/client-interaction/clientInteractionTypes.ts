export type ClientInteractionLayout =
	| 'full'
	| 'documents-only'
	| 'presentations-only'
	| 'chat-only';

export type ClientInteractionViewProps = {
	selectedProjectId: string | null;
	readOnlyMarketing?: boolean;
	/** Узкая вёрстка для вложения (кабинет заказчика). */
	variant?: 'default' | 'embedded';
	/** Фрагменты интерфейса (вкладки кабинета заказчика). По умолчанию всё сразу. */
	layout?: ClientInteractionLayout;
};
