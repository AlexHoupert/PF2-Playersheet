import { useCampaign } from "../shared/context/CampaignContext.jsx";
import { selectCampaignLoreArticles } from "../shared/db/selectors/loreSelectors.js";
import { useAppFeedback } from "../shared/feedback/AppFeedback.jsx";
import { useLoreAdminStore } from "../shared/lore/useLoreStores.js";
import LoreAdminWorkspace from "./lore/LoreAdminWorkspace.jsx";

export default function LoreAdminView({ db }) {
  const {
    activeCampaign,
    activeCampaignId,
    dataActions,
    dbMode,
    pcActors,
  } = useCampaign();
  const { confirm, notifyError, notifySuccess } = useAppFeedback();
  const loreStore = useLoreAdminStore({
    campaignId: activeCampaignId,
    enabled: dbMode === "firestore-v2",
    fallbackArticles: selectCampaignLoreArticles(activeCampaign, db),
    fallbackGroups: activeCampaign?.loreGroups || [],
    fallbackDeliveries: activeCampaign?.loreDeliveries || [],
    fallbackNotes: activeCampaign?.knowledgeNotes || [],
  });

  if (!activeCampaignId) {
    return <div className="lore-admin-empty">Select a campaign before managing its Knowledge library.</div>;
  }

  if (loreStore.loading) {
    return <div className="lore-admin-empty">Loading campaign Knowledge...</div>;
  }

  return (
    <LoreAdminWorkspace
      campaignId={activeCampaignId}
      db={db}
      loreStore={loreStore}
      pcActors={pcActors}
      dataActions={dataActions}
      confirm={confirm}
      notifyError={notifyError}
      notifySuccess={notifySuccess}
      contributions={activeCampaign?.loreContributions || []}
    />
  );
}
