import { useMemo, useState } from 'react';

import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';

const OPERATIONS = ['create', 'fork', 'override', 'update', 'hide', 'delete', 'promote', 'revert'];

export default function CampaignChangesView() {
    const { activeCampaign, capabilities, catalogChangeEvents, dataActions } = useCampaign();
    const { confirm, notifyError, notifySuccess } = useAppFeedback();
    const [filters, setFilters] = useState({ search: '', role: '', catalogType: '', operation: '', since: '' });
    const [busyId, setBusyId] = useState(null);

    const events = useMemo(() => {
        const search = filters.search.trim().toLowerCase();
        const since = filters.since ? new Date(`${filters.since}T00:00:00`).getTime() : null;
        return [...(catalogChangeEvents || [])]
            .filter(event => !filters.role || event.actorRole === filters.role)
            .filter(event => !filters.catalogType || event.catalogType === filters.catalogType)
            .filter(event => !filters.operation || event.operation === filters.operation)
            .filter(event => !since || new Date(event.createdAt || 0).getTime() >= since)
            .filter(event => !search || [event.actorEmail, event.catalogType, event.operation, event.entryId]
                .some(value => String(value || '').toLowerCase().includes(search)))
            .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    }, [catalogChangeEvents, filters]);

    const roles = useMemo(() => uniqueOptions(catalogChangeEvents, 'actorRole'), [catalogChangeEvents]);
    const catalogTypes = useMemo(() => uniqueOptions(catalogChangeEvents, 'catalogType'), [catalogChangeEvents]);

    const revertEvent = async event => {
        const accepted = await confirm({
            title: 'Revert catalog change',
            message: `Restore the state before ${event.operation} on ${event.entryId}?`,
            confirmLabel: 'Revert',
            danger: true,
        });
        if (!accepted) return;
        setBusyId(event.id);
        try {
            await dataActions.catalog.revertCatalogChange(event.id, { campaignId: activeCampaign?.id });
            notifySuccess('Catalog change reverted.');
        } catch (error) {
            notifyError(error);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-3">
            <header className="rounded border border-border bg-card p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="m-0 text-lg text-primary">Campaign Changes</h2>
                        <p className="m-0 text-sm text-muted-foreground">Immutable catalog audit for {activeCampaign?.name || 'the active campaign'}.</p>
                    </div>
                    <span className="rounded border border-border px-2 py-1 text-sm text-muted-foreground">{events.length} events</span>
                </div>
                <div className="grid gap-2 md:grid-cols-5">
                    <input className="modal-input" value={filters.search} onChange={event => setFilter(setFilters, 'search', event.target.value)} placeholder="Search user or entry..." />
                    <FilterSelect label="All roles" value={filters.role} options={roles} onChange={value => setFilter(setFilters, 'role', value)} />
                    <FilterSelect label="All catalogs" value={filters.catalogType} options={catalogTypes} onChange={value => setFilter(setFilters, 'catalogType', value)} />
                    <FilterSelect label="All operations" value={filters.operation} options={OPERATIONS} onChange={value => setFilter(setFilters, 'operation', value)} />
                    <input className="modal-input" type="date" value={filters.since} onChange={event => setFilter(setFilters, 'since', event.target.value)} aria-label="Changed since" />
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-auto rounded border border-border bg-card">
                <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 z-10 bg-[#272727] text-left text-muted-foreground">
                        <tr><th className="p-3">When</th><th className="p-3">Author</th><th className="p-3">Change</th><th className="p-3">Entry</th><th className="p-3 text-right">Action</th></tr>
                    </thead>
                    <tbody>
                        {events.map(event => (
                            <tr key={event.id} className="border-t border-border/40 align-top">
                                <td className="p-3 whitespace-nowrap">{formatDate(event.createdAt)}</td>
                                <td className="p-3"><div>{event.actorEmail || 'Unknown'}</div><small className="text-muted-foreground">{event.actorRole || 'unknown role'}</small></td>
                                <td className="p-3"><strong>{event.operation}</strong><div className="text-muted-foreground">{event.catalogType || '-'}</div></td>
                                <td className="p-3">
                                    <div>{event.after?.name || event.after?.label || event.before?.name || event.before?.label || event.entryId}</div>
                                    <details className="mt-1 text-xs text-muted-foreground">
                                        <summary className="cursor-pointer">Snapshots</summary>
                                        <pre className="mt-2 max-w-[42rem] overflow-auto rounded bg-black/30 p-2">{JSON.stringify({ before: event.before, after: event.after }, null, 2)}</pre>
                                    </details>
                                </td>
                                <td className="p-3 text-right">
                                    <button
                                        type="button"
                                        className="set-btn"
                                        disabled={!capabilities.canRevertCampaignChanges || Boolean(event.revertedAt) || event.operation === 'revert' || busyId === event.id}
                                        onClick={() => revertEvent(event)}
                                    >
                                        {event.revertedAt ? 'Reverted' : busyId === event.id ? 'Reverting...' : 'Revert'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {events.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-muted-foreground">No catalog changes match these filters.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function FilterSelect({ label, value, options, onChange }) {
    return (
        <select className="modal-input" value={value} onChange={event => onChange(event.target.value)}>
            <option value="">{label}</option>
            {options.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
    );
}

function uniqueOptions(events, field) {
    return [...new Set((events || []).map(event => event?.[field]).filter(Boolean))].sort();
}

function setFilter(setter, field, value) {
    setter(current => ({ ...current, [field]: value }));
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
