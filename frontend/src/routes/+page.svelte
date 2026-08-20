<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<div class="mx-auto w-full max-w-3xl px-5 py-20">
	<p class="eyebrow settle">Septem Funeral</p>
	<h1 class="display settle mt-3 text-4xl leading-tight sm:text-5xl">
		When someone dies, almost nothing about the days that follow is anybody's choice.
	</h1>
	<p class="settle mt-6 max-w-xl leading-relaxed opacity-70">
		The date is not yours to pick. It is set by when the coroner releases, by what your faith asks
		of you, by when the last of the family can land, and by what the cemetery has left. We work out
		what is possible, and then we show you the whole of it — not a calendar to guess at.
	</p>

	<div class="settle mt-10 flex flex-wrap items-center gap-4">
		<a href={resolve('/septem')} class="btn btn-primary">Begin an arrangement</a>
		<a href={resolve('/septem/director')} class="btn btn-ghost btn-sm">Director's console</a>
	</div>

	<div class="hairline mt-16 pb-4"></div>
	<dl class="mt-6 grid gap-8 sm:grid-cols-3">
		<div>
			<dt class="display text-lg">The deceased</dt>
			<dd class="mt-1 text-sm leading-relaxed opacity-60">
				The person this is for cannot fill in a form, agree to terms, or be sent a reminder. They
				are the subject of the booking and never a user of it.
			</dd>
		</div>
		<div>
			<dt class="display text-lg">The arranger</dt>
			<dd class="mt-1 text-sm leading-relaxed opacity-60">
				A daughter, an executor, a neighbour. They make the decisions, and they are usually not the
				person the account is settled by.
			</dd>
		</div>
		<div>
			<dt class="display text-lg">The date</dt>
			<dd class="mt-1 text-sm leading-relaxed opacity-60">
				Derived, not chosen. We show you every constraint that produced it, including the ones you
				may want to argue with.
			</dd>
		</div>
	</dl>
</div>
