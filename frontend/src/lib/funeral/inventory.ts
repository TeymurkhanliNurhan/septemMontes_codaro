/**
 * What the home has, arranged the way a director thinks about it.
 *
 * The public API advertises resources per step, which is the right shape for
 * building a plan and the wrong one for reading a stock list: the same chapel
 * comes back under both the viewing and the service, and cold storage never
 * comes back at all because it is not published. This inverts that into one
 * row per resource, grouped by what kind of thing it is.
 */
import type { PublicResource } from '$lib/api/schemas';
import { STORAGE_BAYS } from './bays';

/** A step the home publishes, with the resources it may run on. */
export interface ServiceInventory {
	id: string;
	name: string;
	description: string | null;
	durationMinutes: number;
	resources: PublicResource[];
}

export interface InventoryRow {
	name: string;
	type: string;
	/** The steps this resource may run. Empty where nothing publishes it. */
	steps: string[];
}

export interface InventoryGroup {
	id: string;
	label: string;
	/** Why this kind of resource behaves differently, where it does. */
	note: string;
	rows: InventoryRow[];
}

const RESOURCE_TYPES: Omit<InventoryGroup, 'rows'>[] = [
	{ id: 'PREP_ROOM', label: 'Preparation', note: 'Where the deceased is washed and dressed.' },
	{
		id: 'COLD_STORAGE',
		label: 'Cold storage',
		note: 'Ours alone, and never published — a bay is held for days rather than for an hour, which is why it is the resource that actually runs out.'
	},
	{
		id: 'CHAPEL',
		label: 'Chapels',
		note: 'Used twice in a chain: once for the viewing, once for the service.'
	},
	{
		id: 'HEARSE',
		label: 'Hearses',
		note: 'The reserve is offered only when the Warsaw car is already committed.'
	},
	{ id: 'CELEBRANT', label: 'Celebrants', note: '' },
	{
		id: 'COMMITTAL',
		label: 'Committal sites',
		note: 'Third parties. They keep their own diary, and confirm their own slots by telephone.'
	}
];

export function groupResources(services: ServiceInventory[]): InventoryGroup[] {
	const rows = new Map<string, InventoryRow>();

	for (const service of services) {
		for (const resource of service.resources) {
			const existing = rows.get(resource.id);
			if (existing) {
				existing.steps.push(service.name);
				continue;
			}
			rows.set(resource.id, {
				name: resource.name,
				type: resource.resourceType ?? 'OTHER',
				steps: [service.name]
			});
		}
	}

	// Cold storage is absent from the public API by design, and the director's
	// console is the one screen that has to show it regardless.
	for (const bay of STORAGE_BAYS) {
		rows.set(bay.id, { name: bay.name, type: 'COLD_STORAGE', steps: [] });
	}

	const all = [...rows.values()];
	const known = new Set(RESOURCE_TYPES.map((type) => type.id));
	const groups: InventoryGroup[] = RESOURCE_TYPES.map((type) => ({
		...type,
		rows: all.filter((row) => row.type === type.id)
	}));

	// A resource type this UI has never heard of is still the home's property
	// and still belongs on the list.
	const rest = all.filter((row) => !known.has(row.type));
	if (rest.length > 0) {
		groups.push({ id: 'OTHER', label: 'Everything else', note: '', rows: rest });
	}

	return groups.filter((group) => group.rows.length > 0);
}

/** The sites a committal may be held at, for the console's amendment form. */
export function committalSites(services: ServiceInventory[]): string[] {
	const names = new Set<string>();
	for (const service of services) {
		for (const resource of service.resources) {
			if (resource.resourceType === 'COMMITTAL') names.add(resource.name);
		}
	}
	return [...names].sort((left, right) => left.localeCompare(right));
}
