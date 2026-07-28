import React from 'react';
import { Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PlayerCatalogActionBar({
    addLabel,
    addTestId,
    onAdd,
    createLabel,
    onCreate,
    editLabel,
    editMode = false,
    onEditModeChange,
    leadingActions = [],
}) {
    return (
        <div className="mt-5 grid w-full grid-flow-col auto-cols-fr gap-2" data-testid="player-catalog-action-bar">
            {onAdd ? (
                <Button
                    type="button"
                    data-testid={addTestId}
                    variant="outline"
                    className="w-full min-w-0"
                    onClick={onAdd}
                >
                    <Plus data-icon="inline-start" className="text-[var(--accent-green)]" />
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
                        className="w-full min-w-0"
                        onClick={action.onClick}
                    >
                        {Icon ? <Icon data-icon="inline-start" /> : null}
                        {action.label}
                    </Button>
                );
            })}
            {onCreate ? (
                <Button type="button" variant="outline" className="w-full min-w-0" onClick={onCreate}>
                    {createLabel || 'Create'}
                </Button>
            ) : null}
            {onEditModeChange ? (
                <Button
                    type="button"
                    variant={editMode ? 'default' : 'outline'}
                    className="w-full min-w-0"
                    aria-pressed={editMode}
                    onClick={() => onEditModeChange(!editMode)}
                >
                    <Pencil data-icon="inline-start" />
                    {editLabel || 'Edit'}
                </Button>
            ) : null}
        </div>
    );
}
