/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Vitest locks for MusicForge run meta recap chips (W11).
 *
 * Related:
 * - MusicForgeRunMetaChips.tsx
 */

import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MusicForgeRunMetaChips } from '../MusicForgeRunMetaChips';
import { renderMusicForge } from '../musicForgeTestI18n';

describe('MusicForgeRunMetaChips', () => {
	it('renders vocal, genre preset label, language, and duration', () => {
		renderMusicForge(
			<MusicForgeRunMetaChips
				vocal="male"
				styleHint="pop"
				language="ru"
				durationSeconds={220}
			/>
		);
		expect(screen.getByLabelText('Параметры песни')).toBeInTheDocument();
		expect(screen.getByText('Мужской')).toBeInTheDocument();
		expect(screen.getByText('Поп')).toBeInTheDocument();
		expect(screen.getByText('Русский')).toBeInTheDocument();
		expect(screen.getByText('220 с')).toBeInTheDocument();
	});

	it('hides auto language and empty chips', () => {
		const { container } = renderMusicForge(
			<MusicForgeRunMetaChips language="auto" />
		);
		expect(container.firstChild).toBeNull();
	});
});
