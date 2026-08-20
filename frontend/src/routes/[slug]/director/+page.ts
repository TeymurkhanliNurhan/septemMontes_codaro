import { redirect } from '@sveltejs/kit';
import { currentUser } from '$lib/api/auth';
import { api } from '$lib/api/client';
import type { PublicResource, PublicService } from '$lib/api/schemas';
import { CHAIN } from '$lib/funeral/chain';
import type { ServiceInventory } from '$lib/funeral/inventory';
import type { PageLoad } from './$types';

/**
 * The console is staff-only, so this guard runs in the browser rather than on
 * the server: the session lives in an httpOnly cookie scoped to the API's
 * origin, and SvelteKit's server-side `fetch` will not forward a cookie to a
 * different origin. Rendering this page on the server would therefore always
 * see an anonymous request and bounce a signed-in director to the login form.
 */
export const ssr = false;

/**
 * Where a step sits in a funeral. The API lists services alphabetically, which
 * puts the committal first and reads like nonsense to anyone who works here.
 */
function chainOrder(name: string): number {
	const index = CHAIN.findIndex((definition) => definition.serviceName === name);
	return index === -1 ? CHAIN.length : index;
}

/**
 * What the home has: the steps it publishes and the rooms, cars and sites
 * behind them. This is the same catalogue the family flow builds plans from,
 * and a director asked why a plan chose the reserve hearse should be able to
 * see the answer on their own screen.
 *
 * An `AUTO` service names no resources — the endpoint 404s rather than leak
 * staff — so those are listed without them instead of being fetched.
 */
export const load: PageLoad = async ({ fetch, params }) => {
	const user = await currentUser(fetch);
	if (!user) {
		redirect(303, `/${params.slug}/director/login`);
	}

	const services = await api<PublicService[]>(fetch, `/public/orgs/${params.slug}/services`);

	const inventory: ServiceInventory[] = await Promise.all(
		services.map(async (service) => {
			const resources =
				service.resourceSelectionMode === 'CUSTOMER_CHOICE'
					? await api<PublicResource[]>(
							fetch,
							`/public/orgs/${params.slug}/services/${service.id}/resources`
						)
					: [];
			return {
				id: service.id,
				name: service.name,
				description: service.description,
				durationMinutes: service.durationMinutes,
				resources
			};
		})
	);

	inventory.sort(
		(left, right) =>
			chainOrder(left.name) - chainOrder(right.name) || left.name.localeCompare(right.name)
	);

	return { user, services: inventory };
};
