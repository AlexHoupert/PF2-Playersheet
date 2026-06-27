import { useCatalogDetailController } from "../../shared/hooks/useCatalogDetailController.js";

export function usePlayerCatalogInspection({
    modalData,
    modalMode,
    setModalData,
    setModalHistory,
    setModalMode,
}) {
    return useCatalogDetailController({
        modalData,
        modalMode,
        setModalData,
        setModalHistory,
        setModalMode,
    });
}
