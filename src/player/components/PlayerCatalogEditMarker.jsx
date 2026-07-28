import React from 'react';
import { Pencil } from 'lucide-react';

export default function PlayerCatalogEditMarker({ label }) {
    return (
        <span
            className="ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/60 bg-primary/10 text-primary"
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
        >
            <Pencil className="size-4" aria-hidden="true" />
        </span>
    );
}
