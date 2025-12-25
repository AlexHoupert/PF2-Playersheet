import React, { useState } from 'react';
import { useCampaign } from '../../shared/context/CampaignContext';
import { deepClone } from '../../shared/utils/deepClone';

export default function SessionManager({ db, setDb }) {
    const {
        campaigns,
        activeCampaign,
        activeCampaignId,
        createCampaign,
        deleteCampaign,
        setSelectedCampaignId,
        assignUser
    } = useCampaign();

    const [newCampName, setNewCampName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [selectedUserChar, setSelectedUserChar] = useState('');

    // --- QUICK CREATE CHARACTER ---
    const [newCharName, setNewCharName] = useState('');
    const [newCharLvl, setNewCharLvl] = useState(1);
    const [isSpellcaster, setIsSpellcaster] = useState(false);

    // Skeleton Character
    const handleCreateCharacter = () => {
        if (!newCharName || !activeCampaignId) return;

        const newChar = {
            id: crypto.randomUUID(),
            name: newCharName,
            level: parseInt(newCharLvl) || 1,
            initiative: 0,
            stats: {
                hp: { current: 15, max: 15, temp: 0 },
                ac: { value: 10 },
                classDC: { value: 10, label: 'Class DC' },
                perception: { value: 0 },
                saves: {
                    fortitude: { value: 0 },
                    reflex: { value: 0 },
                    will: { value: 0 }
                },
                attributes: {
                    str: 0, dex: 0, con: 0,
                    int: 0, wis: 0, cha: 0
                }
            },
            skills: {
                acrobatics: 0, arcana: 0, athletics: 0, crafting: 0, deception: 0,
                diplomacy: 0, intimidation: 0, medicine: 0, nature: 0, occultism: 0,
                performance: 0, religion: 0, society: 0, stealth: 0, survival: 0, thievery: 0,
                lore: []
            },
            conditions: [],
            feats: [],
            inventory: [],
            weapons: [],
            armor: [],
            spells: isSpellcaster ? {
                focus: { points: 1, max: 1 },
                slots: {
                    "1": { value: 2, max: 2 },
                    "2": { value: 0, max: 0 },
                    "3": { value: 0, max: 0 },
                    "4": { value: 0, max: 0 },
                    "5": { value: 0, max: 0 },
                    "6": { value: 0, max: 0 },
                    "7": { value: 0, max: 0 },
                    "8": { value: 0, max: 0 },
                    "9": { value: 0, max: 0 },
                    "10": { value: 0, max: 0 }
                },
                known: []
            } : null // Null magic hides the tab
        };

        setDb(prev => {
            const next = { ...prev };
            const cmap = { ...next.campaigns[activeCampaignId] };
            const chars = [...(cmap.characters || [])];
            chars.push(newChar);

            next.campaigns[activeCampaignId] = {
                ...cmap,
                characters: chars
            };
            return next;
        });

        setNewCharName('');
        setIsSpellcaster(false);
    };

    const handleDeleteChar = (charId) => {
        if (!activeCampaignId || !confirm('Delete this character?')) return;
        setDb(prev => {
            const next = { ...prev };
            const cmap = next.campaigns[activeCampaignId];
            const chars = cmap.characters.filter(c => c.id !== charId);
            next.campaigns[activeCampaignId] = { ...cmap, characters: chars };
            return next;
        });
    };

    return (
        <div style={{ padding: 20, color: '#e0e0e0' }}>
            <h2>Session Manager</h2>

            {/* CAMPAIGN LIST */}
            <div style={{ marginBottom: 30, background: '#2b2b2e', padding: 15, borderRadius: 8 }}>
                <h3>Campaigns</h3>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10 }}>
                    {(Object.values(campaigns) || []).map(camp => (
                        <div
                            key={camp.id}
                            onClick={() => setSelectedCampaignId(camp.id)}
                            style={{
                                background: activeCampaignId === camp.id ? 'rgba(197, 160, 89, 0.2)' : '#222',
                                border: `1px solid ${activeCampaignId === camp.id ? '#c5a059' : '#444'}`,
                                padding: 15,
                                borderRadius: 8,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                position: 'relative'
                            }}
                        >
                            {activeCampaignId === camp.id && (
                                <div style={{
                                    position: 'absolute', top: -10, right: 10,
                                    background: '#c5a059', color: '#000',
                                    padding: '2px 8px', borderRadius: 4,
                                    fontSize: '0.7em', fontWeight: 'bold'
                                }}>
                                    ACTIVE
                                </div>
                            )}
                            <h3 style={{ margin: '0 0 5px 0', color: activeCampaignId === camp.id ? '#c5a059' : '#e0e0e0' }}>{camp.name}</h3>
                            <div style={{ fontSize: '0.8em', color: '#888' }}>
                                {camp.characters?.length || 0} characters • Created {new Date(camp.createdAt).toLocaleDateString()}
                            </div>
                            {camp.id !== activeCampaignId && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteCampaign(camp.id); }}
                                    style={{
                                        marginTop: 10, background: 'none', border: 'none',
                                        color: '#d32f2f', cursor: 'pointer', padding: 0,
                                        fontSize: '0.8em'
                                    }}
                                >
                                    Delete Campaign
                                </button>
                            )}
                        </div>
                    ))}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'center', minWidth: 150 }}>
                        <input
                            value={newCampName}
                            onChange={e => setNewCampName(e.target.value)}
                            placeholder="New Campaign Name"
                            style={{ padding: 5, background: '#111', color: '#fff', border: '1px solid #444' }}
                        />
                        <button
                            onClick={() => { if (newCampName) { createCampaign(newCampName); setNewCampName(''); } }}
                            style={{ background: '#444', border: 'none', color: '#fff', padding: 5, cursor: 'pointer' }}
                        >
                            + Create
                        </button>
                    </div>
                </div>
            </div>

            {/* ACTIVE CAMPAIGN DETAILS */}
            {activeCampaign && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                    {/* CHARACTERS COLUMN */}
                    <div style={{ background: '#222', padding: 15, borderRadius: 8 }}>
                        <h3>Characters in "{activeCampaign.name}"</h3>

                        {/* CREATE CHARACTER FORM (Moved Up & Styled) */}
                        <div style={{ background: '#333', padding: 10, borderRadius: 4, marginBottom: 20, border: '1px solid #555' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: 5, color: '#c5a059' }}>+ Add New Character</div>
                            <div style={{ display: 'flex', gap: 5 }}>
                                <input
                                    value={newCharName} onChange={e => setNewCharName(e.target.value)}
                                    placeholder="Character Name"
                                    style={{ flex: 1, padding: 8, background: '#111', border: '1px solid #444', color: '#fff' }}
                                />
                                <input
                                    type="number"
                                    value={newCharLvl} onChange={e => setNewCharLvl(e.target.value)}
                                    style={{ width: 60, padding: 8, background: '#111', border: '1px solid #444', color: '#fff' }}
                                    min={1} max={20}
                                />
                                <label style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#111', padding: '0 10px', border: '1px solid #444', borderRadius: 4, cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={isSpellcaster}
                                        onChange={e => setIsSpellcaster(e.target.checked)}
                                    />
                                    <span style={{ fontSize: '0.9em' }}>Caster?</span>
                                </label>
                                <button onClick={handleCreateCharacter} style={{ padding: '8px 15px', background: '#c5a059', border: 'none', color: '#000', fontWeight: 'bold', cursor: 'pointer' }}>Create</button>
                            </div>
                        </div>

                        {/* ACTIVE CHARACTERS LIST */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 20 }}>
                            {activeCampaign.characters?.map(char => (
                                <div key={char.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#333', padding: '10px', borderRadius: 4, alignItems: 'center' }}>
                                    <span>
                                        <strong>{char.name}</strong> <span style={{ opacity: 0.7, fontSize: '0.9em' }}>Lvl {char.level}</span>
                                    </span>
                                    <button onClick={() => handleDeleteChar(char.id)} style={{ color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1em' }} title="Delete Character">🗑️</button>
                                </div>
                            ))}
                            {(!activeCampaign.characters?.length) && <div style={{ color: '#888', fontStyle: 'italic', textAlign: 'center' }}>No characters in this campaign yet.</div>}
                        </div>

                        {/* LEGACY / UNASSIGNED CHARACTERS IMPORT */}
                        {db.characters && db.characters.length > 0 && (
                            <div style={{ borderTop: '1px solid #444', paddingTop: 15 }}>
                                <h4 style={{ color: '#aaa', marginTop: 0 }}>Import Legacy Characters</h4>
                                <p style={{ fontSize: '0.8em', color: '#666', marginBottom: 10 }}>Characters from before the update are here. Move them to this campaign:</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {db.characters.map((char, originalIndex) => (
                                        <div key={char.id || originalIndex} style={{ display: 'flex', justifyContent: 'space-between', background: '#2b2b2e', padding: '8px', borderRadius: 4, alignItems: 'center', border: '1px dashed #555' }}>
                                            <span style={{ color: '#aaa' }}>{char.name} (Lvl {char.level})</span>
                                            <button
                                                onClick={() => {
                                                    setDb(prev => {
                                                        const next = deepClone(prev);
                                                        // Add to campaign
                                                        if (!next.campaigns[activeCampaignId].characters) next.campaigns[activeCampaignId].characters = [];
                                                        next.campaigns[activeCampaignId].characters.push({ ...char, id: char.id || crypto.randomUUID() });

                                                        // Remove from root
                                                        next.characters = next.characters.filter((_, i) => i !== originalIndex);
                                                        return next;
                                                    });
                                                }}
                                                style={{ fontSize: '0.8em', background: '#333', color: '#c5a059', border: '1px solid #c5a059', padding: '3px 8px', borderRadius: 4, cursor: 'pointer' }}
                                            >
                                                Import 📥
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* USERS / ASSIGNMENT COLUMN */}
                    <div style={{ background: '#222', padding: 15, borderRadius: 8 }}>
                        <h3>User Assignments</h3>

                        <div style={{ marginBottom: 15 }}>
                            <strong>Assign User to Character:</strong>
                            <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                                <input
                                    type="email"
                                    value={newUserEmail}
                                    onChange={e => setNewUserEmail(e.target.value)}
                                    placeholder="User Email (e.g. player@test.com)"
                                    style={{ flex: 1, padding: 8 }}
                                />
                                <select
                                    value={selectedUserChar}
                                    onChange={e => setSelectedUserChar(e.target.value)}
                                    style={{ padding: 8 }}
                                >
                                    <option value="">-- Select Character --</option>
                                    {activeCampaign.characters?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button
                                    onClick={() => {
                                        if (newUserEmail && selectedUserChar) {
                                            assignUser(newUserEmail, activeCampaign.id, selectedUserChar);
                                            setNewUserEmail('');
                                        }
                                    }}
                                    style={{ background: '#444', color: '#fff', border: 'none', padding: '0 15px', cursor: 'pointer' }}
                                >
                                    Assign
                                </button>
                            </div>
                        </div>

                        <h4>Registered Users (DB)</h4>
                        <div style={{ fontSize: '0.9em', color: '#aaa' }}>
                            {Object.entries(db.users || {}).map(([email, info]) => {
                                const campName = campaigns[info.campaignId]?.name;
                                const charName = campaigns[info.campaignId]?.characters?.find(c => c.id === info.characterId)?.name;
                                return (
                                    <div key={email} style={{ borderBottom: '1px solid #333', padding: '5px 0' }}>
                                        <div style={{ color: '#fff' }}>{email} <span style={{ background: '#444', padding: '2px 4px', borderRadius: 3, fontSize: '0.7em' }}>{info.role || 'player'}</span></div>
                                        {info.campaignId ? (
                                            <div>Playing <strong>{charName || 'Unknown'}</strong> in <em>{campName || info.campaignId}</em></div>
                                        ) : (
                                            <div>Not assigned</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
}
