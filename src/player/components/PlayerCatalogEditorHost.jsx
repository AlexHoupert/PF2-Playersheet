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
    const editorMode = request.baseEntry ? 'clone' : 'create';

    const saveEntry = async override => {
        savedEntryIdRef.current = await dataActions.catalog.saveCatalogOverride({
            ...override,
            mode: 'custom',
            origin: request.baseEntry ? 'fork' : 'custom',
        });
        return savedEntryIdRef.current;
    };

    const finish = async result => {
        notifySuccess(`${request.catalogType} saved for this campaign.`);
        await onSaved?.({
            catalogType: request.catalogType,
            entryId: savedEntryIdRef.current,
            linkInventoryItem: request.linkInventoryItem || null,
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
            contentStyle={{ width: 'min(1120px, 100%)', height: 'calc(100dvh - 24px)', maxHeight: 'calc(100dvh - 24px)' }}
            contentClassName="p-0"
        >
            <div className="flex h-full min-h-0 flex-col bg-[#222]">
                {!request.baseEntry && (
                    <div className="flex items-center gap-3 border-b border-border bg-background/95 px-5 py-3">
                        <Checkbox
                            id="player-catalog-add-to-actor"
                            data-testid="player-catalog-add-to-actor"
                            checked={addToActor}
                            onCheckedChange={checked => setAddToActor(checked === true)}
                        />
                        <Label htmlFor="player-catalog-add-to-actor" className="cursor-pointer text-sm font-medium">
                            {PLAYER_CATALOG_ATTACH_LABELS[request.catalogType] || 'Add to my character'}
                        </Label>
                    </div>
                )}
                <div className="min-h-0 flex-1">
                    <Suspense fallback={<div className="p-6 text-muted-foreground">Loading editor...</div>}>
                        <Editor
                            catalogType={request.catalogType}
                            editorMode={editorMode}
                            baseEntry={request.baseEntry || null}
                            initialItem={request.baseEntry || null}
                            onSave={finish}
                            onCancel={onClose}
                            onSaveCatalogEntry={saveEntry}
                            onSaveToDb={saveEntry}
                            dbOnly
                        />
                    </Suspense>
                </div>
            </div>
        </OverlaySurface>
    );
}
