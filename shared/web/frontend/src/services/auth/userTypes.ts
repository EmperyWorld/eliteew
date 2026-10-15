/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Shared SPA user/auth DTO types formerly owned by retired AuthService.
 * Living session runtime is keycloak.ts / AuthContext; these types describe profile shape.
 *
 * Invariants:
 * - User.id is the OIDC subject (Keycloak sub) used across desktop/shell UI.
 *
 * Related:
 * - documentation/product/FRONTEND-AUTH.md
 * - contexts/AuthContext.tsx
 */

export interface LoginCredentials {
	login: string;
	password: string;
	remember_me?: boolean;
}

export interface RegisterData {
	email: string;
	username: string;
	password: string;
	confirm_password: string;
	role?: 'emperyworld_member' | 'admin' | 'ai_agent';
	invite_code?: string;
}

export interface User {
	id: string;
	email: string;
	username: string;
	role: 'admin' | 'emperyworld_admin' | 'emperyworld_member' | 'ai_agent';
	is_active: boolean;
	created_at: string;
	last_login?: string;
	profile?: {
		display_name?: string;
		avatar_url?: string;
		bio?: string;
		preferences?: Record<string, unknown>;
	};
	permissions?: string[];
}

export interface AuthTokens {
	access_token: string;
	refresh_token: string;
	token_type: string;
	expires_in: number;
	expires_at: string;
}

export interface LoginResponse {
	user: User;
	tokens: AuthTokens;
	message: string;
	session_id: string;
}

export interface AuthStatus {
	authenticated: boolean;
	user?: User;
	token_valid: boolean;
	expires_at?: string;
	session_id?: string;
	last_activity?: string;
}

export type AuthEventType =
	| 'login'
	| 'logout'
	| 'token_refresh'
	| 'token_expired'
	| 'session_expired'
	| 'unauthorized'
	| 'profile_updated';

export interface AuthEvent {
	type: AuthEventType;
	timestamp: string;
	user_id?: string;
	metadata?: unknown;
}
