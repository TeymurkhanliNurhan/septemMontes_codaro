/**
 * The arrangement in progress, kept in `sessionStorage`.
 *
 * A family fills this in over twenty minutes on the worst day of their life,
 * on a phone, in a hospital corridor. Losing it to a refresh is not acceptable
 * — but it is also not ours to keep, so it lives in the session and not on a
 * server, and it goes when the tab does.
 */
import type { CaseFacts } from './constraints';

const KEY = 'septem.case';
const BOARD_KEY = 'septem.board';
const BOARD_SEEDED_KEY = 'septem.board.seeded';

export interface Party {
	name: string;
	email: string;
	phone?: string;
	/** How they stood to the deceased: daughter, executor, solicitor. */
	relation?: string;
}

export interface Decedent {
	name: string;
	/** Optional; some families do not know or do not wish to say. */
	dateOfBirth?: string;
	placeOfDeath?: string;
}

export interface ArrangementCase {
	decedent: Decedent;
	facts: CaseFacts;
	/** The person making the arrangements. Never called the customer. */
	arranger: Party;
	/**
	 * Who settles the account. Often not the arranger — an executor, an
	 * insurer, a sibling abroad — so it is asked for separately rather than
	 * assumed.
	 */
	payer?: Party;
	/** Anything the family asked us to know. */
	wishes?: string;
}

function isBrowser(): boolean {
	return typeof sessionStorage !== 'undefined';
}

export function saveCase(value: ArrangementCase): void {
	if (!isBrowser()) return;
	sessionStorage.setItem(KEY, JSON.stringify(value));
}

export function loadCase(): ArrangementCase | undefined {
	if (!isBrowser()) return undefined;
	const raw = sessionStorage.getItem(KEY);
	if (!raw) return undefined;
	try {
		return JSON.parse(raw) as ArrangementCase;
	} catch {
		// A half-written case is worse than none: drop it and send the family
		// back to intake rather than rendering a plan from rubble.
		sessionStorage.removeItem(KEY);
		return undefined;
	}
}

export function clearCase(): void {
	if (!isBrowser()) return;
	sessionStorage.removeItem(KEY);
}

/** One booked step of the chain, as the console lists it under a case. */
export interface BoardStep {
	label: string;
	startsAt: string;
	endsAt: string;
	resourceName: string;
	/** The booking the API wrote, where there is one behind this row. */
	bookingId?: string;
}

/** A confirmed arrangement, as the director's board shows it. */
export interface BoardEntry {
	reference: string;
	decedentName: string;
	arrangerName: string;
	payerName: string;
	traditionLabel: string;
	bayName: string;
	storageFrom: string;
	storageTo: string;
	serviceAt: string;
	committalAt: string;
	committalSite: string;
	/** True until the third-party site confirms their slot. */
	awaitingThirdParty: boolean;
	/** True when the coroner has not yet released. */
	provisional: boolean;
	/**
	 * The whole chain, so the console can open a case rather than read a row.
	 * Optional: a case entered before the board carried the steps still shows
	 * its service and committal.
	 */
	steps?: BoardStep[];
}

/**
 * The board is written by the family flow and read by the director console.
 * `localStorage` rather than the session, because the console is the home's
 * own screen and should still show today's cases tomorrow morning.
 */
export function pushBoardEntry(entry: BoardEntry): void {
	if (typeof localStorage === 'undefined') return;
	const entries = loadBoard().filter((existing) => existing.reference !== entry.reference);
	entries.push(entry);
	saveBoard(entries);
}

export function loadBoard(): BoardEntry[] {
	if (typeof localStorage === 'undefined') return [];
	const raw = localStorage.getItem(BOARD_KEY);
	if (!raw) return [];
	try {
		return JSON.parse(raw) as BoardEntry[];
	} catch {
		localStorage.removeItem(BOARD_KEY);
		return [];
	}
}

export function saveBoard(entries: BoardEntry[]): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(BOARD_KEY, JSON.stringify(entries));
}

/**
 * Amends a case. A funeral is amended constantly — the cemetery telephones
 * back with a different hour, a bay is swapped, an executor turns out to be
 * settling the account after all — so the console writes to the board rather
 * than only reading it. Returns the board as it now stands.
 */
export function updateBoardEntry(reference: string, patch: Partial<BoardEntry>): BoardEntry[] {
	const entries = loadBoard().map((entry) =>
		entry.reference === reference ? { ...entry, ...patch } : entry
	);
	saveBoard(entries);
	return entries;
}

export function removeBoardEntry(reference: string): BoardEntry[] {
	const entries = loadBoard().filter((entry) => entry.reference !== reference);
	saveBoard(entries);
	return entries;
}

/**
 * Writes the demonstration cases onto the board the first time the console is
 * opened, so the work already in the building is editable like anything else
 * rather than re-appearing from a constant on every render.
 *
 * The marker is kept apart from the board itself: a director who clears the
 * board should not find the same three cases back tomorrow morning.
 */
export function seedBoardOnce(entries: BoardEntry[]): BoardEntry[] {
	if (typeof localStorage === 'undefined') return [];
	if (localStorage.getItem(BOARD_SEEDED_KEY)) return loadBoard();
	const existing = loadBoard();
	const known = new Set(existing.map((entry) => entry.reference));
	const merged = [...existing, ...entries.filter((entry) => !known.has(entry.reference))];
	saveBoard(merged);
	localStorage.setItem(BOARD_SEEDED_KEY, 'yes');
	return merged;
}

/** Empties the board and lets the demonstration cases be laid out again. */
export function resetBoard(): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.removeItem(BOARD_KEY);
	localStorage.removeItem(BOARD_SEEDED_KEY);
}

/** Short, pronounceable, and not a UUID — staff read these aloud. */
export function newReference(diedAt: string, decedentName: string): string {
	const year = new Date(diedAt).getUTCFullYear();
	const initials = decedentName
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('')
		.slice(0, 3);
	// Derived from the name and the date rather than random, so the same case
	// re-entered does not sprout a second reference.
	const digits = Math.abs(hash(`${diedAt}:${decedentName}`)) % 1000;
	return `${year}-${initials || 'XX'}-${String(digits).padStart(3, '0')}`;
}

function hash(input: string): number {
	let value = 0;
	for (let index = 0; index < input.length; index += 1) {
		value = (value * 31 + input.charCodeAt(index)) | 0;
	}
	return value;
}
