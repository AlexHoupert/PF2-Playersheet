import React from 'react';
import { ActorSheetCard } from '../../shared/components/ActorSheetCard';

export function CharacterCard(props) {
    return (
        <ActorSheetCard
            mode="gm"
            capabilities={{
                editable: true,
                showInventory: true,
                showMagic: true,
                showPacts: true,
                allowShop: false,
                allowLoot: true,
            }}
            {...props}
        />
    );
}
