import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import './modalLayer.css';

const ModalLayerContext = createContext({
    activeModals: [],
    hasActiveModal: false,
    lockPageScroll: false,
    registerModal: () => {},
    suspendPageGestures: false,
    topModalId: null,
    unregisterModal: () => {},
});

const DEFAULT_MODAL_OPTIONS = {
    blocking: true,
    lockPageScroll: true,
    suspendPageGestures: true,
};

export function ModalLayerProvider({ children }) {
    const [activeModals, setActiveModals] = useState([]);

    const registerModal = useCallback((id, options = {}) => {
        if (!id) return;
        const next = {
            ...DEFAULT_MODAL_OPTIONS,
            ...options,
            id,
            registeredAt: Date.now(),
        };
        setActiveModals((current) => {
            const withoutCurrent = current.filter((entry) => entry.id !== id);
            return [...withoutCurrent, next];
        });
    }, []);

    const unregisterModal = useCallback((id) => {
        setActiveModals((current) => current.filter((entry) => entry.id !== id));
    }, []);

    const hasActiveModal = activeModals.some((entry) => entry.blocking);
    const lockPageScroll = activeModals.some((entry) => entry.lockPageScroll);
    const suspendPageGestures = activeModals.some((entry) => entry.suspendPageGestures);
    const topModalId = activeModals.length ? activeModals[activeModals.length - 1].id : null;

    useEffect(() => {
        if (!lockPageScroll) return undefined;

        const body = document.body;
        const html = document.documentElement;
        const previousBodyOverflow = body.style.overflow;
        const previousBodyTouchAction = body.style.touchAction;
        const previousHtmlOverflow = html.style.overflow;
        const previousHtmlOverscroll = html.style.overscrollBehavior;

        body.style.overflow = 'hidden';
        body.style.touchAction = 'none';
        html.style.overflow = 'hidden';
        html.style.overscrollBehavior = 'none';
        body.classList.add('modal-layer-scroll-locked');
        html.classList.add('modal-layer-scroll-locked');

        return () => {
            body.style.overflow = previousBodyOverflow;
            body.style.touchAction = previousBodyTouchAction;
            html.style.overflow = previousHtmlOverflow;
            html.style.overscrollBehavior = previousHtmlOverscroll;
            body.classList.remove('modal-layer-scroll-locked');
            html.classList.remove('modal-layer-scroll-locked');
        };
    }, [lockPageScroll]);

    useEffect(() => {
        document.body.dataset.modalLayerActive = hasActiveModal ? 'true' : 'false';
        document.body.dataset.modalLayerGesturesSuspended = suspendPageGestures ? 'true' : 'false';
        return () => {
            delete document.body.dataset.modalLayerActive;
            delete document.body.dataset.modalLayerGesturesSuspended;
        };
    }, [hasActiveModal, suspendPageGestures]);

    const value = useMemo(() => ({
        activeModals,
        hasActiveModal,
        lockPageScroll,
        registerModal,
        suspendPageGestures,
        topModalId,
        unregisterModal,
    }), [activeModals, hasActiveModal, lockPageScroll, registerModal, suspendPageGestures, topModalId, unregisterModal]);

    return (
        <ModalLayerContext.Provider value={value}>
            {children}
        </ModalLayerContext.Provider>
    );
}

export function useModalLayer() {
    return useContext(ModalLayerContext);
}

export function useModalLayerRegistration(active, id, options = {}) {
    const { registerModal, unregisterModal } = useModalLayer();
    const optionsRef = useRef(options);

    useEffect(() => {
        optionsRef.current = options;
    }, [options]);

    useEffect(() => {
        if (!active || !id) return undefined;
        registerModal(id, optionsRef.current);
        return () => unregisterModal(id);
    }, [active, id, registerModal, unregisterModal]);
}

export function ModalLayerMount({ id, active = true, options, children }) {
    useModalLayerRegistration(active, id, options);
    return children ?? null;
}

