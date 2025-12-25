import React, { useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { deepClone } from '../shared/utils/deepClone';

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

    // Skeleton Character
    const handleCreateCharacter = () => {
        if (!newCharName || !activeCampaignId) return;

        const newChar = {
            id: crypto.randomUUID(),
            name: newCharName,
            level: parseInt(newCharLvl),
            xp: { current: 0, max: 1000 }, // Standard 1000 XP
            gold: 15.00, // 15gp start
            stats: {
                hp: { current: 15, max: 15, temp: 0 },
                ac: { value: 10, base: 10 },
                attributes: { strength: 0, dexterity: 0, constitution: 0, intelligence: 0, wisdom: 0, charisma: 0 },
                saves: { fortitude: 0, reflex: 0, will: 0 },
                speed: { land: 25 },
                class_dc: 10,
                perception: 0
            },
            skills: {}, // Empty skills map
            inventory: [],
            magic: { slots: {}, list: [] },
            feats: [],
            conditions: [],
            proficiencies: { Unarmored: 0, Light: 0, Medium: 0, Heavy: 0 },
            languages: ['Common'],
            senses: []
        };

        setDb(prev => {
            const next = { ...prev };
            const cmap = next.campaigns[activeCampaignId];
            if (!cmap) return prev;

            // Ensure array exists
            const chars = cmap.characters ? [...cmap.characters] : [];
            chars.push(newChar);

            next.campaigns[activeCampaignId] = {
                ...cmap,
                characters: chars
            };
            return next;
        });

        setNewCharName('');
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
                    {Object.values(campaigns).map(c => (
                        <div
                            key={c.id}
                            onClick={() => setSelectedCampaignId(c.id)}
                            style={{
                                padding: '10px 15px',
                                background: c.id === activeCampaignId ? '#c5a059' : '#333',
                                color: c.id === activeCampaignId ? '#1a1a1d' : '#ccc',
                                borderRadius: 6,
                                cursor: 'pointer',
                                minWidth: 120,
                                textAlign: 'center',
                                border: '1px solid #555'
                            }}
                        >
                            <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                            <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{c.characters?.length || 0} Characters</div>
                            <div style={{ fontSize: '0.8em', opacity: 0.8 }}>{c.quests?.length || 0} Quests</div>
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

                        <div style={{ display: 'flex', gap: 5, marginBottom: 15 }}>
                            <input
                                value={newCharName} onChange={e => setNewCharName(e.target.value)}
                                placeholder="Character Name"
                                style={{ flex: 1, padding: 8 }}
                            />
                            <input
                                type="number"
                                value={newCharLvl} onChange={e => setNewCharLvl(e.target.value)}
                                style={{ width: 60, padding: 8 }}
                                min={1} max={20}
                            />
                            <button onClick={handleCreateCharacter} style={{ padding: '8px 15px', background: '#c5a059', border: 'none', color: '#000', fontWeight: 'bold' }}>Create</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {activeCampaign.characters?.map(char => (
                                <div key={char.id} style={{ display: 'flex', justifyContent: 'space-between', background: '#333', padding: 8, borderRadius: 4 }}>
                                    <span>{char.name} (Lvl {char.level})</span>
                                    <button onClick={() => handleDeleteChar(char.id)} style={{ color: 'red', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                                </div>
                            ))}
                            {(!activeCampaign.characters?.length) && <div style={{ color: '#666' }}>No characters yet.</div>}
                        </div>
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
