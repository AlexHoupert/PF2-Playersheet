import React, { useEffect, useMemo, useState } from 'react';
import {
    getCategoryIdForPlayerPage,
    PLAYER_NAV_CATEGORIES,
} from './playerPageRegistry';
import { getPlayerNavIconSrc } from './playerNavIcons';
import './playerNavigation.css';

export default function PlayerBottomNav({
    activePageId,
    onSelectPage,
    onDrawerOpenChange,
    hasLoot = false,
}) {
    const activeCategoryId = getCategoryIdForPlayerPage(activePageId);
    const [openCategoryId, setOpenCategoryId] = useState(null);
    const [drawerCategoryId, setDrawerCategoryId] = useState(activeCategoryId);

    const drawerCategory = useMemo(() => {
        return PLAYER_NAV_CATEGORIES.find((category) => category.id === drawerCategoryId) || PLAYER_NAV_CATEGORIES[0];
    }, [drawerCategoryId]);

    useEffect(() => {
        onDrawerOpenChange?.(Boolean(openCategoryId));
    }, [onDrawerOpenChange, openCategoryId]);

    useEffect(() => {
        return () => onDrawerOpenChange?.(false);
    }, [onDrawerOpenChange]);

    const openCategory = (categoryId) => {
        if (openCategoryId === categoryId) {
            setOpenCategoryId(null);
            return;
        }
        setDrawerCategoryId(categoryId);
        setOpenCategoryId(categoryId);
    };

    const closeDrawer = () => setOpenCategoryId(null);

    const selectPage = (page) => {
        onSelectPage(page);
        closeDrawer();
    };

    return (
        <div className="player-bottom-nav-root no-swipe" data-testid="player-bottom-nav-root">
            <div
                className={`player-nav-backdrop ${openCategoryId ? 'open' : ''}`}
                onClick={closeDrawer}
                aria-hidden="true"
            />
            <section
                id="player-category-drawer"
                className={`player-category-drawer ${openCategoryId ? 'open' : ''}`}
                aria-hidden={!openCategoryId}
                aria-label={drawerCategory ? `${drawerCategory.label} pages` : 'Player pages'}
            >
                <div className="player-category-drawer__handle" />
                <div className="player-category-drawer__header">
                    <span className="player-category-drawer__eyebrow">Player</span>
                    <h2>{drawerCategory.label}</h2>
                </div>
                <div className="player-category-drawer__pages">
                    {drawerCategory.pages.map((page) => {
                        const active = page.id === activePageId;
                        const hasPageLoot = page.alertKey === 'loot' && hasLoot;
                        const iconSrc = getPlayerNavIconSrc(page.icon);
                        return (
                            <button
                                key={page.id}
                                type="button"
                                className={`player-category-drawer__page ${active ? 'active' : ''}`}
                                onClick={() => selectPage(page)}
                                data-testid={`player-nav-page-${page.id}`}
                            >
                                <span className="player-category-drawer__page-icon-wrap">
                                    <img src={iconSrc} alt="" className="player-category-drawer__page-icon" />
                                </span>
                                <span className="player-category-drawer__page-main">
                                    <span>{page.label}</span>
                                    {hasPageLoot && <span className="player-nav-alert-dot" aria-label="New loot" />}
                                </span>
                                {page.future && <span className="player-category-drawer__page-note">Soon</span>}
                            </button>
                        );
                    })}
                </div>
            </section>
            <nav className="player-bottom-nav" aria-label="Player navigation">
                {PLAYER_NAV_CATEGORIES.map((category) => {
                    const active = category.id === activeCategoryId;
                    const open = category.id === openCategoryId;
                    const iconSrc = getPlayerNavIconSrc(category.icon);
                    const categoryHasLoot = category.id === 'items' && hasLoot;
                    return (
                        <button
                            key={category.id}
                            type="button"
                            className={`player-bottom-nav__item ${active ? 'active' : ''} ${open ? 'open' : ''}`}
                            onClick={() => openCategory(category.id)}
                            aria-expanded={open}
                            aria-controls="player-category-drawer"
                            data-testid={`player-nav-category-${category.id}`}
                        >
                            <span className="player-bottom-nav__icon-wrap">
                                <img src={iconSrc} alt="" className="player-bottom-nav__icon" />
                                {categoryHasLoot && <span className="player-bottom-nav__badge" aria-label="New loot" />}
                            </span>
                            <span className="player-bottom-nav__label">{category.label}</span>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
