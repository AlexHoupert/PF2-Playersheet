import React from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CatalogEditorShell({
    title,
    description,
    loadingMessage,
    error,
    pending = false,
    saveLabel = 'Save',
    saveTestId,
    onSave,
    onCancel,
    children,
    className,
}) {
    return (
        <section className={cn('grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-background', className)}>
            <header className="border-b border-border/70 px-5 py-4">
                <h2 className="font-heading text-xl text-primary">{title}</h2>
                {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </header>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-5">
                {loadingMessage ? <div className="mb-4 text-sm text-primary">{loadingMessage}</div> : null}
                {error ? <div role="alert" className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
                <div className="space-y-5">{children}</div>
            </div>

            <footer className="flex justify-end gap-2 border-t border-border/70 bg-muted/40 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
                <Button type="button" data-testid={saveTestId} onClick={onSave} disabled={pending}>
                    {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                    {pending ? 'Saving...' : saveLabel}
                </Button>
            </footer>
        </section>
    );
}

export function EditorSection({ title, description, children, className }) {
    return (
        <section className={cn('space-y-3 border-t border-border/60 pt-4 first:border-t-0 first:pt-0', className)}>
            {title ? (
                <div>
                    <h3 className="font-heading text-base text-primary">{title}</h3>
                    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
                </div>
            ) : null}
            {children}
        </section>
    );
}

export function EditorFieldRow({ children, className }) {
    return <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>{children}</div>;
}

export default CatalogEditorShell;
