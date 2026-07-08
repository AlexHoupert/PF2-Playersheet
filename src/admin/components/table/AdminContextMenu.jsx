import React from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';

export default function AdminContextMenu({
    children,
    actions = [],
    onAction,
    contentClassName = 'w-48',
    actionTestIdPrefix = '',
}) {
    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
            <ContextMenuContent className={contentClassName}>
                {actions.filter(Boolean).map((action, index) => (
                    <React.Fragment key={action.id || action.label || index}>
                        {action.separatorBefore ? <ContextMenuSeparator /> : null}
                        <ContextMenuItem
                            disabled={action.disabled}
                            variant={action.danger ? 'destructive' : 'default'}
                            data-testid={actionTestIdPrefix && action.id ? `${actionTestIdPrefix}-${action.id}` : undefined}
                            onSelect={(event) => {
                                event.preventDefault();
                                action.onSelect?.();
                                onAction?.(action);
                            }}
                        >
                            {action.label}
                        </ContextMenuItem>
                    </React.Fragment>
                ))}
            </ContextMenuContent>
        </ContextMenu>
    );
}
