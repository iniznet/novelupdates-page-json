import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { extractSeriesPage, SCHEMA } from '../src/extract.js';

/**
 * The extension is held to the backend parser's own output
 * (iniznet/fenrirealm-tracker#588).
 *
 * `series-page.expected.json` is generated once by App\Support\NovelUpdates\SeriesPageParser
 * from the same fixture, so a selector that moves in one implementation turns this
 * red instead of shipping half a draft.
 */
const html = readFileSync(new URL('./fixtures/series-page.html', import.meta.url), 'utf8');
const expected = JSON.parse(
	readFileSync(new URL('./fixtures/series-page.expected.json', import.meta.url), 'utf8')
);

const URL_ON_NU = 'https://www.novelupdates.com/series/solo-leveling/';

function docOf(markup = html, url = URL_ON_NU) {
	return new JSDOM(markup, { url }).window.document;
}

describe('extractSeriesPage', () => {
	it('produces the same fields the backend parser reads off the same page', () => {
		const page = extractSeriesPage(docOf());

		expect(page).not.toBeNull();
		expect(page.schema).toBe(SCHEMA);

		// Everything but the synopsis: the API sanitizes that HTML on arrival, so the
		// extension ships the page's own markup and the golden holds the allowlisted form.
		for (const key of [
			'title',
			'alt_titles',
			'raw_type',
			'raw_status',
			'raw_language',
			'release_year',
			'genre_names',
			'tag_names',
			'cover_url',
			'nu_series_id',
			'source_url'
		]) {
			expect(page[key], key).toEqual(expected[key]);
		}
	});

	it('ships the synopsis as the page holds it', () => {
		const page = extractSeriesPage(docOf());

		expect(page.description_html).toContain('Hunters');
		expect(page.description_html).toContain('<p>');
	});

	it('answers null on a page that is not a series page', () => {
		const challenge = docOf(
			'<html><body><h1>Just a moment...</h1></body></html>',
			'https://www.novelupdates.com/series/solo-leveling/'
		);

		expect(extractSeriesPage(challenge)).toBeNull();
	});

	it('answers null when the tab is not a series URL', () => {
		expect(extractSeriesPage(docOf(html, 'https://www.novelupdates.com/'))).toBeNull();
	});

	it('caps a hostile list instead of forwarding it', () => {
		const many = Array.from({ length: 150 }, (_, index) => `Tag ${index}`)
			.map((name) => `<a href="#">${name}</a>`)
			.join('');

		const page = extractSeriesPage(
			docOf(`<html><body class="postid-1">
				<div class="seriestitlenu">T</div>
				<div id="showtags">${many}</div>
			</body></html>`)
		);

		expect(page.tag_names).toHaveLength(100);
	});

	it('never returns a future release year', () => {
		const page = extractSeriesPage(
			docOf(`<html><body class="postid-1">
				<div class="seriestitlenu">T</div>
				<div id="edityear">${new Date().getFullYear() + 5}</div>
			</body></html>`)
		);

		expect(page.release_year).toBeNull();
	});

	it('forces the cover onto https so the panel preview is not blocked', () => {
		const page = extractSeriesPage(
			docOf(`<html><body class="postid-1">
				<div class="seriestitlenu">T</div>
				<div class="seriesimg"><img src="http://cdn.novelupdates.com/a.jpg" /></div>
			</body></html>`)
		);

		expect(page.cover_url).toBe('https://cdn.novelupdates.com/a.jpg');
	});
});
