import { api } from '$lib/api/client';
import type { PublicService } from '$lib/api/schemas';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const services = await api<PublicService[]>(fetch, `/public/orgs/${params.slug}/services`);
	return { services };
};
