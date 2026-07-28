import React from 'react';
import { Pencil } from 'lucide-react';

export default function PlayerCatalogEditMarker({ label }) {
    return (
        <span
            className="ml-2 inline-flex size-4 shrink-0 items-center justify-center text-primary"
            aria-label={`Edit ${label}`}
            title={`Edit ${label}`}
        >
            <Pencil className="size-3" aria-hidden="true" />
        </span>
    );
}
