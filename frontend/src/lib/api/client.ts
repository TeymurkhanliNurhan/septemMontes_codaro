/**
 * Thin fetch wrapper for the booking API, shared by SSR `load` functions and
 * browser event handlers.
 *
 * `api()` takes a `fetch` implementation as its first argument so SvelteKit
 * `load` functions can pass theirs — that is what makes server-side rendering
 * work against the backend without extra configuration.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3005';

/** An error response from the API, carrying the status and the parsed body. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: unknown,
		message: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
 * Fetches `${BASE}${path}` and parses JSON. Non-2xx responses reject with an
 * `ApiError` whose message is unwrapped from the API's error shape — see
 * `extractMessage`.
 *
 * These routes are unauthenticated by design, so there is deliberately no
 * `credentials: 'include'` here. Add it when the admin panel arrives.
 */
export async function api<T>(fetchFn: typeof fetch, path: string, init?: RequestInit): Promise<T> {
	const response = await fetchFn(`${BASE}${path}`, {
		...init,
		headers: { 'Content-Type': 'application/json', ...init?.headers }
	});

	if (!response.ok) {
		const body: unknown = await response.json().catch(() => null);
		throw new ApiError(response.status, body, extractMessage(body, response));
	}

	return response.json() as Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

/**
 * Unwraps the shape `AllExceptionsFilter` produces — `{ statusCode, timestamp,
 * path, message }` — where `message` is either a string or a class-validator
 * array. Returns a joined string in both cases, falling back to the HTTP
 * status text when the body has nothing readable in it.
 */
function extractMessage(body: unknown, response: Response): string {
	if (isRecord(body)) {
		const message = body['message'];
		if (typeof message === 'string') return message;
		if (Array.isArray(message)) {
			const text = message
				.map((entry) => {
					if (typeof entry === 'string') return entry;
					if (isRecord(entry) && typeof entry['message'] === 'string') {
						return entry['message'];
					}
					return JSON.stringify(entry);
				})
				.join('; ');
			if (text) return text;
		}
	}
	return response.statusText;
}
