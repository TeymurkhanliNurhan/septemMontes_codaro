/**
 * The staff session.
 *
 * The API issues an httpOnly cookie on login, which means the token is never
 * readable from JavaScript and there is nothing to keep in a store — "am I
 * signed in?" is answered by asking the server, not by trusting a flag we set
 * ourselves. Every guard here is therefore a round trip, and deliberately so.
 */
import { api, ApiError } from './client';

export interface StaffUser {
	id: string;
	email: string;
	role: string;
	name?: string | null;
}

/** Signs in and receives the session cookie. Throws `ApiError` on bad credentials. */
export function login(fetchFn: typeof fetch, email: string, password: string): Promise<StaffUser> {
	return api<StaffUser>(fetchFn, '/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password })
	});
}

export async function logout(fetchFn: typeof fetch): Promise<void> {
	await api<void>(fetchFn, '/auth/logout', { method: 'POST' });
}

/**
 * The signed-in user, or `undefined` when the session is missing or expired.
 *
 * Only 401 and 403 mean "not signed in". A network failure or a 500 must not
 * be mistaken for one, or an API restart would silently sign every director
 * out and send them to a login screen that cannot work either.
 */
export async function currentUser(fetchFn: typeof fetch): Promise<StaffUser | undefined> {
	try {
		return await api<StaffUser>(fetchFn, '/auth/me');
	} catch (cause) {
		if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) {
			return undefined;
		}
		throw cause;
	}
}
