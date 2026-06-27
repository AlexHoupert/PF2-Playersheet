import { useEffect, useRef, useState } from "react";
import { getConditionCatalogEntry } from "../constants/conditionsCatalog.js";
import {
  fetchCatalogDetail,
  inferCatalogEntityType,
  resolveCatalogSourceFile,
  resolveContentLink,
  shouldFetchCatalogDetail,
} from "../catalog/catalogDetailController.js";

export function useCatalogDetailController({
  modalData,
  modalMode,
  setModalData,
  setModalHistory = null,
  setModalMode,
} = {}) {
  const detailCacheRef = useRef(new Map());
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    if (!modalData || !["item", "spell", "feat", "impulse"].includes(modalMode)) {
      setDetailLoading(false);
      setDetailError(null);
      return;
    }

    if (!shouldFetchCatalogDetail(modalData, modalMode)) return;

    const type = inferCatalogEntityType(modalData, modalMode);
    const sourceFile = resolveCatalogSourceFile(modalData, modalMode);
    const cacheKey = `${type}:${sourceFile}`;
    const cached = detailCacheRef.current.get(cacheKey);
    if (cached) {
      setModalData?.((prev) => (prev && prev.name === modalData.name ? { ...cached, ...prev } : prev));
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);

    fetchCatalogDetail(type, sourceFile)
      .then((detail) => {
        detailCacheRef.current.set(cacheKey, detail);
        if (cancelled) return;
        setModalData?.((prev) => (prev && prev.name === modalData.name ? { ...detail, ...prev } : prev));
        setDetailLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailError(err?.message || String(err));
        setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modalData, modalMode, setModalData]);

  const handleContentLinkClick = async (e) => {
    const link = e.target.closest(".content-link");
    if (!link) return;

    e.preventDefault();
    e.stopPropagation();

    const type = link.dataset.type;
    const name = link.dataset.name;
    const resolved = resolveContentLink(type, name);

    try {
      if (resolved.type === "condition") {
        const entry = getConditionCatalogEntry(name);
        if (entry) {
          pushModal(setModalHistory, modalMode, modalData);
          setModalData?.(name);
          setModalMode?.("conditionInfo");
        }
        return;
      }

      if (!resolved.sourceFile || !resolved.fetchDetail) return;
      const data = await resolved.fetchDetail(resolved.sourceFile);
      pushModal(setModalHistory, modalMode, modalData);
      setModalData?.({ ...data, _entityType: resolved.type });
      setModalMode?.(resolved.modalMode);
    } catch (err) {
      console.error("Content link navigation error", err);
    }
  };

  return {
    detailError,
    detailLoading,
    handleContentLinkClick,
    shopItemDetailError: detailError,
    shopItemDetailLoading: detailLoading,
  };
}

function pushModal(setModalHistory, modalMode, modalData) {
  if (!setModalHistory) return;
  setModalHistory((history) => [...history, { mode: modalMode, data: modalData }]);
}
