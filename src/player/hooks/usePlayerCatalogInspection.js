import { useEffect, useRef, useState } from 'react';
import { getConditionCatalogEntry } from '../../shared/constants/conditionsCatalog';
import { fetchShopItemDetailBySourceFile, getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import { fetchSpellDetailBySourceFile, getSpellIndexItemByName } from '../../shared/catalog/spellIndex';
import { fetchFeatDetailBySourceFile, getFeatIndexItemByName } from '../../shared/catalog/featIndex';
import { fetchActionDetailBySourceFile, getActionIndexItemByName } from '../../shared/catalog/actionIndex';
import { fetchImpulseDetailBySourceFile, getImpulseIndexItemByName } from '../../shared/catalog/impulseIndex';

export function usePlayerCatalogInspection({
    modalData,
    modalMode,
    setModalData,
    setModalHistory,
    setModalMode,
}) {
    const shopItemDetailCacheRef = useRef(new Map());
    const [shopItemDetailLoading, setShopItemDetailLoading] = useState(false);
    const [shopItemDetailError, setShopItemDetailError] = useState(null);

    useEffect(() => {
        if (modalMode !== 'item' || !modalData) {
            setShopItemDetailLoading(false);
            setShopItemDetailError(null);
            return;
        }

        const isSpell = modalData._entityType === 'spell';
        const isFeat = modalData._entityType === 'feat';
        const isAction = modalData._entityType === 'action';
        const isImpulse = modalData._entityType === 'impulse' || modalData.type === 'Impulse';

        let sourceFile = modalData.sourceFile;
        if (!sourceFile && modalData.name) {
            if (isSpell) sourceFile = getSpellIndexItemByName(modalData.name)?.sourceFile;
            else if (isFeat) sourceFile = getFeatIndexItemByName(modalData.name)?.sourceFile;
            else if (isAction) sourceFile = getActionIndexItemByName(modalData.name)?.sourceFile;
            else if (isImpulse) sourceFile = getImpulseIndexItemByName(modalData.name)?.sourceFile;
            else sourceFile = getShopIndexItemByName(modalData.name)?.sourceFile;
        }

        if (!sourceFile) return;
        if (modalData.description) return;

        const cached = shopItemDetailCacheRef.current.get(sourceFile);
        if (cached) {
            setModalData(prev => (prev && prev.name === modalData.name ? { ...cached, ...prev } : prev));
            return;
        }

        let cancelled = false;
        setShopItemDetailLoading(true);
        setShopItemDetailError(null);

        let promise = null;
        if (isSpell) promise = fetchSpellDetailBySourceFile(sourceFile);
        else if (isFeat) promise = fetchFeatDetailBySourceFile(sourceFile);
        else if (isAction) promise = fetchActionDetailBySourceFile(sourceFile);
        else if (isImpulse) promise = fetchImpulseDetailBySourceFile(sourceFile);
        else promise = fetchShopItemDetailBySourceFile(sourceFile);

        promise
            .then(detail => {
                shopItemDetailCacheRef.current.set(sourceFile, detail);
                if (cancelled) return;
                setModalData(prev => (prev && prev.name === modalData.name ? { ...detail, ...prev } : prev));
                setShopItemDetailLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                setShopItemDetailError(err?.message || String(err));
                setShopItemDetailLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [modalData, modalMode, setModalData]);

    const handleContentLinkClick = async (e) => {
        const link = e.target.closest('.content-link');
        if (!link) return;

        e.preventDefault();
        e.stopPropagation();

        const type = link.dataset.type;
        const name = link.dataset.name;

        console.log(`Link clicked: ${type} - ${name}`);

        try {
            if (type === 'action') {
                const idx = getActionIndexItemByName(name);
                if (idx) {
                    const data = await fetchActionDetailBySourceFile(idx.sourceFile);
                    pushModal(setModalHistory, modalMode, modalData);
                    setModalData({ ...data, _entityType: 'action' });
                    setModalMode('item');
                }
            } else if (type === 'item') {
                const idx = getShopIndexItemByName(name);
                if (idx) {
                    const data = await fetchShopItemDetailBySourceFile(idx.sourceFile);
                    pushModal(setModalHistory, modalMode, modalData);
                    setModalData({ ...data, _entityType: 'item' });
                    setModalMode('item');
                }
            } else if (type === 'spell') {
                const idx = getSpellIndexItemByName(name);
                if (idx) {
                    const data = await fetchSpellDetailBySourceFile(idx.sourceFile);
                    pushModal(setModalHistory, modalMode, modalData);
                    setModalData({ ...data, _entityType: 'spell' });
                    setModalMode('item');
                }
            } else if (type === 'feat') {
                const idx = getFeatIndexItemByName(name);
                if (idx) {
                    const data = await fetchFeatDetailBySourceFile(idx.sourceFile);
                    pushModal(setModalHistory, modalMode, modalData);
                    setModalData({ ...data, _entityType: 'feat' });
                    setModalMode('item');
                }
            } else if (type === 'condition') {
                const entry = getConditionCatalogEntry(name);
                if (entry) {
                    pushModal(setModalHistory, modalMode, modalData);
                    setModalData(name);
                    setModalMode('conditionInfo');
                }
            }
        } catch (err) {
            console.error("Error navigating to link", err);
        }
    };

    return {
        handleContentLinkClick,
        shopItemDetailError,
        shopItemDetailLoading,
    };
}

function pushModal(setModalHistory, modalMode, modalData) {
    setModalHistory(h => [...h, { mode: modalMode, data: modalData }]);
}
