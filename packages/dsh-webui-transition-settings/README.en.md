<h1 align="center">dsh-webui-transition-settings</h1>

<div align="center">

[![npm version](https://img.shields.io/npm/v/@tak1208/dsh-webui-transition-settings)](https://www.npmjs.com/package/@tak1208/dsh-webui-transition-settings)

</div>

Optional settings plugin for `@tak1208/dsh-webui-transition`. It adds a **Transitions** page to the DSH (DeepSeek Harness) Web GUI Settings dialog for choosing how the main plugin falls back when it cannot infer the trigger element, and for tuning the **animation duration, initial scale, and opacity start** (global defaults with per-surface group overrides).

## Entry

**Settings → Transitions** (Chinese UI: `过渡动画`). The nav row shows the outline icon (`settings.section.icon`, generated from `assets/icons/outline.svg` by `pnpm build`; the slot is provided by dsh 0.2.2-alpha.3 and newer, older versions fall back to the shell's default gear).

## Options

| Setting | Values | Default | Meaning |
| --- | --- | --- | --- |
| Fallback without an anchor | `Fade only` / `Pointer origin` | `Fade only` | How an overlay enters when the trigger element cannot be inferred |
| Duration | integer 0–1000 ms | Auto | Transition duration; `0` disables transitions for that surface group |
| Initial scale | 0.5–1.0 (two decimals) | Auto | Start of the entry scale; `1` means no scaling |
| Opacity start | 0–1.0 (two decimals) | Auto | Start of the entry opacity; `0` means fully transparent |

- **Fade only** (`fade`): no geometric animation for this surface, opacity only.
- **Pointer origin** (`pointer`): scale from the most recent pointer position; when no pointer position is available it still degrades to fade only.
- **Two layers**: global defaults plus per-surface groups (menus & lists / dialogs / masks; "menus & lists" covers both `role="menu"` and `role="listbox"`). Priority is surface value → global value → built-in default; an empty surface field follows the global value, an empty global field is automatic.
- **Mask exception**: the global scale does not apply to masks (a full-screen mask entering from `scale(<1)` exposes the page edges); masks stay fixed at 1 unless a mask scale is set explicitly.
- Leaving a field empty means automatic; commit on blur or Enter; non-numeric input is not written; the reset button restores one field to automatic.
- `prefers-reduced-motion` outranks settings: when it is on, every duration becomes 0.

## Storage

- `localStorage` key: `dsh.webui-transition.settings.v1`
- Value: the complete JSON document; a `null` numeric field means automatic, and all are `null` by default:

```json
{
  "fallback": "fade",
  "durationMs": null,
  "scaleFrom": 0.96,
  "opacityFrom": null,
  "surfaces": {
    "menu": { "durationMs": 120, "scaleFrom": null, "opacityFrom": null },
    "dialog": { "durationMs": null, "scaleFrom": null, "opacityFrom": null },
    "mask": { "durationMs": null, "scaleFrom": null, "opacityFrom": null }
  }
}
```

- Takes effect immediately within the same tab (Cordis event); other tabs are synced through the `storage` event; no restart is needed.
- Clearing site data, private windows, a changed origin (port/host), or a different browser/profile wipes the value; the only consequence is falling back to automatic parameters, and the main plugin keeps working.
- Older plugin versions (v1.0.0 and earlier) drop the new fields when they write settings back; the key stays `…v1` and no migration is performed.

## Relationship to the main package

One npm package can only provide one client plugin, so this settings plugin is a separate package. The root package `@tak1208/dsh-webui-transition` depends on it via `workspace:^`, so installing the root package installs it as well; publish this package before the root package.

**The main plugin does not depend on this plugin**: without the settings plugin, or when no setting has ever been saved, the main plugin always runs normally with automatic parameters (`fade` + built-in duration/scale/opacity). This plugin only provides the settings UI and the settings panel's center-origin marker (`data-dsh-transition-origin="center"`: the main plugin recognises only that marker, not host attributes); it does not implement the animation itself. Without this plugin the settings panel falls back to the main plugin's default origin-aware behaviour.

## Implementation

- `src/browser.js`: client entry, `inject = ["slots", "locale"]`; registers the `settings.section` page, the `settings.section.icon` nav icon, and the zh/en dictionaries.
- `src/nav-icon.js`: the `settings.section.icon` component, **generated from `assets/icons/outline.svg` by `pnpm build` — do not edit it by hand**; the generator supports a whitelist of elements/attributes (anything else fails the build), sizes come from the shell, and colors inherit `currentColor`.
- `src/settings-page.js`: `createSettingsPage`, rendered with `SegmentedControl` (fallback mode), `SegmentedTabs` (targets), and `SettingsValueField` (numeric fields) from the shell baseline module `@deepseek-ai/dsh-client-ui-primitives` (no hand-written segmented control; layout uses `--dsw-*` tokens only); fields commit on Enter or blur, and an empty value means automatic.
- `src/panel-marker.js`: observes `document.body` and marks an inserted settings panel (`[role="dialog"][data-shortcut-modal="settings"]`) with the center-origin marker `data-dsh-transition-origin="center"`; the marker value is the shared opt-in contract with the main plugin.
- `src/contract.js`: the same settings contract as the root package `src/settings.js`, implemented independently (fallback mode + three parameters + per-surface groups + range constants, kept in sync by root-repo tests), plus the cross-package center-origin marker constants.
- `client.js`: build artifact (generated by `pnpm build` in the root repo; do not edit by hand).

## License

MIT
