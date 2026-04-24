/**
 * Prism UI Tailwind preset.
 *
 * Adds the #050505 dark background token used across every Prism component.
 * Components otherwise compose inline arbitrary values (bg-[#...], RGBA strings,
 * gradients built at runtime) so no extra utilities are strictly required — this
 * preset primarily documents the shared dark-mode background.
 *
 * Consumers (Tailwind v3):
 *   import prismPreset from '@sammii/prism-ui/tailwind.preset';
 *   export default { presets: [prismPreset], content: [...] };
 *
 * Consumers (Tailwind v4, CSS-first):
 *   @import "tailwindcss";
 *   @source "../node_modules/@sammii/prism-ui/dist";
 *   @theme { --color-prism-bg: #050505; }
 */
const preset = {
  theme: {
    extend: {
      colors: {
        "prism-bg": "#050505",
      },
      backgroundColor: {
        "prism-bg": "#050505",
      },
    },
  },
};

export default preset;
