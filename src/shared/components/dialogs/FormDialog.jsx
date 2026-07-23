import React from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppDialogShell from './AppDialogShell';

export default function FormDialog({
    formId,
    submitLabel = 'Save',
    cancelLabel = 'Cancel',
    pending = false,
    submitDisabled = false,
    showSubmit = true,
    onSubmit,
    ...dialogProps
}) {
    const footer = ({ requestClose }) => (
        <>
            <Button type="button" variant="outline" disabled={pending} onClick={() => requestClose('cancel')}>
                {cancelLabel}
            </Button>
            {showSubmit ? (
                <Button
                    type={formId ? 'submit' : 'button'}
                    form={formId}
                    disabled={pending || submitDisabled}
                    onClick={formId ? undefined : onSubmit}
                >
                    {pending ? <LoaderCircle data-icon="inline-start" className="animate-spin" /> : null}
                    {pending ? 'Saving...' : submitLabel}
                </Button>
            ) : null}
        </>
    );

    return (
        <AppDialogShell
            {...dialogProps}
            footer={footer}
            showDefaultClose={false}
            closeLabel={cancelLabel}
        />
    );
}
