import { error } from '@sveltejs/kit';
import { api, ApiError } from '$lib/api/client';
import type { PublicResource, PublicService } from '$lib/api/schemas';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	try {
		// The API has no single-service GET — the five public routes are the
		// org, the list, resources, slots, and booking creation. Derive the
		// service from the list and 404 an id that is not on it.
		const services = await api<PublicService[]>(
			fetch,
			`/public/orgs/${params.slug}/services`
		);
		const service = services.find(
			(candidate) => candidate.id === params.serviceId
		);
		if (!service) {
			error(404, 'That service could not be found');
		}
		// Fetch resources only under CUSTOMER_CHOICE: for AUTO services that
		// endpoint 404s by design, and calling it unconditionally would surface
		// a spurious error.
		const resources =
			service.resourceSelectionMode === 'CUSTOMER_CHOICE'
				? await api<PublicResource[]>(
						fetch,
						`/public/orgs/${params.slug}/services/${params.serviceId}/resources`
					)
				: null;
		return { service, resources };
	} catch (cause) {
		if (cause instanceof ApiError && cause.status === 404) {
			error(404, 'That service could not be found');
		}
		throw cause;
	}
};
