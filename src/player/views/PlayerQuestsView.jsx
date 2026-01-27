import React, { useState } from 'react';
import QuestCodex from '../components/QuestCodex';

export default function PlayerQuestsView({ quests = [] }) {
    // Filter out hidden quests - players should never see these
    const visibleQuests = quests.filter(q => q.status !== 'Hidden');

    // We can pass a toggle handler here if we want players to be able to mark objectives locally
    // For now, read-only or local toggle ref props

    // NOTE: The original QuestCard had "onToggleObjective" but the Admin view didn't seem to pass a persisted handler for players.
    // If the data is read-only for players, we just pass null.
    // If we want interactivity, we need to lift that state up or assume read-only.
    // The previous view didn't have objective toggling enabled for players (it was filtered out or read-only).

    // Actually, looking at previous code, `QuestCard` had `onEdit` but not `onToggleObjective` explicitly wired for players in `PlayerQuestsView`.
    // The Codex style implies interactivity (checkboxes). 
    // Let's allow local optimistic toggling or dummy handler for now unless we have a `toggleQuestObjective` function available.
    // Since `PlayerApp` passes `db.quests`, we can't easily write back without a setDb prop.
    // I'll leave `onToggleObjective` undefined for now so they render but aren't persisted, OR pass a dummy.
    // Actually, the new `QuestCodexItem` effectively uses `li onClick`.

    return (
        <div className="player-quests-view" style={{ paddingBottom: 100 }}>
            <QuestCodex quests={visibleQuests} />
        </div>
    );
}
