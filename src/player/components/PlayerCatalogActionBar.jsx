import React from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PlayerCatalogActionBar({
    addLabel,
    addTestId,
    onAdd,
    createLabel,
    onCreate,
    editMode = false,
    onEditModeChange,
    leadingActions = [],
}) {
    return (
        <div className="mt-5 flex flex-wrap gap-2" data-testid="player-catalog-action-bar">
            {onAdd ? (
                <Button
                    type="button"
                    data-testid={addTestId}
                    className="bg-emerald-700 text-white hover:bg-emerald-600"
                    onClick={onAdd}
                >
                    <Plus data-icon="inline-start" />
                    {addLabel || 'Add'}
                </Button>
            ) : null}
            {leadingActions.map(action => {
                const Icon = action.icon;
                return (
                    <Button
                        key={action.id || action.label}
                        type="button"
                        variant={action.variant || 'outline'}
                        onClick={action.onClick}
                    >
                        {Icon ? <Icon data-icon="inline-start" /> : null}
                        {action.label}
                    </Button>
                );
            })}
            {onCreate ? (
                <Button type="button" variant="outline" onClick={onCreate}>
                    {createLabel || 'Create'}
                </Button>
            ) : null}
            {onEditModeChange ? (
                <Button
                    type="button"
                    variant={editMode ? 'default' : 'outline'}
                    aria-pressed={editMode}
                    onClick={() => onEditModeChange(!editMode)}
                >
                    <Pencil data-icon="inline-start" />
                    Edit
                </Button>
            ) : null}
        </div>
    );
}
