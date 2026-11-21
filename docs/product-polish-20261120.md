# Component discovery and handoff, 20 November 2026

Local release candidate. No push or deployment.

The gallery makes eight registry installs discoverable among31 components, and offers four interaction studies separately. Card labels distinguish registry installs, source references and studies. Search/category/availability filters intersect, preserve a shareable URL and clear together. Detail pages without registry bundles explain that their source/dependencies need review. Registry-backed pages show the actual installation command.

Browser verification: eight installable cards at /components?show=installable, four study cards, and the Dialog installation command. The browser provider ignored the attempted phone-width override; a fresh mobile check remains open. Compact preview mappings stay intact.

Two discovery tests, gallery coverage, registry consumer compilation, lint and TypeScript pass. Next moves to16.4.6. Patch-level overrides address the production audit's @babel/core, browserslist, baseline-browser-mapping and source-map-js advisories. The final production audit reports0 advisories. The broader development-tool dependency audit still reports34 advisories (1low/10moderate/23high), with0critical. Do not describe the full dependency tree as clear; dev-tool upgrades need a separate compatibility review.

This checkout now has its own node_modules. Its previous shared dependency link was preserved at /tmp/prism-shared-node-modules-20261120 before installation; the shared source checkout's dependencies were not changed. No env files were copied.

Final webpack production build passes (54 static pages) after the dependency patches.
