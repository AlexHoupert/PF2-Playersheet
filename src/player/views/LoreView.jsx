
import React, { useState, useMemo, useEffect } from 'react';
import CreatureCard from '../../shared/components/CreatureCard';
import CreatureAbilityModal from '../../shared/components/CreatureAbilityModal';
import CreatureSkillDetailDialog from '../../shared/components/CreatureSkillDetailDialog';
import {
    selectBestiaryCreatureMetadata,
    selectCustomCreatureData,
} from '../../shared/db/selectors/bestiarySelectors';
import { selectLoreArticles } from '../../shared/db/selectors/loreSelectors';
import { buildBestiaryCreatureEntries, selectVisibleCreatureFields } from '../../shared/bestiary/creaturePresentation';
import { selectCatalogEntryStates } from '../../shared/db/selectors/catalogOverrideSelectors';

const LORE_CATEGORIES = ['History', 'Locations', 'NPCs', 'Bestiary'];

// --- Helper: Build Tree Structure from Flat List ---
const buildTree = (items) => {
    const tree = {};

    items.forEach(item => {
        const group = item.group || 'General';
        const parts = group.split('/');

        let currentLevel = tree;
        parts.forEach((part, index) => {
            if (!currentLevel[part]) {
                currentLevel[part] = { _isFolder: true, _name: part, _children: {}, _items: [] };
            }
            if (index === parts.length - 1) {
                currentLevel[part]._items.push(item);
            }
            currentLevel = currentLevel[part]._children;
        });
    });

    return tree;
};

// --- Component: Recursive Tree Node ---
const TreeFolder = ({ name, node, level = 0, onSelect, selectedId, forceExpand = false }) => {
    const [expanded, setExpanded] = useState(level === 0 || forceExpand);

    // Sort: Folders first, then items
    const subFolders = Object.keys(node._children || {}).sort();
    const items = (node._items || []).sort((a, b) => a.title.localeCompare(b.title));

    return (
        <div style={{ marginLeft: level > 0 ? 10 : 0 }}>
            {/* Folder Header */}
            {name !== 'General' && (
                <div
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        cursor: 'pointer',
                        padding: '6px 0',
                        color: 'var(--text-gold)',
                        fontFamily: 'Cinzel, serif',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: '1.1em',
                        userSelect: 'none'
                    }}
                >
                    <span style={{
                        marginRight: 5,
                        transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s',
                        fontSize: '0.8em'
                    }}>
                        ▶
                    </span>
                    {name}
                </div>
            )}

            {/* Folder Content */}
            {(expanded || name === 'General') && (
                <div style={{ marginLeft: name === 'General' ? 0 : 12, borderLeft: name === 'General' ? 'none' : '1px solid #333', paddingLeft: name === 'General' ? 0 : 5 }}>
                    {subFolders.map(folderName => (
                        <TreeFolder
                            key={folderName}
                            name={folderName}
                            node={node._children[folderName]}
                            level={level + 1}
                            onSelect={onSelect}
                            selectedId={selectedId}
                        />
                    ))}

                    {items.map(item => (
                        <div
                            key={item.id}
                            onClick={() => onSelect(item)}
                            className={`lore-tree-item ${selectedId === item.id ? 'active' : ''}`}
                            style={{
                                padding: '6px 0 6px 10px',
                                margin: '2px 0',
                                cursor: 'pointer',
                                color: selectedId === item.id ? 'var(--text-gold)' : '#aaa',
                                background: selectedId === item.id ? 'linear-gradient(90deg, rgba(197, 160, 89, 0.1), transparent)' : 'transparent',
                                borderLeft: selectedId === item.id ? '3px solid var(--text-gold)' : '3px solid transparent',
                                transition: '0.2s',
                                fontSize: '0.95em',
                                fontFamily: 'Roboto Serif, serif'
                            }}
                        >
                            {item.title}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


export default function LoreView({ db, lore, bestiary }) {
    // viewMode: 'tiles' (Initial) | 'book' (Reading)
    const [viewMode, setViewMode] = useState('tiles');
    const [currentCategory, setCurrentCategory] = useState(null);
    const [currentArticleId, setCurrentArticleId] = useState(null);
    const [historyStack, setHistoryStack] = useState([]);
    const selectorDb = useMemo(() => db || { lore, bestiary }, [db, lore, bestiary]);

    // Data Patching for missing groups
    const articles = useMemo(() => {
        const raw = selectLoreArticles(selectorDb);
        return raw.map(a => {
            if (!a.group) {
                // Patch specific known IDs for demo purposes
                if (a.id === '1') return { ...a, group: 'Eras' };
                if (a.id === '2') return { ...a, group: 'Characters' };
                if (a.id === '3') return { ...a, group: 'Forests' };
                if (a.id === '4') return { ...a, group: 'Creatures' };
                return { ...a, group: 'General' };
            }
            return a;
        });
    }, [selectorDb]);

    const filteredArticles = useMemo(() => {
        if (!currentCategory) return [];
        return articles.filter(a => a.category?.toLowerCase() === currentCategory.toLowerCase());
    }, [articles, currentCategory]);

    const articleTree = useMemo(() => {
        if (!currentCategory) return {};
        return buildTree(filteredArticles);
    }, [filteredArticles, currentCategory]);

    const currentArticle = useMemo(() => {
        return articles.find(a => a.id === currentArticleId);
    }, [articles, currentArticleId]);

    // Bestiary creatures (only those with bestiary: true)
    const [selectedCreatureId, setSelectedCreatureId] = useState(null);
    const [catalogCreatures, setCatalogCreatures] = useState([]);

    useEffect(() => {
        if (currentCategory !== 'Bestiary') {
            setCatalogCreatures([]);
            return;
        }

        let cancelled = false;
        import('../../shared/catalog/creatureIndex').then(module => {
            if (!cancelled) setCatalogCreatures(module.getAllCreatures());
        });

        return () => {
            cancelled = true;
        };
    }, [currentCategory]);

    // Merge INDEX data + custom creatures with db metadata - show only creatures with bestiary=true
    const bestiaryCreatures = useMemo(() => {
        return buildBestiaryCreatureEntries({
            entryStates: selectCatalogEntryStates(catalogCreatures, selectorDb, 'creature'),
            metadata: selectBestiaryCreatureMetadata(selectorDb),
            includeUnpublished: false,
        });
    }, [selectorDb, catalogCreatures]);

    // Group creatures by their group field
    const groupedCreatures = useMemo(() => {
        const groups = {};
        bestiaryCreatures.forEach(c => {
            const g = c.group || 'Uncategorized';
            if (!groups[g]) groups[g] = [];
            groups[g].push(c);
        });
        // Sort groups alphabetically, but put Uncategorized last
        return Object.entries(groups).sort((a, b) => {
            if (a[0] === 'Uncategorized') return 1;
            if (b[0] === 'Uncategorized') return -1;
            return a[0].localeCompare(b[0]);
        });
    }, [bestiaryCreatures]);

    const selectedCreature = useMemo(() => {
        return bestiaryCreatures.find(c => c.id === selectedCreatureId);
    }, [bestiaryCreatures, selectedCreatureId]);

    // Loaded creature data state
    const [loadedCreatureData, setLoadedCreatureData] = useState(null);

    // Fetch full creature data when selected creature changes
    useEffect(() => {
        if (!selectedCreatureId) {
            setLoadedCreatureData(null);
            return;
        }
        if (selectedCreature?.data) {
            setLoadedCreatureData(selectedCreature.data);
            return;
        }
        const customData = selectCustomCreatureData(selectorDb, selectedCreatureId);
        if (customData) {
            setLoadedCreatureData(customData);
            return;
        }
        let cancelled = false;
        import('../../shared/catalog/creatureIndex')
            .then(module => module.fetchCreatureData(selectedCreatureId))
            .then(data => {
                if (!cancelled && data) setLoadedCreatureData(data);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedCreatureId, selectedCreature, selectorDb]);

    // Ability modal state
    const [selectedAbility, setSelectedAbility] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);

    // Collapsible groups state for bestiary (default all expanded)
    const [expandedGroups, setExpandedGroups] = useState({});

    const handleTileClick = (category) => {
        setCurrentCategory(category);
        setViewMode('book');
        setHistoryStack([]);
        setCurrentArticleId(null);
    };

    const handleArticleClick = (articleId) => {
        if (currentArticleId && currentArticleId !== articleId) {
            setHistoryStack(prev => [...prev, currentArticleId]);
        }
        setCurrentArticleId(articleId);
        // Ensure we are in book mode
        setViewMode('book');
    };

    const handleBackToTiles = () => {
        setViewMode('tiles');
        setCurrentCategory(null);
        setCurrentArticleId(null);
    };

    const renderWikiContent = (content) => {
        if (!content) return <div style={{ color: '#666', fontStyle: 'italic' }}>No content written yet.</div>;

        return content.split('\n').map((line, i) => {
            if (!line.trim()) return <br key={i} />;

            // Separator
            if (line.trim() === '---') {
                return <hr key={i} style={{ border: 'none', borderTop: '1px solid #444', margin: '20px 0' }} />;
            }

            // Headers
            if (line.startsWith('# ')) {
                return <h3 key={i} className="lore-heading">{line.slice(2)}</h3>;
            }
            if (line.startsWith('## ')) {
                return <h4 key={i} className="lore-subheading">{line.slice(3)}</h4>;
            }

            // Parse inline styles: **bold**, *italics*, {{gold}}, [[links]]
            let parts = line.split(/(\*\*.*?\*\*|\*[^*]+\*|\{\{.*?\}\}|\[\[.*?\]\])/g);
            return (
                <p key={i} className="lore-paragraph">
                    {parts.map((part, j) => {
                        // Bold
                        if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} style={{ color: '#e0e0e0' }}>{part.slice(2, -2)}</strong>;
                        }
                        // Italics (single asterisk)
                        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                            return <em key={j} style={{ color: '#bbb' }}>{part.slice(1, -1)}</em>;
                        }
                        // Gold text
                        if (part.startsWith('{{') && part.endsWith('}}')) {
                            return <span key={j} style={{ color: 'var(--text-gold)', fontWeight: 'bold' }}>{part.slice(2, -2)}</span>;
                        }
                        // Article links: [[Article]] or [[Article|Display Text]]
                        if (part.startsWith('[[') && part.endsWith(']]')) {
                            const inner = part.slice(2, -2);
                            const pipeIdx = inner.indexOf('|');
                            const targetTitle = pipeIdx > -1 ? inner.substring(0, pipeIdx) : inner;
                            const displayText = pipeIdx > -1 ? inner.substring(pipeIdx + 1) : inner;
                            const targetArticle = articles.find(a => a.title.toLowerCase() === targetTitle.toLowerCase());
                            return (
                                <span
                                    key={j}
                                    onClick={() => targetArticle && handleArticleClick(targetArticle.id)}
                                    style={{
                                        color: targetArticle ? 'var(--text-gold)' : '#d32f2f',
                                        textDecoration: 'none',
                                        borderBottom: '1px dotted var(--text-gold)',
                                        cursor: targetArticle ? 'pointer' : 'default',
                                        fontWeight: 'bold'
                                    }}
                                    title={targetArticle ? targetArticle.title : 'Article not found: ' + targetTitle}
                                >
                                    {displayText}
                                </span>
                            );
                        }
                        return part;
                    })}
                </p>
            );
        });
    };

    // Render Infobox (Wikipedia-style summary box)
    const renderInfobox = (infoboxStr) => {
        if (!infoboxStr?.trim()) return null;
        const lines = infoboxStr.split('\n').filter(l => l.includes(':'));
        if (lines.length === 0) return null;

        return (
            <div className="lore-infobox">
                {lines.map((line, i) => {
                    const colonIdx = line.indexOf(':');
                    const key = line.substring(0, colonIdx).trim();
                    const value = line.substring(colonIdx + 1).trim();

                    // Parse links in value
                    const valueParts = value.split(/(\[\[.*?\]\])/g);

                    return (
                        <div key={i} className="lore-infobox-row">
                            <span className="lore-infobox-key">{key}:</span>
                            <span className="lore-infobox-value">
                                {valueParts.map((part, j) => {
                                    if (part.startsWith('[[') && part.endsWith(']]')) {
                                        const inner = part.slice(2, -2);
                                        const pipeIdx = inner.indexOf('|');
                                        const targetTitle = pipeIdx > -1 ? inner.substring(0, pipeIdx) : inner;
                                        const displayText = pipeIdx > -1 ? inner.substring(pipeIdx + 1) : inner;
                                        const targetArticle = articles.find(a => a.title.toLowerCase() === targetTitle.toLowerCase());
                                        return (
                                            <span
                                                key={j}
                                                onClick={() => targetArticle && handleArticleClick(targetArticle.id)}
                                                style={{
                                                    color: targetArticle ? 'var(--text-gold)' : '#d32f2f',
                                                    cursor: targetArticle ? 'pointer' : 'default',
                                                    borderBottom: '1px dotted var(--text-gold)'
                                                }}
                                            >
                                                {displayText}
                                            </span>
                                        );
                                    }
                                    return part;
                                })}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    };

    // --- RENDER ---

    if (viewMode === 'tiles') {
        return (
            <div className="shop-card-grid" style={{ marginTop: 20 }}>
                {LORE_CATEGORIES.map(category => (
                    <div
                        className="shop-card"
                        key={category}
                        onClick={() => handleTileClick(category)}
                    >
                        <img
                            src={`ressources/icons/cards/${category.toLowerCase()}.webp`}
                            onError={(e) => { e.target.src = 'ressources/icons/cards/default.webp'; e.target.style.opacity = 0.5; }}
                            alt={category}
                            style={{
                                width: '100%',
                                height: 'auto',
                                maxWidth: '140px',
                                maxHeight: '140px',
                                margin: '0 auto',
                                objectFit: 'fill',
                                filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))'
                            }}
                        />
                        <div style={{ color: '#fff', marginTop: 15, fontSize: '1.4em', fontFamily: 'Cinzel, serif', textTransform: 'uppercase', letterSpacing: '1px' }}>{category}</div>
                    </div>
                ))}
            </div>
        );
    }

    if (viewMode === 'book') {
        const isReading = !!currentArticleId;

        // Special handling for Bestiary category
        if (currentCategory === 'Bestiary') {
            return (
                <div className={`lore-book-container ${selectedCreature ? 'reading-mode' : ''}`}>
                    {/* Sidebar: Creature List */}
                    <div className="lore-sidebar">
                        <div style={{ padding: 15, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
                            <button onClick={handleBackToTiles} className="btn-add-condition" style={{ width: 'auto', margin: '0 10px 0 0', padding: '5px 10px', fontSize: '1.2em' }}>
                                ⌂
                            </button>
                            <h2 style={{ margin: 0, fontSize: '1.4em' }}>Bestiary</h2>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: 15 }}>
                            {bestiaryCreatures.length === 0 && <p style={{ color: '#666' }}>No creatures discovered yet.</p>}
                            {groupedCreatures.map(([groupName, creatures]) => {
                                const isExpanded = expandedGroups[groupName] !== false; // default expanded
                                return (
                                    <div key={groupName} style={{ marginLeft: 0 }}>
                                        {/* Group Header - Collapsible */}
                                        <div
                                            onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !isExpanded }))}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '6px 0',
                                                color: 'var(--text-gold)',
                                                fontFamily: 'Cinzel, serif',
                                                display: 'flex',
                                                alignItems: 'center',
                                                fontSize: '1.1em',
                                                userSelect: 'none'
                                            }}
                                        >
                                            <span style={{
                                                marginRight: 5,
                                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s',
                                                fontSize: '0.8em'
                                            }}>
                                                ▶
                                            </span>
                                            {groupName}
                                        </div>

                                        {/* Group Content */}
                                        {isExpanded && (
                                            <div style={{ marginLeft: 12, borderLeft: '1px solid #333', paddingLeft: 5 }}>
                                                {creatures.map(creature => {
                                                    const visible = selectVisibleCreatureFields(creature, 'player');
                                                    const listName = visible.name;
                                                    return (
                                                    <div
                                                        key={creature.id}
                                                        onClick={() => setSelectedCreatureId(creature.id)}
                                                        className={`lore-tree-item ${selectedCreatureId === creature.id ? 'active' : ''}`}
                                                        style={{
                                                            padding: '6px 0 6px 10px',
                                                            margin: '2px 0',
                                                            cursor: 'pointer',
                                                            color: selectedCreatureId === creature.id ? 'var(--text-gold)' : '#aaa',
                                                            background: selectedCreatureId === creature.id ? 'linear-gradient(90deg, rgba(197, 160, 89, 0.1), transparent)' : 'transparent',
                                                            borderLeft: selectedCreatureId === creature.id ? '3px solid var(--text-gold)' : '3px solid transparent',
                                                            transition: '0.2s',
                                                            fontSize: '0.95em',
                                                            fontFamily: 'Roboto Serif, serif',
                                                            display: 'flex',
                                                            alignItems: 'baseline',
                                                            gap: 8
                                                        }}
                                                    >
                                                        <span>{listName}</span>
                                                        {visible.levelVisible && (
                                                            <span style={{ fontSize: '0.8em', color: '#666' }}>
                                                                Lv. {visible.level}
                                                            </span>
                                                        )}
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content: Creature Card */}
                    <div className="lore-reader">
                        {selectedCreature ? (
                            <>
                                {/* Mobile back button */}
                                <button
                                    className="mobile-back-btn"
                                    onClick={() => setSelectedCreatureId(null)}
                                    style={{
                                        display: 'none',
                                        marginBottom: 12,
                                        padding: '8px 16px',
                                        background: 'rgba(92, 61, 46, 0.5)',
                                        border: '1px solid #5c3d2e',
                                        borderRadius: 4,
                                        color: '#f5deb3',
                                        cursor: 'pointer'
                                    }}
                                >
                                    ← Back to List
                                </button>
                                {loadedCreatureData ? (
                                    <CreatureCard
                                        creature={{ ...selectedCreature, data: loadedCreatureData }}
                                        isGM={false}
                                        revealState={selectedCreature.revealState}
                                        falseData={selectedCreature.falseData}
                                        onAbilityClick={(ability) => setSelectedAbility(ability)}
                                        onSkillClick={(skill) => setSelectedSkill(skill)}
                                    />
                                ) : (
                                    <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                                        Loading creature data...
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
                                <p style={{ fontSize: '1.2em' }}>Select a creature from the list to view its details.</p>
                            </div>
                        )}
                    </div>

                    {/* Ability Modal */}
                    {selectedAbility && (
                        <CreatureAbilityModal
                            ability={selectedAbility}
                            onClose={() => setSelectedAbility(null)}
                        />
                    )}
                    {selectedSkill && (
                        <CreatureSkillDetailDialog
                            skill={selectedSkill}
                            onClose={() => setSelectedSkill(null)}
                        />
                    )}
                </div>
            );
        }

        return (
            <div className={`lore-book-container ${isReading ? 'reading-mode' : ''}`}>

                {/* 1. Left Sidebar: Tree View */}
                <div className="lore-sidebar">
                    {/* Header */}
                    <div style={{ padding: 15, borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center' }}>
                        <button onClick={handleBackToTiles} className="btn-add-condition" style={{ width: 'auto', margin: '0 10px 0 0', padding: '5px 10px', fontSize: '1.2em' }}>
                            ⌂
                        </button>
                        <h2 style={{ margin: 0, fontSize: '1.4em' }}>{currentCategory}</h2>
                    </div>

                    {/* Tree Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 15 }}>
                        {Object.keys(articleTree).length === 0 && <p style={{ color: '#666' }}>No entries found.</p>}

                        {Object.keys(articleTree).sort().map(key => (
                            <TreeFolder
                                key={key}
                                name={key}
                                node={articleTree[key]}
                                level={0}
                                onSelect={(item) => handleArticleClick(item.id)}
                                selectedId={currentArticleId}
                                forceExpand={true}
                            />
                        ))}
                    </div>
                </div>

                {/* 2. Main Content: Article Reader */}
                <div className="lore-content-panel">

                    {currentArticle ? (
                        <div className="lore-article-box">
                            {/* Back / Index Buttons - Floated so title wraps around */}
                            <div className="lore-nav-buttons">
                                {historyStack.length > 0 && (
                                    <button
                                        onClick={() => {
                                            const prevId = historyStack[historyStack.length - 1];
                                            setHistoryStack(prev => prev.slice(0, -1));
                                            setCurrentArticleId(prevId);
                                        }}
                                        className="btn-add-condition"
                                        style={{
                                            width: 'auto',
                                            background: 'rgba(0,0,0,0.6)',
                                            border: '1px solid var(--text-gold)'
                                        }}
                                    >
                                        ◀ Back
                                    </button>
                                )}
                                <button
                                    onClick={() => setCurrentArticleId(null)}
                                    className="btn-add-condition"
                                    style={{
                                        width: 'auto',
                                        background: 'rgba(0,0,0,0.6)',
                                        border: '1px solid #555',
                                        display: isReading ? 'block' : 'none'
                                    }}
                                >
                                    ☰ Index
                                </button>
                            </div>

                            <h1 className="lore-article-title">
                                {currentArticle.title}
                            </h1>

                            {/* Infobox (Wikipedia-style summary) */}
                            {renderInfobox(currentArticle.infobox)}

                            {currentArticle.image && (
                                <div className="lore-article-image">
                                    <img
                                        src={currentArticle.image}
                                        alt={currentArticle.title}
                                    />
                                    <div className="lore-image-caption">{currentArticle.title}</div>
                                </div>
                            )}

                            <div className="lore-article-content">
                                {renderWikiContent(currentArticle.content)}
                            </div>

                            {/* Tags Footer */}
                            {currentArticle.tags && (
                                <div style={{ marginTop: 50, paddingTop: 20, borderTop: '1px solid #333', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    {currentArticle.tags.map(t => (
                                        <span key={t} style={{ color: '#555', fontSize: '0.85em', fontFamily: 'monospace' }}>#{t}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#444', fontStyle: 'italic', flexDirection: 'column' }}>
                            <div style={{ fontSize: '3em', opacity: 0.3 }}>📖</div>
                            <p>Select an entry from the index to read.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return null;
}
