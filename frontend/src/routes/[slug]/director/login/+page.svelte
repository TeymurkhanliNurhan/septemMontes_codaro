<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ApiError } from '$lib/api/client';
	import { login } from '$lib/api/auth';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let submitting = $state(false);
	let formError = $state<string | undefined>(undefined);

	// The console is the only page this form guards, so there is no destination
	// to carry through the query string — and therefore no redirect target an
	// attacker could put there.
	const destination = $derived(resolve(`/${data.organization.slug}/director`));

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (submitting) return;
		submitting = true;
		formError = undefined;
		try {
			await login(fetch, email.trim(), password);
			await goto(destination, { invalidateAll: true });
		} catch (cause) {
			// The API distinguishes "no such account" from "wrong password". This
			// screen does not, because that difference tells an attacker which of
			// the home's staff addresses are real.
			formError =
				cause instanceof ApiError && cause.status === 401
					? 'That email and password do not match.'
					: cause instanceof ApiError
						? cause.message
						: 'We could not reach the system just now.';
		} finally {
			submitting = false;
		}
	}
</script>

<div class="mx-auto max-w-sm py-10">
	<p class="eyebrow">Staff only</p>
	<h1 class="display mt-2 text-3xl">Director's console</h1>
	<p class="mt-3 text-sm leading-relaxed opacity-65">
		Everything behind this page is somebody's family. Sign in with the account the home issued you.
	</p>

	<form class="mt-8 space-y-4" onsubmit={submit}>
		<label class="form-control">
			<span class="label-text py-1 text-sm">Email</span>
			<input
				class="input-bordered input w-full"
				type="email"
				required
				autocomplete="username"
				bind:value={email}
			/>
		</label>
		<label class="form-control">
			<span class="label-text py-1 text-sm">Password</span>
			<input
				class="input-bordered input w-full"
				type="password"
				required
				autocomplete="current-password"
				bind:value={password}
			/>
		</label>

		{#if formError}
			<div role="alert" class="alert alert-error"><span>{formError}</span></div>
		{/if}

		<button type="submit" class="btn w-full btn-primary" disabled={submitting}>
			{#if submitting}<span class="loading loading-sm loading-spinner"></span>{/if}
			{submitting ? 'Signing in…' : 'Sign in'}
		</button>
	</form>
</div>
