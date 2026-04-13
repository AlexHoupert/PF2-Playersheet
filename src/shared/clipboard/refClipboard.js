/**
 * refClipboard — Cross-context "Copy Reference" system.
 *
 * A reference is: { type: 'ability'|'creature'|'spell'|'item', name, data }
 *
 * copyRef() writes to both the module's in-memory slot AND the system clipboard
 * as a JSON string so references survive cross-window paste (Ctrl+V).
 *
 * readRef() tries the system clipboard first (enables cross-window),
 * falls back to the in-memory slot (same-tab fallback).
 *
 * Consumers can subscribe to in-memory changes via onRefChange().
 */

const MARKER = '_pf2ref';

let _inMemory = null;
const _listeners = new Set();

function notify() {
    _listeners.forEach(fn => fn(_inMemory));
}

/**
 * Store a reference and write it to the system clipboard.
 * @param {'ability'|'creature'|'spell'|'item'} type
 * @param {object} data  — the full object (ability, creature index item, etc.)
 */
export function copyRef(type, data) {
    _inMemory = { type, name: data.name || '', data };
    notify();
    const json = JSON.stringify({ [MARKER]: 1, type, name: data.name || '', data });
    navigator.clipboard.writeText(json).catch(() => {
        // Clipboard API unavailable (non-HTTPS, permissions denied) — in-memory only
    });
}

/** Synchronously return the in-memory reference (same tab). */
export function getInMemoryRef() {
    return _inMemory;
}

/**
 * Async read: tries system clipboard first (cross-window), falls back to in-memory.
 * Returns null if clipboard is empty or not a pf2 reference.
 */
export async function readRef() {
    try {
        const text = await navigator.clipboard.readText();
        if (text && text.includes(`"${MARKER}"`)) {
            const parsed = JSON.parse(text);
            if (parsed[MARKER] && parsed.type && parsed.data) {
                return { type: parsed.type, name: parsed.name || '', data: parsed.data };
            }
        }
    } catch {
        // readText requires user gesture permission or HTTPS; fall through
    }
    return _inMemory;
}

/**
 * Subscribe to in-memory reference changes (same tab only).
 * Returns an unsubscribe function.
 */
export function onRefChange(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}

/** Clear both in-memory and (best-effort) clipboard. */
export function clearRef() {
    _inMemory = null;
    notify();
    navigator.clipboard.writeText('').catch(() => {});
}
