export function normalizeResourceSourceFile(sourceFile) {
    return String(sourceFile || '')
        .replace(/\\/g, '/')
        .replace(/^\/+/, '')
        .replace(/^api\/static\/+/i, '')
        .replace(/^ressources\/+/i, '');
}

export function getResourceCandidateUrls(sourceFile, { isProd = false } = {}) {
    const normalized = normalizeResourceSourceFile(sourceFile);
    if (!normalized) return [];
    const devUrl = `/api/static/${normalized}`;
    const staticUrl = `/ressources/${normalized}`;
    return isProd ? [staticUrl, devUrl] : [devUrl, staticUrl];
}

export async function fetchJsonFromResourceCandidates(sourceFile, { fetchImpl = fetch, isProd = false } = {}) {
    const urls = getResourceCandidateUrls(sourceFile, { isProd });
    if (!urls.length) return null;

    const errors = [];
    for (const url of urls) {
        let response;
        let text = '';
        try {
            response = await fetchImpl(encodeURI(url), {
                headers: { Accept: 'application/json' },
            });
            text = await response.text();
        } catch (err) {
            errors.push(`${url}: ${err.message}`);
            continue;
        }

        if (!response.ok) {
            errors.push(`${url}: HTTP ${response.status} ${response.statusText}`);
            continue;
        }

        try {
            return JSON.parse(text);
        } catch (err) {
            const snippet = text.replace(/\s+/g, ' ').slice(0, 90);
            errors.push(`${url}: invalid JSON (${snippet || err.message})`);
        }
    }

    throw new Error(`Failed to load JSON "${sourceFile}". Tried ${urls.join(', ')}. ${errors.join(' | ')}`);
}
