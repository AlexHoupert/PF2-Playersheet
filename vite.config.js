import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');
          if (!normalizedId.includes('node_modules')) {
            if (
              normalizedId.includes('/src/shared/components/MultiSelectDropdown.jsx')
              || normalizedId.includes('/src/shared/components/BottomSheet.jsx')
              || normalizedId.includes('/src/shared/components/RichTextEditor.jsx')
              || normalizedId.includes('/src/shared/hooks/useWindowSize.js')
            ) return 'shared-ui';
            if (normalizedId.includes('/src/data/ability_index.json') || normalizedId.includes('/src/shared/catalog/abilityIndex.js')) return 'ability-index';
            if (normalizedId.includes('/src/data/action_index.json') || normalizedId.includes('/src/shared/catalog/actionIndex.js')) return 'action-index';
            if (normalizedId.includes('/src/data/shop_index.json') || normalizedId.includes('/src/shared/catalog/shopIndex.js')) return 'shop-index';
            if (normalizedId.includes('/src/data/spell_index.json') || normalizedId.includes('/src/shared/catalog/spellIndex.js')) return 'spell-index';
            if (normalizedId.includes('/src/data/feat_index.json') || normalizedId.includes('/src/shared/catalog/featIndex.js')) return 'feat-index';
            if (normalizedId.includes('/src/data/impulse_index.json') || normalizedId.includes('/src/shared/catalog/impulseIndex.js')) return 'impulse-index';
            if (normalizedId.includes('/src/data/creature_index.json') || normalizedId.includes('/src/shared/catalog/creatureIndex.js')) return 'creature-index';
            if (normalizedId.includes('/src/pacts/pactsData.js')) return 'pacts-data';
            return undefined;
          }
          if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
          if (id.includes('framer-motion')) return 'motion';
          return undefined;
        },
      },
    },
  },
})
