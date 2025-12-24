import React, { useEffect, useMemo, useRef, useState } from 'react';

export default function MultiSelectDropdown({
    label,
    options,
    selected,
    onChange,
    disabled = false,
    showSearch = true
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [menuStyle, setMenuStyle] = useState(null);
    const buttonRef = useRef(null);

    useEffect(() => {
        if (disabled) {
            setOpen(false);
            setSearch('');
        }
    }, [disabled]);

    useEffect(() => {
        if (!open || disabled) {
            setMenuStyle(null);
            return;
        }

        const updatePosition = () => {
            const button = buttonRef.current;
            if (!button) return;

            const rect = button.getBoundingClientRect();
            const margin = 8;

            const maxWidth = Math.max(0, window.innerWidth - margin * 2);
            const desiredWidth = Math.max(240, rect.width);
            const width = Math.min(desiredWidth, maxWidth);

            let left = rect.left;
            if (left + width > window.innerWidth - margin) left = window.innerWidth - margin - width;
            if (left < margin) left = margin;

            const spaceBelow = window.innerHeight - rect.bottom - margin;
            const spaceAbove = rect.top - margin;
            const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;

            const maxHeight = Math.min(320, Math.max(160, openUp ? spaceAbove : spaceBelow));
            const top = openUp ? Math.max(margin, rect.top - maxHeight - margin) : rect.bottom + margin;

            setMenuStyle({ top, left, width, maxHeight });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [open, disabled]);

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return options;
        return options.filter(opt => opt.toLowerCase().includes(query));
    }, [options, search]);

    const close = () => {
        setOpen(false);
        setSearch('');
    };

    const toggleOption = (opt) => {
        if (selected.includes(opt)) onChange(selected.filter(x => x !== opt));
        else onChange([...selected, opt]);
    };

    return (
        <div style={{position:'relative'}}>
            <button
                ref={buttonRef}
                className="btn-add-condition"
                style={{margin:0, width:'auto', minWidth: 120, justifyContent:'space-between'}}
                disabled={disabled}
                onClick={() => !disabled && setOpen(o => !o)}
            >
                <span>{label}{selected.length > 0 ? ` (${selected.length})` : ''}</span>
                <span style={{opacity: 0.8}}>▾</span>
            </button>
            {open && !disabled && menuStyle && (
                <>
                    <div
                        style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', zIndex:9}}
                        onClick={close}
                    ></div>
                    <div style={{
                        position:'fixed',
                        top: menuStyle.top,
                        left: menuStyle.left,
                        width: menuStyle.width,
                        background:'#333',
                        border:'1px solid #555',
                        padding:10,
                        zIndex:10,
                        maxHeight: menuStyle.maxHeight,
                        overflow:'hidden',
                        display:'flex',
                        flexDirection:'column',
                        gap:8
                    }}>
                        {showSearch && (
                            <input
                                className="modal-input"
                                placeholder={`Search ${label}...`}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        )}
                        <div style={{overflowY:'auto'}}>
                            {filteredOptions.map(opt => (
                                <label key={opt} style={{display:'flex', gap:6, alignItems:'center', padding:'2px 0'}}>
                                    <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOption(opt)} />
                                    <span style={{textTransform:'capitalize'}}>{opt}</span>
                                </label>
                            ))}
                            {filteredOptions.length === 0 && <div style={{color:'#777', padding:'4px 0'}}>No matches.</div>}
                        </div>
                        {selected.length > 0 && (
                            <button className="btn-add-condition" style={{margin:0, width:'auto'}} onClick={() => onChange([])}>
                                Clear
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
