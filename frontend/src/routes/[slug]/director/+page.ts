import { redirect } from '@sveltejs/kit';
import { currentUser } from '$lib/api/auth';
import type { PageLoad } from './$types';

/**
 * The console is staff-only, so this guard runs in the browser rather than on
 * the server: the session lives in an httpOnly cookie scoped to the API's
 * origin, and SvelteKit's server-side `fetch` will not forward a cookie to a
 * different origin. Rendering this page on the server would therefore always
 * see an anonymous request and bounce a signed-in director to the login form.
 */
export const ssr = false;

export const load: PageLoad = async ({ fetch, params }) => {
	const user = await currentUser(fetch);
	if (!user) {
		redirect(303, `/${params.slug}/director/login`);
	}
	return { user };
};
