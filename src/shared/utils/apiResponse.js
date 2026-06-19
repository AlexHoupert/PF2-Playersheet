export async function readJsonApiResponse(response, context = 'API request') {
    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch (err) {
            const snippet = text.replace(/\s+/g, ' ').slice(0, 120);
            throw new Error(`${context} returned non-JSON response (${response.status} ${response.statusText}): ${snippet}`);
        }
    }

    if (!response.ok) {
        const message = data?.error || data?.message || `${response.status} ${response.statusText}`;
        throw new Error(`${context} failed: ${message}`);
    }

    return data ?? {};
}
