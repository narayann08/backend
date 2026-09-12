import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The plant currently being viewed.
 *
 * The plant id also lives in the URL (`/plants/:plantId/...`), which stays the
 * source of truth for data fetching. This store caches the selected plant's
 * name and type so the sidebar and page headers can render immediately on a
 * hard refresh, before the plant query resolves.
 */
export const usePlantStore = create(
  persist(
    (set) => ({
      /** @type {{id: string, name: string, type: string}|null} */
      selectedPlant: null,
      setSelectedPlant: (plant) =>
        set({
          selectedPlant: plant ? { id: plant.id, name: plant.name, type: plant.type } : null,
        }),
      clearSelectedPlant: () => set({ selectedPlant: null }),
    }),
    { name: 'fluxcast-selected-plant' },
  ),
);
