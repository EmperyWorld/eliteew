import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppStoreKbd } from '../AppStoreKbd';

describe('AppStoreKbd', () => {
	it('renders keyboard label inside kbd element', () => {
		render(<AppStoreKbd>/</AppStoreKbd>);
		expect(screen.getByText('/').tagName).toBe('KBD');
	});
});
