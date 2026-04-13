import { useEffect, useState } from 'react';

const BREAKPOINTS = { mobile: 640, tablet: 1024 };

function getSize() {
    const w = window.innerWidth;
    return {
        width: w,
        height: window.innerHeight,
        isMobile: w < BREAKPOINTS.mobile,
        isTablet: w >= BREAKPOINTS.mobile && w < BREAKPOINTS.tablet,
        isDesktop: w >= BREAKPOINTS.tablet,
    };
}

export function useWindowSize() {
    const [size, setSize] = useState(getSize);

    useEffect(() => {
        let frame;
        const handler = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setSize(getSize()));
        };
        window.addEventListener('resize', handler);
        return () => { window.removeEventListener('resize', handler); cancelAnimationFrame(frame); };
    }, []);

    return size;
}
