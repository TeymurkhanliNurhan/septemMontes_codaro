import { api } from '$lib/api/client';
import type { PublicResource, PublicService } from '$lib/api/schemas';
import { CHAIN } from '$lib/funeral/chain';
import type { PageLoad } from './$types';

/**
 * The chain's shape — which services exist and which resources each may run on
 * — is the same for every family, so it loads here rather than in the page.
 * Availability is not: it depends on the window, which depends on facts that
 * only exist in the browser's session. That fetch lives in the component.
 */
export const load: PageLoad = async ({ fetch, params }) => {
	const services = await api<PublicService[]>(fetch, `/public/orgs/${params.slug}/services`);

	const steps = await Promise.all(
		CHAIN.map(async (definition) => {
			const service = services.find((candidate) => candidate.name === definition.serviceName);
			if (!service) {
				throw new Error(`This home has not published a "${definition.serviceName}" step.`);
			}
			const resources = await api<PublicResource[]>(
				fetch,
				`/public/orgs/${params.slug}/services/${service.id}/resources`
			);
			return {
				role: definition.role,
				serviceId: service.id,
				durationMinutes: service.durationMinutes,
				resources
			};
		})
	);

	return { steps };
};
