import React from 'react';
import AdminApp from './admin/AdminApp';
import PlayerApp from './player/PlayerApp';

export default function App() {
    const queryParams = new URLSearchParams(window.location.search);
    return queryParams.get('admin') === 'true' ? <AdminApp /> : <PlayerApp />;
}

