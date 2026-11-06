import { extractSeriesPage } from './extract.js';

/**
 * Read the active tab, show what was found, put the JSON on the clipboard.
 *
 * No network, no storage, no login: the page is read in the tab the staff member
 * already has open, and only the extracted fields leave it.
 */
const api = globalThis.browser ?? globalThis.chrome;

const statusNode = document.getElementById('status');
const summaryNode = document.getElementById('summary');
const copyButton = document.getElementById('copy');

let payload = null;

function say(message, isError = false) {
	statusNode.textContent = message;
	statusNode.className = isError ? 'error' : 'muted';
}

function summarize(page) {
	const rows = [
		`Title: ${page.title}`,
		`Genres: ${page.genre_names.length}`,
		`Tags: ${page.tag_names.length}`,
		`Type: ${page.raw_type ?? 'none'}`,
		`Status: ${page.raw_status ?? 'none'}`,
		`Year: ${page.release_year ?? 'none'}`,
		`Cover: ${page.cover_url ? 'yes' : 'none'}`
	];

	summaryNode.replaceChildren(
		...rows.map((row) => {
			const item = document.createElement('li');
			item.textContent = row;

			return item;
		})
	);
	summaryNode.hidden = false;
}

async function read() {
	try {
		const [tab] = await api.tabs.query({ active: true, currentWindow: true });

		if (!tab?.id) {
			say('No active tab to read.', true);
			return;
		}

		if (!/novelupdates\.com/.test(tab.url ?? '')) {
			say('Open a Novel Updates series page first.', true);
			return;
		}

		const [injected] = await api.scripting.executeScript({
			target: { tabId: tab.id },
			func: extractSeriesPage
		});

		payload = injected?.result ?? null;
	} catch (error) {
		say(`Could not read this tab: ${error.message}`, true);
		return;
	}

	if (!payload) {
		say('This is not a Novel Updates series page. Open the series, then try again.', true);
		return;
	}

	summarize(payload);
	say('Ready. Copy the JSON, then paste it into the series form.');
	copyButton.disabled = false;
}

copyButton.addEventListener('click', async () => {
	if (!payload) return;

	try {
		await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
		say('Copied. Paste it into the series form.');
	} catch (error) {
		say(`Could not copy: ${error.message}`, true);
	}
});

read();
