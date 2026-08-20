import { error } from '@sveltejs/kit';
import { api, ApiError } from '$lib/api/client';
import type { PublicOrganization } from '$lib/api/schemas';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ fetch, params }) => {
	try {
		const organization = await api<PublicOrganization>(fetch, `/public/orgs/${params.slug}`);
		return { organization };
	} catch (cause) {
		if (cause instanceof ApiError && cause.status === 404) {
			error(404, 'We could not find that organization');
		}
		throw cause;
	}
};
