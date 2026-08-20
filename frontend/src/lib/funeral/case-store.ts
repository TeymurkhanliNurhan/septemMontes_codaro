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
	localStorage.setItem(BOARD_KEY, JSON.stringify(entries));
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
