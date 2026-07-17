import { useState } from 'react';
import { Check, ShieldQuestion, X } from 'lucide-react';

import { useCampaign } from '../../shared/context/CampaignContext';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';

export default function EffectRequestCenter() {
    const { activeCampaign, capabilities, dataActions, effectRequests } = useCampaign();
    const { notifyError, notifySuccess } = useAppFeedback();
    const [open, setOpen] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const pending = (effectRequests || []).filter(request => request.status === 'pending');

    if (!capabilities.canViewEffectRequests || pending.length === 0) return null;

    const decide = async (request, decision) => {
        setBusyId(request.id);
        try {
            if (decision === 'approve') {
                await dataActions.effect.approveEffectRequest(activeCampaign.id, request.id);
                notifySuccess(`${request.definitionSnapshot?.label || 'Effect'} approved.`);
            } else {
                await dataActions.effect.rejectEffectRequest(activeCampaign.id, request.id);
                notifySuccess('Effect request rejected.');
            }
        } catch (error) {
            notifyError(error);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-[2500]">
            <button type="button" className="set-btn flex items-center gap-2 shadow-lg" onClick={() => setOpen(value => !value)}>
                <ShieldQuestion size={17} /> Effect Requests <span className="rounded bg-black/30 px-1.5">{pending.length}</span>
            </button>
            {open && (
                <div className="absolute bottom-12 right-0 max-h-[65vh] w-[min(26rem,calc(100vw-2rem))] overflow-auto rounded border border-border bg-card p-3 shadow-2xl">
                    <div className="mb-2 flex items-center justify-between"><strong>Pending Effect Requests</strong><button type="button" className="bg-transparent p-1" onClick={() => setOpen(false)} aria-label="Close"><X size={16} /></button></div>
                    <div className="space-y-2">
                        {pending.map(request => (
                            <article key={request.id} className="rounded border border-border p-3">
                                <strong className="text-primary">{request.definitionSnapshot?.label || 'Actor Effect'}</strong>
                                <div className="mt-1 text-sm text-muted-foreground">From {request.source?.name || request.createdBy}</div>
                                <div className="mt-2 text-sm">Targets: {(request.targets || []).map(target => target.name).join(', ')}</div>
                                <div className="mt-3 flex justify-end gap-2">
                                    <button type="button" className="nav-btn flex items-center gap-1" disabled={!capabilities.canDecideEffectRequests || busyId === request.id} onClick={() => decide(request, 'reject')}><X size={14} /> Reject</button>
                                    <button type="button" className="set-btn flex items-center gap-1" disabled={!capabilities.canDecideEffectRequests || busyId === request.id} onClick={() => decide(request, 'approve')}><Check size={14} /> Approve</button>
                                </div>
                                {!capabilities.canDecideEffectRequests && <small className="mt-2 block text-muted-foreground">Assistant GMs can inspect requests but only the GM can decide them.</small>}
                            </article>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
