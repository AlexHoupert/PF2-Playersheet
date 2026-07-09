import React from 'react';

export default function PlayerPlaceholderPage({ title, description = 'This page is planned but not implemented yet.' }) {
    return (
        <section className="player-placeholder-page">
            <div className="player-placeholder-page__eyebrow">Coming later</div>
            <h2>{title}</h2>
            <p>{description}</p>
        </section>
    );
}
