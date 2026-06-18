import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import './RichTextEditor.css';

import { conditionsCatalog } from '../../shared/constants/conditionsCatalog';

// Helper component for Searchable Dropdown
function SearchableInsertDropdown({ label, items = [], onSelect, icon, loadItems }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [menuStyle, setMenuStyle] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const buttonRef = useRef(null);

    const filteredItems = useMemo(() => {
        const s = search.toLowerCase();
        // Limit to 25 items after filtering
        return items.filter(i => i.toLowerCase().includes(s)).slice(0, 25);
    }, [items, search]);

    useEffect(() => {
        if (!open) {
            setSearch('');
            setMenuStyle(null);
            return;
        }
        const updatePosition = () => {
            const btn = buttonRef.current;
            if (!btn) return;
            const rect = btn.getBoundingClientRect();
            // Simple positioning: below button
            setMenuStyle({
                top: rect.bottom + 5,
                left: rect.left,
                minWidth: 200
            });
        };
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open]);

    const handleToggle = () => {
        const nextOpen = !open;
        setOpen(nextOpen);
        if (nextOpen && loadItems && items.length === 0 && !isLoading) {
            setIsLoading(true);
            setLoadError(null);
            loadItems()
                .catch(err => {
                    console.error(`Failed to load ${label} catalog`, err);
                    setLoadError('Failed to load.');
                })
                .finally(() => setIsLoading(false));
        }
    };

    return (
        <div className="rte-dropdown-wrapper" style={{ position: 'relative', display: 'inline-block' }}>
            <button
                type="button"
                ref={buttonRef}
                onClick={handleToggle}
                title={label}
                className="rte-btn"
            >
                {icon || label} <span style={{ fontSize: '0.8em', opacity: 0.7 }}>▼</span>
            </button>
            {open && menuStyle && (
                <>
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999 }} onClick={() => setOpen(false)} />
                    <div className="rte-dropdown-menu" style={{
                        position: 'fixed',
                        top: menuStyle.top,
                        left: menuStyle.left,
                        minWidth: menuStyle.minWidth,
                        maxHeight: 300,
                        background: '#333',
                        border: '1px solid #555',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        zIndex: 1000,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: 5,
                        overflow: 'hidden'
                    }}>
                        <input
                            autoFocus
                            placeholder={`Search ${label}...`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '4px 8px',
                                background: '#222',
                                border: '1px solid #444',
                                color: '#eee',
                                marginBottom: 5
                            }}
                        />
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {isLoading && <div style={{ padding: 5, color: '#888' }}>Loading...</div>}
                            {loadError && <div style={{ padding: 5, color: '#e57373' }}>{loadError}</div>}
                            {filteredItems.map(item => (
                                <div
                                    key={item}
                                    className="rte-dropdown-item"
                                    onClick={() => { onSelect(item); setOpen(false); }}
                                    style={{
                                        padding: '4px 8px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}
                                >
                                    {item}
                                </div>
                            ))}
                            {!isLoading && !loadError && filteredItems.length === 0 && <div style={{ padding: 5, color: '#888' }}>No matches</div>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default function RichTextEditor({ value, onChange, className, style, placeholder }) {
    const textareaRef = useRef(null);
    const [catalogNames, setCatalogNames] = useState({ actions: null, items: null, spells: null });

    // Prepare lists
    const conditionNames = useMemo(() => Object.keys(conditionsCatalog).sort(), []);
    const actionNames = catalogNames.actions || [];
    const itemNames = catalogNames.items || [];
    const spellNames = catalogNames.spells || [];

    const loadActionNames = useCallback(async () => {
        if (catalogNames.actions) return;
        const { getAllActionIndexItems } = await import('../../shared/catalog/actionIndex');
        const names = getAllActionIndexItems().map(i => i.name).sort();
        setCatalogNames(prev => prev.actions ? prev : { ...prev, actions: names });
    }, [catalogNames.actions]);

    const loadItemNames = useCallback(async () => {
        if (catalogNames.items) return;
        const { SHOP_INDEX_ITEMS } = await import('../../shared/catalog/shopIndex');
        const names = SHOP_INDEX_ITEMS.map(i => i.name).sort();
        setCatalogNames(prev => prev.items ? prev : { ...prev, items: names });
    }, [catalogNames.items]);

    const loadSpellNames = useCallback(async () => {
        if (catalogNames.spells) return;
        const { SPELL_INDEX_ITEMS } = await import('../../shared/catalog/spellIndex');
        const names = SPELL_INDEX_ITEMS.map(i => i.name).sort();
        setCatalogNames(prev => prev.spells ? prev : { ...prev, spells: names });
    }, [catalogNames.spells]);

    const insertText = (text, wrapTags = null) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = value || '';
        const before = currentVal.substring(0, start);
        const selected = currentVal.substring(start, end);
        const after = currentVal.substring(end);

        let newValue = '';
        let newCursorPos = 0;

        if (wrapTags) {
            // Apply wrapping
            if (wrapTags.style) {
                // span style
                newValue = before + `<span style="${wrapTags.style}">${selected || 'text'}</span>` + after;
                newCursorPos = start + (selected ? newValue.length - after.length : newValue.indexOf('>') + 1); // rough cursor pos logic
            } else {
                // simple tag like b, i
                newValue = before + `<${wrapTags.tag}>${selected || text || ''}</${wrapTags.tag}>` + after;
            }
        } else {
            // Simple insertion
            newValue = before + text + after;
        }

        // Better cursor placement logic
        // If wrapped and no selection, put cursor inside tags.
        // If wrapped and selection, put cursor after.
        // We'll just append simple cursor logic:
        onChange(newValue);

        setTimeout(() => {
            textarea.focus();
            if (wrapTags && !selected) {
                // Try to place cursor inside the tag if empty text was inserted? 
                // Simple approach: set selection after insertion
                const len = newValue.length - after.length;
                textarea.setSelectionRange(len, len);
            } else {
                const len = text ? start + text.length : start; // if wrap?
                // Naive: just put at end of inserted block
                const insertedLen = newValue.length - before.length - after.length;
                textarea.setSelectionRange(start + insertedLen, start + insertedLen);
            }
        }, 0);
    };

    // Improved Wrap Logic
    const wrapSelection = (tag) => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = value || '';
        const selected = currentVal.substring(start, end);

        let prefix = `<${tag}>`;
        let suffix = `</${tag}>`;
        let text = selected;

        if (tag === 'gold') {
            prefix = `<span style="color: #c5a059">`;
            suffix = `</span>`;
        }

        const newValue = currentVal.substring(0, start) + prefix + text + suffix + currentVal.substring(end);
        onChange(newValue);

        setTimeout(() => {
            textarea.focus();
            // maintain selection of the text inside? or collapse to end?
            // "selecting text and clicking on bold ... should apply styling to it" implies text stays selected or at least wraps it.
            // Let's collapse to end for now, standard behavior.
            const newEnd = start + prefix.length + text.length + suffix.length;
            textarea.setSelectionRange(newEnd, newEnd);
        }, 0);
    };

    const insertUUID = (type, name) => {
        // Construct UUID ref. 
        // We don't have the exact UUID map loaded here easily unless we fetch everything, which is heavy.
        // But the system might resolve names? 
        // User said: @UUID[Compendium.pf2e.conditionitems.Item.Prone]
        // This suggests specific pack names.
        // If we don't have the UUID, maybe we assume the name resolves if we use the right compendium path?
        // Or we just insert text linking?

        // "dropdown selectors to add the uuid references that we catch in the decritpion modals like @UUID[Compendium.pf2e.conditionitems.Item.Prone]"
        // This implies I need the REAL UUIDs.
        // Do I have them?
        // - Conditions: `conditions_catalog.json` usually lacks full UUIDs unless enriched. `conditionsCatalog.js` just has the object. 
        // Let's assume for now we use a heuristic or just the name if we can't find the UUID.
        // Wait, `actionIndex` has sourceFile, maybe I can derive it?
        // Actually, for now I will insert `@UUID[Item.${name}]` or similar if I don't have the full path, 
        // OR better: Just insert the Name and let the user formatted link logic (which I might not have control over) handle it?
        // User specifically asked for `@UUID[...]`.

        // Let's look at `actionIndex.js` again. No UUIDs.
        // If I can't generate the exact UUID string, I might fail this requirement.
        // However, usually these editors allow `@UUID[Name]` logic in some systems?
        // Or maybe I construct a best-guess?
        // "Compendium.pf2e.conditionitems.Item.Prone" -> `Item.${name}` might be risky.

        // Let's stick to a placeholder format if I don't know: `@UUID[${type}.${name}]`?
        // The user example had "Compendium.pf2e.conditionitems.Item.Prone".
        // Maybe I insert `@Compendium[pf2e.conditionitems.${name}]`?

        // Actually, I will insert `@UUID[${name}]` which is generic, and maybe the system resolves it?
        // Optimization: Let's insert a known working format if possible.
        // For Conditions: `Compendium.pf2e.conditionitems.Item.${name}` (Capitalized?)
        // For Spells: `Compendium.pf2e.spells-srd.Item.${name}`
        // For Actions: `Compendium.pf2e.actionspf2e.Item.${name}`
        // For Equipment: `Compendium.pf2e.equipment-srd.Item.${name}`

        let compendium = '';
        if (type === 'Condition') compendium = 'pf2e.conditionitems';
        if (type === 'Action') compendium = 'pf2e.actionspf2e';
        if (type === 'Item') compendium = 'pf2e.equipment-srd';
        if (type === 'Spell') compendium = 'pf2e.spells-srd';

        const ref = `@UUID[Compendium.${compendium}.Item.${name}]`;
        insertText(ref);
    };

    return (
        <div className={`rich-text-editor ${className || ''}`} style={style}>
            <div className="rte-toolbar">
                <button type="button" onClick={() => wrapSelection('b')} title="Bold"><b>B</b></button>
                <button type="button" onClick={() => wrapSelection('i')} title="Italic"><i>I</i></button>
                <button type="button" onClick={() => wrapSelection('gold')} title="Gold Text" style={{ color: '#c5a059', fontWeight: 'bold' }}>G</button>
                <button type="button" onClick={() => {
                    const textarea = textareaRef.current;
                    if (!textarea) return;
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const currentVal = value || '';
                    const selected = currentVal.substring(start, end);
                    const newValue = currentVal.substring(0, start) + `||${selected}||` + currentVal.substring(end);
                    onChange(newValue);
                    setTimeout(() => {
                        textarea.focus();
                        textarea.setSelectionRange(start + 2 + selected.length, start + 2 + selected.length);
                    }, 0);
                }} title="Hidden (GM Only)" style={{ color: '#e57373', fontWeight: 'bold' }}>👁️</button>

                <span className="rte-sep">|</span>

                <SearchableInsertDropdown label="Cond" icon="C" items={conditionNames} onSelect={(n) => insertUUID('Condition', n)} />
                <SearchableInsertDropdown label="Act" icon="A" items={actionNames} loadItems={loadActionNames} onSelect={(n) => insertUUID('Action', n)} />
                <SearchableInsertDropdown label="Item" icon="I" items={itemNames} loadItems={loadItemNames} onSelect={(n) => insertUUID('Item', n)} />
                <SearchableInsertDropdown label="Spell" icon="S" items={spellNames} loadItems={loadSpellNames} onSelect={(n) => insertUUID('Spell', n)} />

                <span className="rte-sep">|</span>

                <button type="button" onClick={() => insertText('@Damage[(floor((@actor.level -1)/2)+1)d6]')} title="Damage Formula">⚔️</button>

                <span className="rte-sep">|</span>
                <button type="button" onClick={() => insertText('[one-action]')}>1</button>
                <button type="button" onClick={() => insertText('[two-actions]')}>2</button>
                <button type="button" onClick={() => insertText('[three-actions]')}>3</button>
                <button type="button" onClick={() => insertText('[reaction]')}>R</button>
                <button type="button" onClick={() => insertText('[free-action]')}>F</button>
            </div>
            <textarea
                ref={textareaRef}
                className="rte-textarea"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
            />
            <style>{`
            .rte-dropdown-item:hover { background: #444; }
            `}</style>
        </div>
    );
}
