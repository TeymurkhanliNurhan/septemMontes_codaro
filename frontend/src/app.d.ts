import type { PublicBookingResponse } from '$lib/api/schemas';
import type { Plan } from '$lib/funeral/chain';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		/**
		 * A held arrangement travels to the confirmation page through navigation
		 * state rather than through the URL, because there is no public GET for a
		 * booking and there should not be one — a home's cases must not be
		 * enumerable by anyone who can count. Refreshing loses this, by design.
		 */
		interface PageState {
			reference?: string;
			plan?: Plan;
			zone?: string;
			bookings?: PublicBookingResponse[];
			/** The deceased's name, so the upsell can use it against you. */
			decedentName?: string;
			/** Names of the extras taken, in the order they are offered. */
			extras?: string[];
			/** One-off total in zloty, and anything recurring, kept apart. */
			total?: number;
			monthly?: number;
		}
	}
}

export {};
