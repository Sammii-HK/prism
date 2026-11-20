# Local browser verification, 20 November 2026

Source baseline 871fd10, plus the command-palette correction in this batch. These observations describe the local production build, not the deployed site.

## Phone navigation

At a measured 390px viewport, document width is 390px. The brand and five navigation links each measure 44px high. The header is 101px high; the sticky category row stays below it (tab list top 113px, including its padding). Eight installable components remain available through the gallery filter.

## Command palette correction

The previous closed portal had opacity 0 and pointer-events:none but remained in the accessibility tree with a focusable input. This let an invisible modal remain reachable.

The panel is now inert and aria-hidden while closed. While open, surrounding body elements become inert and body scrolling is locked; their previous states are restored on close. Command options use active-descendant navigation rather than a second tab sequence. Tab and Shift+Tab stay in the combobox. A mouse-selected submenu returns focus to the input. The search input has a persistent accessible name.

Observed in the actual local build:

- A closed palette does not appear in the accessibility tree.
- Opening the visible launcher focuses Search commands and isolates the background.
- Tab and Shift+Tab leave focus in the combobox.
- Searching theme produces the matching command; Enter opens the three theme choices.
- Clicking that command with the pointer also returns focus to the input.
- Escape returns to the root list, then closes and restores focus to the launcher.
- Reopening clears the search and submenu state.
- The palette and gallery fit the 390px viewport without horizontal document overflow.

Changed-file ESLint, the full 54-route production build, icon lint (0 blocking findings) and the 8 icon guard tests pass. This is browser interaction verification, not full cross-browser or assistive-technology certification. Demo actions still log illustrative commands; they are not real account navigation or data mutations.

## Screenshots

Actual local captures are in .codex-artifacts: prism-components-phone.jpg, prism-installable-phone.jpg, prism-palette-phone.jpg and prism-installable-desktop.jpg. Phone and desktop names reflect their measured viewports (390 and 1144px). Temporary viewport targets were reset/closed after testing. Screenshots do not represent a release.
