---
market: 2Myn77zJqUos19a7jUuZ
recommendation: NO
confidence: high
checked: 2026-09-29
summary: NO: no Notepad++ release through June 2026 added a search box to Preferences; both GitHub feature requests for it are still open.
---
# Will Notepad++ ever offer a feature where you can search among all options by text? by mid 2026

## Finding

No Notepad++ release between the market's creation (Feb 2024, v8.6.3) and the close on 2026-06-30 (last release before close: v8.9.6.4 on 2026-06-03) added a search or filter box that matches text against all Preferences options. The full 8.x changelog lists only a Preferences layout reorganization (v8.8), new individual options, and tooltip fixes; the only filter work was in the Shortcut Mapper, which matches command names and key combinations, not preferences. The Preferences dialog resource file as of 2026-06-20 still defines only the category list and a Close button. Two GitHub feature requests asking for exactly this feature (#16228 from Feb 2025 and #17429 from Jan 2026) are still open with no linked pull request.

## Evidence

- [Notepad++ 8.x changelog (GitHub wiki)](https://github.com/notepad-plus-plus/notepad-plus-plus/wiki/Changes) (accessed 2026-09-29): entries for v8.6.3 through v8.9.8 contain no Preferences search feature; Preferences items include "Reorganize GUI (add Toolbar & Tab Bar sections) of Preferences dialog" (v8.8) and a tooltip fix (v8.9.5); filter items are "Enhance Shortcut Mapper filter" (v8.6.5) and "Add a clear button for filter field in Shortcut Mapper" (v8.8.4).
- [Notepad++ GitHub releases](https://github.com/notepad-plus-plus/notepad-plus-plus/releases) (accessed 2026-09-29): v8.9.6.4 published 2026-06-03 was the last release before close; v8.9.7 followed on 2026-07-14.
- [Notepad++ news](https://notepad-plus-plus.org/news/) (accessed 2026-09-29): release announcements from v8.6.3 through v8.9.8.1; none announce a Preferences search.
- [preference.rc at commit 803bc4d](https://github.com/notepad-plus-plus/notepad-plus-plus/blob/803bc4dff49d9f93b91c1d3a6be42e76161d2435/PowerEditor/src/WinControls/Preference/preference.rc) (2026-06-20, last change to the file before close): the main Preferences dialog (IDD_PREFERENCE_BOX) contains only the category list box and the Close button, with no text field. The master branch as of 2026-08-27 is the same.
- [Issue #16228: "[Feature request] Search function for Settings"](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/16228) (opened 2025-02-25, open on 2026-09-29): asks for a search box at the top of Preferences; the reply points to the third-party MenuSearch plugin; no implementation.
- [Issue #17429: "[Feature request] Searching Settings - Preferences"](https://github.com/notepad-plus-plus/notepad-plus-plus/issues/17429) (opened 2026-01-20, open on 2026-09-29): same request; a user-manual maintainer supports it and questions whether it is practical to implement; no pull request.
- [Notepad++ User Manual: Preferences](https://npp-user-manual.org/docs/preferences/) (accessed 2026-09-29): documents options added through v8.9.3; the only Filter box it describes is in the Shortcut Mapper.
- [NppMenuSearch plugin](https://github.com/peter-frentrup/NppMenuSearch) and its [Plugins Admin list entry](https://github.com/notepad-plus-plus/nppPluginList/blob/master/src/pl.x64.json) (accessed 2026-09-29): third-party plugin (GitHub repo since 2017, earlier SourceForge releases) that "adds a text field to the toolbar for searching menu items and preference dialog options."

## Other side

A YES bettor could argue that Notepad++ "offers" this through Plugins Admin, since the NppMenuSearch plugin searches preference dialog options and installs from the official plugin list. This does not change the recommendation: the plugin is third-party, is not part of the Preferences dialog the market shows, and existed long before the market was created, so counting it would have made the market YES on day one.

## Before resolving

Confirm you agree that a third-party plugin (NppMenuSearch) does not count as Notepad++ offering the feature.
