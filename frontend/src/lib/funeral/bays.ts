/**
 * The home's cold storage.
 *
 * Cold storage is internal inventory. The public API deliberately does not
 * advertise it — a stranger has no business knowing how many bodies this home
 * is holding — so the bays are named here and assigned by the home. Both the
 * family flow and the director's console need the same three, which is why
 * this is not a constant inside either of them.
 */
import type { NamedResource } from './chain';

export const STORAGE_BAYS: NamedResource[] = [
	{ id: 'bay-1', name: 'Cold Storage Bay 1', resourceType: 'COLD_STORAGE' },
	{ id: 'bay-2', name: 'Cold Storage Bay 2', resourceType: 'COLD_STORAGE' },
	{ id: 'bay-3', name: 'Cold Storage Bay 3', resourceType: 'COLD_STORAGE' }
];
