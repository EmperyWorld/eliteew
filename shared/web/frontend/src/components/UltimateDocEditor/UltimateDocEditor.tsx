/**
 * 🔥💎 ULTIMATE DOCUMENT EDITOR 💎🔥
 *
 * Публичная обёртка: провайдер Zustand-стора + **`UltimateDocEditorInner`**.
 * Оркестрация — compose stages + **`inner/UltimateDocEditorInnerView`** (через thin facade).
 *
 * Created: 2025-10-18
 * Architecture: React 19.2 + TypeScript + Zustand
 */

import * as React from 'react';

import type { UltimateDocEditorProps } from './types/editor.types';
import { UltimateDocEditorStoreProvider } from './store/editorStoreContext';
import { UltimateDocEditorInner } from './UltimateDocEditorInner';

export const UltimateDocEditor: React.FC<UltimateDocEditorProps> = (props) => (
	<UltimateDocEditorStoreProvider>
		<UltimateDocEditorInner {...props} />
	</UltimateDocEditorStoreProvider>
);
