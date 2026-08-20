<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TRADITIONS, traditionById, type DispositionKind } from '$lib/funeral/constraints';
	import Testimonials from '$lib/components/funeral/Testimonials.svelte';
	import { loadCase, saveCase, type ArrangementCase } from '$lib/funeral/case-store';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const existing = loadCase();

	// Decedent — the subject of the booking, and never a party to it.
	let decedentName = $state(existing?.decedent.name ?? '');
	let placeOfDeath = $state(existing?.decedent.placeOfDeath ?? '');
	let diedAtLocal = $state(existing ? toLocalInput(existing.facts.diedAt) : defaultDiedAt());

	// What the family's tradition asks of us.
	let traditionId = $state(existing?.facts.traditionId ?? 'CATHOLIC');
	let disposition = $state<DispositionKind>(existing?.facts.disposition ?? 'BURIAL');

	// The legal gate.
	let coronerInvolved = $state(existing?.facts.coronerInvolved ?? false);
	let coronerKnown = $state(Boolean(existing?.facts.coronerReleaseAt));
	let coronerReleaseLocal = $state(
		existing?.facts.coronerReleaseAt ? toLocalInput(existing.facts.coronerReleaseAt) : ''
	);

	// The one wish that moves the window.
	let familyTravelling = $state(Boolean(existing?.facts.familyArrivesAt));
	let familyArrivesLocal = $state(
		existing?.facts.familyArrivesAt ? toLocalInput(existing.facts.familyArrivesAt) : ''
	);

	// The arranger — the person we will actually speak to.
	let arrangerName = $state(existing?.arranger.name ?? '');
	let arrangerRelation = $state(existing?.arranger.relation ?? '');
	let arrangerEmail = $state(existing?.arranger.email ?? '');
	let arrangerPhone = $state(existing?.arranger.phone ?? '');

	// The payer. Asked separately because they are usually a different person,
	// and asking "is this you?" after the fact is how families get billed twice.
	let payerIsArranger = $state(existing ? !existing.payer : true);
	let payerName = $state(existing?.payer?.name ?? '');
	let payerRelation = $state(existing?.payer?.relation ?? '');
	let payerEmail = $state(existing?.payer?.email ?? '');

	let wishes = $state(existing?.wishes ?? '');
	let formError = $state<string | undefined>(undefined);

	const tradition = $derived(traditionById(traditionId));

	// A tradition that permits only one disposition decides it. Showing the
	// family a cremation option under a rite that forbids it is not a choice.
	$effect(() => {
		if (!tradition.disposition.includes(disposition)) {
			disposition = tradition.disposition[0];
		}
	});

	/** `datetime-local` wants a zone-less local string; instants are UTC. */
	function toLocalInput(instant: string): string {
		const date = new Date(instant);
		const offset = date.getTimezoneOffset() * 60_000;
		return new Date(date.getTime() - offset).toISOString().slice(0, 16);
	}

	function fromLocalInput(local: string): string {
		return new Date(local).toISOString();
	}

	/** Yesterday evening: the commonest answer, and never in the future. */
	function defaultDiedAt(): string {
		const now = Date.now();
		return toLocalInput(new Date(now - 18 * 3_600_000).toISOString());
	}

	function submit(event: SubmitEvent): void {
		event.preventDefault();
		formError = undefined;

		const diedAt = fromLocalInput(diedAtLocal);
		if (Number.isNaN(Date.parse(diedAt))) {
			formError = 'Please give the date and time of death.';
			return;
		}
		if (Date.parse(diedAt) > Date.now()) {
			formError = 'The date of death cannot be in the future.';
			return;
		}
		if (coronerInvolved && coronerKnown && !coronerReleaseLocal) {
			formError = 'Please give the time of the release, or say it is not yet known.';
			return;
		}
		if (familyTravelling && !familyArrivesLocal) {
			formError = 'Please give the time the family arrives, or remove that request.';
			return;
		}

		const value: ArrangementCase = {
			decedent: {
				name: decedentName.trim(),
				placeOfDeath: placeOfDeath.trim() || undefined
			},
			facts: {
				diedAt,
				traditionId,
				disposition,
				coronerInvolved,
				coronerReleaseAt:
					coronerInvolved && coronerKnown ? fromLocalInput(coronerReleaseLocal) : undefined,
				familyArrivesAt: familyTravelling ? fromLocalInput(familyArrivesLocal) : undefined
			},
			arranger: {
				name: arrangerName.trim(),
				email: arrangerEmail.trim(),
				phone: arrangerPhone.trim() || undefined,
				relation: arrangerRelation.trim() || undefined
			},
			payer: payerIsArranger
				? undefined
				: {
						name: payerName.trim(),
						email: payerEmail.trim(),
						relation: payerRelation.trim() || undefined
					},
			wishes: wishes.trim() || undefined
		};

		saveCase(value);
		goto(resolve(`/${data.organization.slug}/arrangements`));
	}
</script>

<div class="mb-12">
	<Testimonials />
</div>

<div class="max-w-2xl">
	<p class="eyebrow settle">Beginning an arrangement</p>
	<h1 class="display settle mt-2 text-3xl">We are sorry.</h1>
	<p class="settle mt-3 leading-relaxed opacity-70">
		A few facts, and we will work out what is possible. Nothing here is booked, and nothing is
		charged. If you would rather do this on the telephone, call us and we will fill it in for you.
	</p>

	<form class="mt-10 space-y-12" onsubmit={submit}>
		<section>
			<div class="hairline pb-2">
				<h2 class="display text-xl">The person who has died</h2>
			</div>
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<label class="form-control sm:col-span-2">
					<span class="label-text py-1 text-sm">Their full name</span>
					<input
						class="input-bordered input w-full"
						required
						maxlength="255"
						bind:value={decedentName}
					/>
				</label>
				<label class="form-control">
					<span class="label-text py-1 text-sm">When they died</span>
					<input
						class="input-bordered input w-full"
						type="datetime-local"
						required
						bind:value={diedAtLocal}
					/>
				</label>
				<label class="form-control">
					<span class="label-text py-1 text-sm">Where, if you know</span>
					<input
						class="input-bordered input w-full"
						maxlength="255"
						placeholder="Hospital, home, elsewhere"
						bind:value={placeOfDeath}
					/>
				</label>
			</div>
		</section>

		<section>
			<div class="hairline pb-2">
				<h2 class="display text-xl">What is asked of us</h2>
			</div>
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<label class="form-control">
					<span class="label-text py-1 text-sm">Tradition</span>
					<select class="select-bordered select w-full" bind:value={traditionId}>
						{#each TRADITIONS as option (option.id)}
							<option value={option.id}>{option.label}</option>
						{/each}
					</select>
				</label>
				<label class="form-control">
					<span class="label-text py-1 text-sm">Burial or cremation</span>
					<select
						class="select-bordered select w-full"
						bind:value={disposition}
						disabled={tradition.disposition.length === 1}
					>
						{#each tradition.disposition as option (option)}
							<option value={option}>{option === 'BURIAL' ? 'Burial' : 'Cremation'}</option>
						{/each}
					</select>
				</label>
			</div>
			<p class="mt-3 text-sm leading-relaxed opacity-55">{tradition.note}</p>
		</section>

		<section>
			<div class="hairline pb-2">
				<h2 class="display text-xl">Anything holding us up</h2>
			</div>
			<div class="mt-4 space-y-4">
				<label class="flex items-start gap-3">
					<input
						type="checkbox"
						class="checkbox mt-0.5 checkbox-sm"
						bind:checked={coronerInvolved}
					/>
					<span class="text-sm leading-relaxed">
						A coroner or medical examiner is involved
						<span class="block text-xs opacity-55">
							Nothing may be scheduled until they release. This is the law, and it is the constraint
							that most often moves a funeral.
						</span>
					</span>
				</label>

				{#if coronerInvolved}
					<div class="settle ml-8 space-y-3 border-l border-base-300 pl-5">
						<label class="flex items-center gap-3 text-sm">
							<input type="checkbox" class="checkbox checkbox-sm" bind:checked={coronerKnown} />
							We have been given a release time
						</label>
						{#if coronerKnown}
							<label class="form-control max-w-xs">
								<span class="label-text py-1 text-sm">Released at</span>
								<input
									class="input-bordered input w-full"
									type="datetime-local"
									bind:value={coronerReleaseLocal}
								/>
							</label>
						{:else}
							<p class="text-xs leading-relaxed opacity-55">
								We will plan against an estimate of three days, and mark every date as provisional
								until the release comes through.
							</p>
						{/if}
					</div>
				{/if}

				<label class="flex items-start gap-3">
					<input
						type="checkbox"
						class="checkbox mt-0.5 checkbox-sm"
						bind:checked={familyTravelling}
					/>
					<span class="text-sm leading-relaxed">
						Someone is travelling and we should wait for them
						<span class="block text-xs opacity-55">
							A wish, not a rule. We will tell you if honouring it breaks something that is.
						</span>
					</span>
				</label>
				{#if familyTravelling}
					<div class="settle ml-8 border-l border-base-300 pl-5">
						<label class="form-control max-w-xs">
							<span class="label-text py-1 text-sm">They arrive</span>
							<input
								class="input-bordered input w-full"
								type="datetime-local"
								bind:value={familyArrivesLocal}
							/>
						</label>
					</div>
				{/if}
			</div>
		</section>

		<section>
			<div class="hairline pb-2">
				<h2 class="display text-xl">You</h2>
			</div>
			<div class="mt-4 grid gap-4 sm:grid-cols-2">
				<label class="form-control">
					<span class="label-text py-1 text-sm">Your name</span>
					<input
						class="input-bordered input w-full"
						required
						maxlength="255"
						bind:value={arrangerName}
					/>
				</label>
				<label class="form-control">
					<span class="label-text py-1 text-sm">You are their…</span>
					<input
						class="input-bordered input w-full"
						maxlength="100"
						placeholder="Daughter, executor, friend"
						bind:value={arrangerRelation}
					/>
				</label>
				<label class="form-control">
					<span class="label-text py-1 text-sm">Email</span>
					<input
						class="input-bordered input w-full"
						type="email"
						required
						maxlength="255"
						bind:value={arrangerEmail}
					/>
				</label>
				<label class="form-control">
					<span class="label-text py-1 text-sm">Telephone</span>
					<input
						class="input-bordered input w-full"
						type="tel"
						maxlength="100"
						bind:value={arrangerPhone}
					/>
				</label>
			</div>
		</section>

		<section>
			<div class="hairline pb-2">
				<h2 class="display text-xl">Who settles the account</h2>
			</div>
			<p class="mt-3 text-sm leading-relaxed opacity-55">
				Usually not the person arranging. An executor, an insurer, a brother abroad who offered on
				the phone and will be held to it. We ask now, because finding out afterwards is how a family
				gets invoiced twice.
			</p>
			<label class="mt-4 flex items-center gap-3 text-sm">
				<input type="checkbox" class="checkbox checkbox-sm" bind:checked={payerIsArranger} />
				That is me
			</label>
			{#if !payerIsArranger}
				<div class="settle mt-4 grid gap-4 sm:grid-cols-2">
					<label class="form-control">
						<span class="label-text py-1 text-sm">Their name</span>
						<input
							class="input-bordered input w-full"
							required
							maxlength="255"
							bind:value={payerName}
						/>
					</label>
					<label class="form-control">
						<span class="label-text py-1 text-sm">Their relation</span>
						<input
							class="input-bordered input w-full"
							maxlength="100"
							placeholder="Executor, insurer, son"
							bind:value={payerRelation}
						/>
					</label>
					<label class="form-control sm:col-span-2">
						<span class="label-text py-1 text-sm">Their email</span>
						<input
							class="input-bordered input w-full"
							type="email"
							required
							maxlength="255"
							bind:value={payerEmail}
						/>
					</label>
				</div>
			{/if}
		</section>

		<section>
			<div class="hairline pb-2">
				<h2 class="display text-xl">Anything we should know</h2>
			</div>
			<textarea
				class="textarea-bordered textarea mt-4 w-full"
				rows="3"
				maxlength="2000"
				placeholder="Music, readings, a request they made, someone we should be careful with"
				bind:value={wishes}></textarea>
		</section>

		{#if formError}
			<div role="alert" class="alert alert-error">
				<span>{formError}</span>
			</div>
		{/if}

		<figure
			class="settle w-[min(100vw-2rem,52rem)] max-w-none grid items-center gap-6 sm:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] sm:gap-8"
		>
			<img
				src="/afterlife.webp"
				alt="A robed figure standing alone in a pale, misty hall."
				class="h-auto w-full opacity-95 mix-blend-multiply"
				style="filter: sepia(52%) saturate(70%) contrast(114%);"
			/>
			<blockquote class="sm:pl-2">
				<p class="text-xs tracking-wider text-accent-content">★★★★★</p>
				<div class="display mt-3 space-y-3 text-lg leading-relaxed">
					<p>“An unbelievable transportation service, and a truly remarkable resting place.</p>
					<p>
						Do not mourn the dead, Harry. Pity the living—particularly those who have yet to
						experience SeptemFuneral.
					</p>
					<p>Five stars. Would recommend, though preferably only once.”</p>
				</div>
				<footer class="mt-4 text-xs opacity-55">
					Albus Dumbledore <span class="opacity-70">· verified — deceased</span>
				</footer>
			</blockquote>
		</figure>

		<div class="flex items-center gap-4 pb-4">
			<button type="submit" class="btn btn-primary">See what is possible</button>
			<span class="text-xs opacity-50">Nothing is booked by this.</span>
		</div>
	</form>
</div>
