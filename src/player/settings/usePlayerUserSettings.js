import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizePlayerUserSettings } from './playerUserSettings';

export function usePlayerUserSettings({ remoteSettings, onPersist }) {
    const normalizedRemoteSettings = useMemo(
        () => normalizePlayerUserSettings(remoteSettings),
        [remoteSettings]
    );
    const remoteSignature = JSON.stringify(normalizedRemoteSettings);
    const [settings, setSettings] = useState(normalizedRemoteSettings);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const settingsRef = useRef(normalizedRemoteSettings);
    const requestIdRef = useRef(0);
    const pendingCountRef = useRef(0);

    useEffect(() => {
        if (pendingCountRef.current > 0) return;
        settingsRef.current = normalizedRemoteSettings;
        setSettings(normalizedRemoteSettings);
    }, [remoteSignature]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateSettings = useCallback(async (updater) => {
        const previous = settingsRef.current;
        const candidate = typeof updater === 'function' ? updater(previous) : updater;
        const next = normalizePlayerUserSettings(candidate);
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        pendingCountRef.current += 1;
        settingsRef.current = next;
        setSettings(next);
        setSaving(true);
        setError(null);

        try {
            await onPersist?.(next);
            return next;
        } catch (updateError) {
            if (requestIdRef.current === requestId) {
                settingsRef.current = previous;
                setSettings(previous);
                setError(updateError?.message || 'Could not save player settings.');
            }
            throw updateError;
        } finally {
            pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
            if (requestIdRef.current === requestId) setSaving(false);
        }
    }, [onPersist]);

    return {
        error,
        saving,
        settings,
        updateSettings,
    };
}
