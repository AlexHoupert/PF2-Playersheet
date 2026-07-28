import React, { Suspense, useEffect, useRef, useState } from 'react';

import OverlaySurface from '../../shared/overlays/OverlaySurface';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';
import { PLAYER_CATALOG_ATTACH_LABELS } from '../../shared/db/domain/catalogActorReducers';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

const EDITORS = {
    item: React.lazy(() => import('../../admin/editors/ItemEditor')),
    spell: React.lazy(() => import('../../admin/editors/SpellEditor')),
    feat: React.lazy(() => import('../../admin/editors/FeatEditor')),
    impulse: React.lazy(() => import('../../admin/editors/ImpulseEditor')),
    action: React.lazy(() => import('../../admin/editors/ActionEditor')),
};

function capitalize(value) {
    const text = String(value || 'entry');
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function PlayerCatalogEditorHost({ request, dataActions, onClose, onSaved }) {
    const { notifySuccess } = useAppFeedback();
    const savedEntryIdRef = useRef(null);
    const [addToActor, setAddToActor] = useState(true);

    useEffect(() => {
        setAddToActor(true);
        savedEntryIdRef.current = null;
    }, [request?.catalogType, request?.baseEntry]);

    if (!request) return null;

    const Editor = EDITORS[request.catalogType];
    if (!Editor) return null;
    const editorMode = request.editorMode || (request.baseEntry ? 'clone' : 'create');

    const saveEntry = async override => {
        const existingEntry = request.campaignEntry || null;
        savedEntryIdRef.current = await dataActions.catalog.saveCatalogOverride({
            ...override,
            ...(editorMode === 'edit' && existingEntry ? {
                id: existingEntry.id,
                baseId: existingEntry.baseId || override.baseId || null,
                createdAt: existingEntry.createdAt,
                createdBy: existingEntry.createdBy,
                ownerEmail: existingEntry.ownerEmail,
            } : {}),
            mode: 'custom',
            origin: editorMode === 'edit'
                ? existingEntry?.origin || 'custom'
                : request.baseEntry ? 'fork' : 'custom',
        });
        return savedEntryIdRef.current;
    };

    const finish = async result => {
        notifySuccess(`${capitalize(request.catalogType)} saved.`);
        await onSaved?.({
            catalogType: request.catalogType,
            entryId: savedEntryIdRef.current,
            linkInventoryItem: request.linkInventoryItem || null,
            linkCatalogRecord: request.linkCatalogRecord || null,
            override: result?.data || null,
            addToActor: !request.baseEntry && addToActor,
        });
        onClose?.();
    };

    return (
        <OverlaySurface
            id={`player-catalog-editor-${request.catalogType}`}
            active
            onEscape={onClose}
            contentStyle={{ width: 'min(1120px, 100%)', height: 'calc(100dvh - 24px)', maxHeight: 'calc(100dvh - 24px)', background: 'var(--background)' }}
            contentClassName="h-full p-0"
            contentBodyStyle={{ height: '100%', overflow: 'hidden' }}
        >
            <div className="h-full min-h-0 bg-background">
                <Suspense fallback={<div className="p-6 text-muted-foreground">Loading editor...</div>}>
                    <Editor
                        catalogType={request.catalogType}
                        editorMode={editorMode}
                        baseEntry={request.baseEntry || null}
                        initialItem={request.baseEntry || null}
                        headerAction={editorMode === 'create' ? (
                            <div className="flex max-w-[50vw] items-center gap-2">
                                <Checkbox
                                    id="player-catalog-add-to-actor"
                                    data-testid="player-catalog-add-to-actor"
                                    checked={addToActor}
                                    onCheckedChange={checked => setAddToActor(checked === true)}
                                />
                                <Label htmlFor="player-catalog-add-to-actor" className="cursor-pointer text-right text-sm font-medium leading-tight">
                                    {PLAYER_CATALOG_ATTACH_LABELS[request.catalogType] || 'Add to my character'}
                                </Label>
                            </div>
                        ) : null}
                        onSave={finish}
                        onCancel={onClose}
                        onSaveCatalogEntry={saveEntry}
                        onSaveToDb={saveEntry}
                        dbOnly
                    />
                </Suspense>
            </div>
        </OverlaySurface>
    );
}
