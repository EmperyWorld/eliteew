/**
 * ---
 * EliteEW · Empery World · https://eliteew.ru
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Smoke coverage for shared inline audio preview control rendering.
 *
 * Invariants:
 * - Empty source shows fallback error copy.
 * - Non-empty source renders shared transport controls.
 * - Captions `<track>` appears only when `captionsSrc` is provided.
 *
 * Related:
 * - src/components/Audio/InlineAudioPreview.tsx
 */

import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { InlineAudioPreview } from '@/components/Audio/InlineAudioPreview';

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		i18n: { language: 'en' },
		t: (key: string) => {
			if (key === 'nowPlaying.errorLoadFallback') {
				return 'Ошибка загрузки. Попробуйте позже.';
			}
			if (key === 'inlineAudio.captionsLabel') {
				return 'Captions';
			}
			if (key === 'inlineAudio.previewAria') {
				return 'Audio preview';
			}
			return key;
		},
	}),
}));

beforeAll(() => {
	Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(HTMLMediaElement.prototype, 'load', {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(HTMLMediaElement.prototype, 'play', {
		configurable: true,
		value: vi.fn().mockResolvedValue(undefined),
	});
});

describe('InlineAudioPreview', () => {
	it('shows fallback error for empty source', () => {
		render(<InlineAudioPreview src="" />);
		expect(
			screen.getByText('Ошибка загрузки. Попробуйте позже.')
		).toBeInTheDocument();
	});

	it('renders shared controls for non-empty source', () => {
		render(
			<InlineAudioPreview
				src="blob:test-audio"
				trackName="Inline preview track"
			/>
		);
		expect(screen.getByLabelText('Загрузка трека')).toBeInTheDocument();
		expect(document.querySelector('track')).toBeNull();
	});

	it('renders localized captions track when captionsSrc is provided', () => {
		render(
			<InlineAudioPreview
				src="blob:test-audio"
				trackName="Inline preview track"
				captionsSrc="data:text/vtt,WEBVTT"
				captionsSrcLang="en"
				captionsLabel="Captions"
			/>
		);
		const track = document.querySelector('track');
		expect(track).not.toBeNull();
		expect(track?.getAttribute('src')).toBe('data:text/vtt,WEBVTT');
		expect(track?.getAttribute('srclang')).toBe('en');
		expect(track?.getAttribute('label')).toBe('Captions');
	});
});
