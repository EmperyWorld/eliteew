import { createContext, useContext, useRef, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import type { StoreApi } from 'zustand';
import {
	createEditorStoreHook,
	useEditorStore as useGlobalEditorStore,
	type EditorStore,
} from './editorStore';

type EditorStoreApi = StoreApi<EditorStore>;

const EditorStoreContext = createContext<EditorStoreApi | null>(null);

export const UltimateDocEditorStoreProvider: React.FC<{
	children: ReactNode;
}> = ({ children }) => {
	const storeRef = useRef<EditorStoreApi | null>(null);
	if (!storeRef.current) {
		storeRef.current = createEditorStoreHook();
	}
	return (
		<EditorStoreContext.Provider value={storeRef.current}>
			{children}
		</EditorStoreContext.Provider>
	);
};

export function useEditorStoreApi(): EditorStoreApi {
	return useContext(EditorStoreContext) ?? useGlobalEditorStore;
}

/** Подписка на store с shallow-сравнением объекта-slice (меньше ререндеров). */
export function useEditorStoreShallow<T>(
	selector: (state: EditorStore) => T
): T {
	const store = useEditorStoreApi();
	return useStore(store, useShallow(selector));
}

export function useEditorStore(): EditorStore;
export function useEditorStore<T>(selector: (state: EditorStore) => T): T;
export function useEditorStore<T>(selector?: (state: EditorStore) => T) {
	const store = useEditorStoreApi();
	const resolvedSelector =
		selector ?? ((state: EditorStore) => state as unknown as T);
	return useStore(store, resolvedSelector);
}
