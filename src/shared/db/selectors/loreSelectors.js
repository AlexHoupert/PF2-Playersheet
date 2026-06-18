export function selectLoreArticles(db) {
    return Array.isArray(db?.lore?.articles) ? db.lore.articles : [];
}

export function selectLoreArticlesByCategory(db, category) {
    const targetCategory = String(category || '').toLowerCase();
    return selectLoreArticles(db)
        .filter((article) => String(article.category || '').toLowerCase() === targetCategory)
        .sort(sortLoreArticles);
}

export function selectLoreArticle(db, articleId) {
    return selectLoreArticles(db).find((article) => article.id === articleId) || null;
}

export function sortLoreArticles(a, b) {
    const orderA = a.sortOrder ?? 9999;
    const orderB = b.sortOrder ?? 9999;
    if (orderA !== orderB) return orderA - orderB;
    return String(a.title || '').localeCompare(String(b.title || ''));
}
