// Ported from https://github.com/g0rgonus/swimparse @ dc872a5 (MIT).
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `MMDDYYYY` (or windowed `MMDDYY`) to ISO; `undefined` when blank or zeroed. */
export function isoFromMmddyyyy(raw: string): string | undefined {
	const d = raw.trim();
	if (d.length === 8) {
		const mm = d.slice(0, 2);
		const dd = d.slice(2, 4);
		const yyyy = d.slice(4, 8);
		if (!/^\d{8}$/.test(d) || yyyy === '0000' || mm === '00') return undefined;
		return `${yyyy}-${mm}-${dd}`;
	}
	if (d.length === 6 && /^\d{6}$/.test(d)) {
		const yy = Number.parseInt(d.slice(4, 6), 10);
		const yyyy = yy < 30 ? 2000 + yy : 1900 + yy;
		return `${yyyy}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
	}
	return undefined;
}

export function mmddyyyyFromIso(iso: string): string {
	const match = ISO_DATE.exec(iso);
	if (!match) throw new Error(`Invalid ISO date: "${iso}"`);
	const [, yyyy, mm, dd] = match as unknown as [string, string, string, string];
	return `${mm}${dd}${yyyy}`;
}
