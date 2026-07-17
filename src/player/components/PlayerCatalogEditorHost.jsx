import React, { Suspense, useRef } from 'react';

import OverlaySurface from '../../shared/overlays/OverlaySurface';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';

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
        </OverlaySurface>
    );
}
