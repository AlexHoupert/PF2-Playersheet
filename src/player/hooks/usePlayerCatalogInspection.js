import { useCatalogDetailController } from "../../shared/hooks/useCatalogDetailController.js";

export function usePlayerCatalogInspection({
    db,
    modalData,
    modalMode,
    setModalData,
    setModalHistory,
    setModalMode,
}) {
    return useCatalogDetailController({
        db,
        modalData,
        modalMode,
        setModalData,
        setModalHistory,
        setModalMode,
    });
}
