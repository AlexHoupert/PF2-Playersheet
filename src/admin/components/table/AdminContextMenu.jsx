import React from 'react';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';

export default function AdminContextMenu({
    children,
    actions = [],
    onAction,
    contentClassName = 'w-48',
    actionTestIdPrefix = '',
}) {
    return (
        <ContextMenu modal={false}>
            <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
            <ContextMenuContent
                avoidCollisions
                collisionPadding={8}
                sticky="always"
                className={cn(
                    'data-open:zoom-in-100 data-closed:zoom-out-100',
                    contentClassName
                )}
            >
                {actions.filter(Boolean).map((action, index) => (
                    <ActionNode
                        key={action.id || action.label || index}
                        action={action}
                        actionTestIdPrefix={actionTestIdPrefix}
                        onAction={onAction}
                    />
                ))}
            </ContextMenuContent>
        </ContextMenu>
    );
}

function ActionNode({ action, actionTestIdPrefix, onAction }) {
    const testId = actionTestIdPrefix && action.id
        ? `${actionTestIdPrefix}-${action.id}`
        : undefined;
    const content = (
        <>
            {action.icon ? <action.icon data-icon="inline-start" /> : null}
            {action.label}
        </>
    );

    if (action.children?.filter(Boolean).length) {
        return (
            <React.Fragment>
                {action.separatorBefore ? <ContextMenuSeparator /> : null}
                <ContextMenuSub>
                    <ContextMenuSubTrigger disabled={action.disabled} data-testid={testId}>
                        {content}
                    </ContextMenuSubTrigger>
                    <ContextMenuSubContent
                        avoidCollisions
                        collisionPadding={8}
                        sticky="always"
                        sideOffset={4}
                        className="max-h-[min(24rem,var(--radix-context-menu-content-available-height))] min-w-44 overflow-y-auto"
                    >
                        {action.children.filter(Boolean).map((child, index) => (
                            <ActionNode
                                key={child.id || child.label || index}
                                action={child}
                                actionTestIdPrefix={actionTestIdPrefix}
                                onAction={onAction}
                            />
                        ))}
                    </ContextMenuSubContent>
                </ContextMenuSub>
            </React.Fragment>
        );
    }

    return (
        <React.Fragment>
            {action.separatorBefore ? <ContextMenuSeparator /> : null}
            <ContextMenuItem
                disabled={action.disabled}
                variant={action.danger ? 'destructive' : 'default'}
                data-testid={testId}
                onSelect={(event) => {
                    event.preventDefault();
                    action.onSelect?.();
                    onAction?.(action);
                }}
            >
                {content}
            </ContextMenuItem>
        </React.Fragment>
    );
}
