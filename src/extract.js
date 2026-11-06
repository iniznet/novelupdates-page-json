/**
 * Novel Updates series page -> one JSON object a series form can fill from
 * (`schema: nu.series.page/1`).
 *
 * `extractSeriesPage` is self-contained on purpose: Chrome and Firefox serialize a
 * function's source when it is injected with scripting.executeScript, so it must
 * not close over anything at module scope. A closed-over name becomes a
 * ReferenceError in the page, and the popup then reports "not a series page"
 * instead of the real fault. `SCHEMA` is exported for the tests, and the same
 * literal sits inside the function because nothing else survives the trip.
 *
 * The selectors mirror the consumer's server-side parser: one page shape, two
 * readers, and a golden fixture that fails when they drift.
 */
export const SCHEMA = 'nu.series.page/1';

export function extractSeriesPage(doc, sourceUrl) {
	doc = doc || (typeof document === 'undefined' ? null : document);

	if (!doc) return null;

	// The function's own copy: module scope does not exist in the page.
	const schema = 'nu.series.page/1';

	const LIMITS = {
		title: 512,
		altTitles: 20,
		description: 200000,
		terms: 100,
		term: 128,
		url: 2000
	};

	const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');
	const cap = (value, max) => (value.length > max ? value.slice(0, max) : value);
	const textOf = (node) => trimmed(node ? node.textContent : '');

	/** Link texts, trimmed, de-duplicated, capped. */
	const linkTexts = (selector) => {
		const out = [];

		for (const node of doc.querySelectorAll(selector)) {
			const term = cap(textOf(node), LIMITS.term);

			if (term === '' || out.includes(term)) continue;

			out.push(term);

			if (out.length >= LIMITS.terms) break;
		}

		return out;
	};

	const title = cap(textOf(doc.querySelector('div.seriestitlenu')), LIMITS.title);

	// No title means a challenge page, a 404, or something that is not a series.
	if (title === '') return null;

	const associated = doc.querySelector('#editassociated');

	const altTitles = [];

	if (associated) {
		const lines = associated.innerHTML
			.split(/<br\s*\/?>/i)
			.join('\n')
			.replace(/<[^>]*>/g, '')
			.split('\n');

		for (const raw of lines) {
			const name = cap(trimmed(raw.replace(/&nbsp;/g, ' ')), LIMITS.title);

			if (name === '') continue;
			if (name.toLowerCase() === title.toLowerCase()) continue;
			if (altTitles.some((existing) => existing.toLowerCase() === name.toLowerCase())) continue;

			altTitles.push(name);

			if (altTitles.length >= LIMITS.altTitles) break;
		}
	}

	const description = doc.querySelector('#editdescription');
	const descriptionHtml = description ? cap(trimmed(description.innerHTML), LIMITS.description) : null;

	// NU prints the status inside the chapter-count block:
	// "Main Story: 243 Chapters (complete)". The Main Story line wins.
	let rawStatus = null;

	const statusNode = doc.querySelector('#editstatus');

	if (statusNode) {
		const segments = statusNode.innerHTML.split(/<br\s*\/?>/i);

		for (const segment of segments) {
			const match = segment.replace(/<[^>]*>/g, '').match(/\(([^)]+)\)/);

			if (!match) continue;

			const word = match[1].trim().toLowerCase();

			if (word !== '') {
				rawStatus = word;
				break;
			}
		}
	}

	// A year in the future is bad data, not a release plan.
	let releaseYear = null;
	const yearNode = doc.querySelector('#edityear');
	const yearMatch = yearNode ? textOf(yearNode).match(/\b(1[89]\d{2}|20\d{2})\b/) : null;

	if (yearMatch) {
		const year = Number.parseInt(yearMatch[1], 10);

		if (year <= new Date().getFullYear()) releaseYear = year;
	}

	// Mixed content would make the panel's preview blank on https.
	const coverNode = doc.querySelector('div.seriesimg img');
	let coverUrl = coverNode ? trimmed(coverNode.getAttribute('src')) : '';

	if (!/^https?:\/\//i.test(coverUrl)) {
		coverUrl = null;
	} else {
		coverUrl = cap(coverUrl.replace(/^http:\/\//i, 'https://'), LIMITS.url);
	}

	let nuSeriesId = null;
	const bodyClass = doc.body ? String(doc.body.className || '') : '';
	const idMatch = bodyClass.match(/\bpostid-(\d+)\b/);

	if (idMatch) nuSeriesId = idMatch[1];

	// The page can be reached through a redirect, so the slug comes from the URL
	// rather than from a link on the page.
	const base = trimmed(sourceUrl || doc.baseURI || doc.location?.href || '');
	const slug = (() => {
		try {
			return new URL(base).pathname.match(/\/series\/([^/]+)/)?.[1] ?? '';
		} catch {
			return '';
		}
	})();

	if (slug === '') return null;

	return {
		schema,
		source_url: 'https://www.novelupdates.com/series/' + slug + '/',
		title,
		alt_titles: altTitles,
		description_html: descriptionHtml,
		raw_type: doc.querySelector('#showtype a') ? textOf(doc.querySelector('#showtype a')) || null : null,
		raw_status: rawStatus,
		raw_language: doc.querySelector('#showlang a') ? textOf(doc.querySelector('#showlang a')) || null : null,
		release_year: releaseYear,
		genre_names: linkTexts('#seriesgenre a'),
		tag_names: linkTexts('#showtags a'),
		cover_url: coverUrl,
		nu_series_id: nuSeriesId
	};
}
