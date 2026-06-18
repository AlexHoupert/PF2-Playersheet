import { useState } from 'react';

export function usePlayerModalState() {
    const [modalMode, setModalMode] = useState(null);
    const [modalData, setModalData] = useState(null);
    const [modalHistory, setModalHistory] = useState([]);
    const [actionModal, setActionModal] = useState({ mode: null, item: null });
    const [condTab, setCondTab] = useState('active');
    const [catalogMode, setCatalogMode] = useState(null);

    const handleBack = () => {
        if (modalHistory.length === 0) return;
        const prev = modalHistory[modalHistory.length - 1];
        setModalData(prev.data);
        setModalMode(prev.mode);
        setModalHistory(prevHistory => prevHistory.slice(0, -1));
    };

    return {
        actionModal,
        catalogMode,
        condTab,
        handleBack,
        modalData,
        modalHistory,
        modalMode,
        setActionModal,
        setCatalogMode,
        setCondTab,
        setModalData,
        setModalHistory,
        setModalMode,
    };
}
