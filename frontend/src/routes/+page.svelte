<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let slug = $state('');

	function openOrganization(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = slug.trim();
		if (!trimmed) return;
		goto(resolve(`/${trimmed}`));
	}
</script>

<div class="hero min-h-[60vh]">
	<div class="hero-content text-center">
		<div class="max-w-md">
			<h1 class="text-4xl font-bold">Book an appointment</h1>
			<p class="py-4 opacity-70">
				Enter your organization's address to see what it offers. No account, no login.
			</p>
			<form class="join w-full" onsubmit={openOrganization}>
				<label class="input join-item grow" for="slug">
					<span class="opacity-50">bookings.app/</span>
					<input
						id="slug"
						class="w-full"
						placeholder="your-organization"
						bind:value={slug}
						autocomplete="off"
					/>
				</label>
				<button type="submit" class="btn join-item btn-primary">Go</button>
			</form>
			<p class="pt-6 text-sm opacity-60">
				Try the demo: <a href={resolve('/demo')} class="link link-primary">/demo</a>
			</p>
		</div>
	</div>
</div>
