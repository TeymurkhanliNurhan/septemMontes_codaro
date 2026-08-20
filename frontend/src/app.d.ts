import type { PublicBookingResponse } from '$lib/api/schemas';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			booking?: PublicBookingResponse;
			zone?: string;
		}
		// interface Platform {}
	}
}

export {};
