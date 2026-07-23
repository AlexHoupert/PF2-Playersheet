import React from 'react';
import { Button } from '@/components/ui/button';
import AppDialogShell from './AppDialogShell';

export default function PickerDialog({
    confirmLabel = 'Select',
    cancelLabel = 'Cancel',
    confirmDisabled = false,
    showConfirm = true,
    onConfirm,
    ...dialogProps
}) {
    return (
        <AppDialogShell
            {...dialogProps}
            footer={({ requestClose }) => (
                <>
                    <Button type="button" variant="outline" onClick={() => requestClose('cancel')}>
                        {cancelLabel}
                    </Button>
                    {showConfirm ? (
                        <Button type="button" disabled={confirmDisabled} onClick={onConfirm}>
                            {confirmLabel}
                        </Button>
                    ) : null}
                </>
            )}
            showDefaultClose={false}
        />
    );
}
