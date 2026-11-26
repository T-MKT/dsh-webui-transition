<div align="center">
<img src="assets/icons/logo.png" alt="dsh-webui-transition logo" width="96" height="96" />
<h1>dsh-webui-transition</h1>
</div>


<div align="center">

[![npm version](https://img.shields.io/npm/v/@tak1208/dsh-webui-transition)](https://www.npmjs.com/package/@tak1208/dsh-webui-transition)
[![CI](https://github.com/T-MKT/dsh-webui-transition/actions/workflows/ci.yml/badge.svg)](https://github.com/T-MKT/dsh-webui-transition/actions/workflows/ci.yml)

</div>

A third-party client plugin that adds open/close transitions to two places in the DSH (DeepSeek Harness) Web GUI: dropdown menus and the settings panel. It ships as a dsh bundle, runs entirely in the browser half, does not modify dsh source code, and has no third-party runtime dependencies.

Since v0.3.0 the animation is **origin-aware**: when the trigger element can be inferred, the popup scales from the trigger's nearest edge/point as `transform-origin`; the exit reuses the origin cached on entry. When no trigger can be inferred, the configured fallback applies: **fade only** (default) or **pointer origin**. Since v1.0.0 the settings panel does a **center-origin scale**: it scales from its own center + fades in, independent of any trigger (the plugin itself marks the panel with `data-dsh-transition-origin="center"`; the animation code only recognises the marker). Since v1.1.0 the animation **duration, initial scale, and opacity start** are all configurable (global defaults with per-surface overrides, applied immediately). Since v1.2.0 the configuration form lives inside **Plugins**: open the sidebar Plugins → `@tak1208/dsh-webui-transition` detail page to tune it (Settings no longer has this page), and the repository is back to a single package.

## Scope

It only takes over the two surfaces the host does not animate, covering both enter and exit:

| Surface | Semantic selector | Enter | Exit |
| --- | --- | --- | --- |
| Dropdown menus (including the model menu inside Settings) | `role="menu"` | Scales from the trigger's nearest edge/point (`.98`) + fades in, about 150ms by default, configurable | Reuses the entry origin, mirrored |
| Settings panel | `role="dialog"` + `data-dsh-transition-origin="center"` (marked by this plugin) | Scales from the panel's own center (`.98`) + fades in (about 220ms by default, configurable), independent of any trigger, always applied | Mirrored |
| Other `role="dialog"` popover panels (such as the Agent Team board and the context usage panel) | `role="dialog"` (optionally with a mask) | Mask fades in (about 180ms by default, configurable); panel scales from the trigger (`.98`) + fades in (about 220ms by default, configurable) | Mirrored |

- **Origin-aware**: the trigger is inferred in priority order — DOM adjacency (submenu / non-portal wrapper) → `aria-controls` → `[aria-expanded="true"][aria-haspopup]` (24px adjacency gate + 1400px distance cap) → most recent pointer target (within 2.5s) → keyboard focus. When nothing can be inferred, the configured fallback applies.
- **Surface-level origin marker**: a plugin that owns a surface may set `data-dsh-transition-origin="center"` on it; the animation code then **unconditionally** uses the surface's own center as `transform-origin`, skipping trigger inference and the fallback. Currently this plugin marks the settings panel (the marker belongs to the owning plugin; the animation code recognises no host attributes such as `data-shortcut-modal` or `aria-modal`).
- **Fallback modes**: `Fade only` (default, no geometry at all) or `Pointer origin` (scale from the most recent pointer position); if neither is available it still degrades to fade only.
- Duration and easing are read from host tokens (`--ds-transition-duration`, `--ds-transition-duration-fast`, `--ds-ease-in-out`) and clamped; the fallbacks are the values above. All three animation parameters can be overridden in the settings page (see below).
- The host unmounts these nodes instantly on close, so exit uses a "ghost copy": an `inert` clone is inserted back in place and removed once the animation settles. It intercepts no input and stays out of the accessibility tree.
- Each element animates once per frame, so duplicate triggers do not replay it.

## Settings

The configuration form is embedded in the plugin manager: **Plugins (sidebar) → `@tak1208/dsh-webui-transition` → detail page**, between the description and the row list. It has two groups — fallback mode and animation parameters:

| Setting | Values | Default | Meaning |
| --- | --- | --- | --- |
| Fallback when no anchor is found | `Fade only` / `Pointer origin` | `Fade only` | How a popup enters when its trigger cannot be inferred |
| Duration | integer 0–1000 ms | Auto | Transition duration; `0` disables transitions for that surface group |
| Initial scale | 0.5–1.0 (two decimals) | Auto | Start of the entry scale; `1` means no scaling |
| Opacity start | 0–1.0 (two decimals) | Auto | Start of the entry opacity; `0` means fully transparent |

Animation parameters have two layers: **global** and **per surface group** (menus & lists / dialogs / masks; "menus & lists" covers both `role="menu"` and `role="listbox"`).

- **Priority**: surface value → global value → built-in default. An empty surface field follows the global value; an empty global field keeps the previous behaviour: duration from the host token (`--ds-transition-duration` / `--ds-transition-duration-fast`) clamped per surface, scale/opacity from built-in defaults (menus and dialogs 0.98, masks 1; opacity starts at 0).
- An explicitly configured duration is validated against 0–1000 ms and does **not** use the per-surface 120–240 ms clamp; `0` disables both enter and exit transitions for that surface group.
- **Mask exception**: a full-screen mask entering from `scale(<1)` exposes the page edges, so the global scale does not apply to masks (masks stay fixed at 1); only an explicit mask scale overrides that.
- Leaving a field empty means automatic; commit on blur or Enter; non-numeric input is not written and reverts on blur; the reset button restores one field to automatic.
- `prefers-reduced-motion` outranks settings: when it is on, every transition duration becomes 0.
- Storage: `localStorage` key `dsh.webui-transition.settings.v1`, JSON such as:

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

- Same-tab changes take effect immediately through a Cordis event; cross-tab changes fall back to the `storage` event; no restart is needed.
- **Before any setting is saved, the plugin runs normally with automatic parameters**; the configuration form is only an optional UI entry.
- Browser "clear browsing data / site data", closing incognito, changing origin (port/host), or switching browser/profile all clear the setting; the only consequence is falling back to automatic parameters, and the plugin keeps working.
- Older plugin versions (v1.0.0 and earlier) drop the new fields when they write settings back; this is a known and accepted degradation (the key stays `…v1` and no migration is performed).

## Installation

This repository is a dsh bundle: the root `package.json` declares `dsh.bundle.patch` (the Loader inserts one plugin row) and `dsh.client` (browser half, pointing at the build artifact `client.js`, classic script). The repository is a single package with no workspace dependency.
Developed against dsh `0.2.2-rc.1`, compatible with dsh `0.2.2-alpha.2` and above. (`engines.dsh: ">=0.2.2-alpha.2 <0.3.0"`).

**Install from npm (recommended)**:

```bash
dsh plugin --profile web add @tak1208/dsh-webui-transition
```

One command installs it. You can also install the npm package directly with dsh's `plugin_manager` tool:

```json
{ "action": "install_bundle", "target": "@tak1208/dsh-webui-transition" }
```

- Since 0.2.1-alpha.2, dsh refuses to reinstall over an installed package (it returns `already-installed`); to reinstall, run `action: "remove_bundle"` first, then `install_bundle`.
- After installation the plugin shows up in Settings → Built-in plugins.
- Uninstall: `dsh plugin --profile web remove @tak1208/dsh-webui-transition` (or `plugin_manager` with `remove_bundle`).

**Install from source (during development / before publication)**: this repository is a single package with no workspace dependency, so the repository's absolute path can be installed into a profile directly:

1. Run `pnpm install && pnpm build` to generate `client.js`;
2. `dsh plugin --profile web add /path/to/dsh-webui-transition`;
3. Refresh the GUI page and it takes effect.

## Opting Out

Set `data-dsh-transition="off"` on any UI element or one of its ancestors and the whole subtree is left untouched (no enter animation, no exit ghost):

```html
<div data-dsh-transition="off">
  <div role="menu">…</div>
</div>
```

The attribute can also be added or removed at runtime.

## Reduced Motion

When the system "Reduce motion" setting is on (`prefers-reduced-motion: reduce`), no animation plays and no ghost node is created. Turning it on at runtime immediately cancels animations that are playing and removes exit ghosts; after that, new animations automatically stay off, and they resume once the setting is turned off.

## Known Limitations

- Only two semantic surface types: dropdown menus and `role="dialog"` panels (the settings panel, the Agent Team board, and so on). No message entrance/streaming/smooth scrolling, no tab switching, toggles, or indicator bars inside Settings, and no menu pagination.
- No platform-native approach (CSS Anchor Positioning / View Transitions / full-rect clip-path morph), no FLIP, and no surfaces inside iframes or Shadow DOM.
- Apart from the plugin detail page's configuration form (`plugins.bundle.config`), it registers no other slots; the animation side is observation + WAAPI only.
- Does not modify host unmount timing (all exits use the ghost copy, no delayed-unmount patch).
- Does not modify dsh source code and does not write `package.json` / `cordis.patch.yml` into a profile.
- Baseline is dsh `0.2.2-alpha.2`; older dsh versions are not supported yet. After a dsh upgrade (especially 0.3.0 and later) the semantic selectors, `plugins.bundle.config`, and client contract need re-checking.
- Coverage depends on the host's semantic DOM (`role="menu"`, `role="dialog"` + `[data-shortcut-modal="settings"]`); changes to that structure affect coverage.
- Trigger inference is heuristic: it keeps a 2.5s freshness window, a 24px adjacency gate, and a 1400px distance cap; when it cannot be sure it prefers the fallback over guessing.
- A glass surface's `backdrop-filter` (such as the menu's `.material` layer) stays blurred throughout the transition: the menu's fade is applied to its direct children and exit ghosts no longer strip `backdrop-filter`, so the page backdrop is sampled for the whole enter/exit animation.
- When the glass layer lives on a `::before` / `::after` pseudo-element (the Agent Team board in the current host), the plugin animates the pseudo-element's own opacity and keeps only scaling and shadow on the surface, so the blur holds during the animation; where WAAPI's `pseudoElement` option is unsupported (older non-Chromium implementations) that glass layer does not fade, but the blur still holds for the whole transition. Panels whose glass sits on the element itself (such as the context usage panel) keep their existing whole-surface fade.
- The menu container's `box-shadow` (the host elevation shadow) fades in/out together with the animation, so there is no "outline-only" frame at the start and no shadow left behind once the content has faded out.
- If a direct child of the menu carries its own host CSS animation, the plugin briefly overrides its `opacity` (the fill is released when the animation settles); this only affects the edge case where the host animates a child's `opacity`.

## Architecture and Development

The repository is a single package: one dsh bundle + one client plugin:

- `@tak1208/dsh-webui-transition`: the bundle + client plugin. The source is a set of ESM modules under `src/`, one responsibility per file: `defs.js` (constants and the `SURFACE_DEFS` surface descriptors), `utils.js` (shared small utilities), `policy.js` (createPolicy: token / reduced-motion / reads settings to compute the final duration and geometry), `tracker.js` (surface state machine and DOM classification), `gate.js` (WAAPI / CSS animation / CSS transition conflict gate), `settings.js` (localStorage settings contract: fallback mode + three animation parameters + per-surface groups, with per-field normalisation and clamping), `settings-page.js` (the React configuration page: `SegmentedControl` fallback mode + `SegmentedTabs` global / per-surface targets + `SettingsValueField` numeric fields), `settings-locale.js` (zh/en copy for the configuration page), `panel-marker.js` (observes `document.body` to mark the settings panel with the center origin), `origin.js` (interaction capture, trigger resolution, and origin geometry), `marker.js` (surface-level center-origin marker contract and center geometry), `frames.js` (pure keyframe functions, including origin-aware geometry, the pseudo-element glass split, and timing overrides), `runtime.js` (observation, batching, enter animations, and exit ghosts), and `browser.js` (the single entry: runtime + configuration page registration + panel marking). The entry is bundled by esbuild to cjs and wrapped in `__ModuleLoader__.load({ id, factory })`, producing the classic script `client.js` at the repository root.

`client.js` is a build artifact generated by `pnpm build`; **do not edit it by hand**. Change the implementation under `src/` and rebuild.

```bash
pnpm install
pnpm build   # the single client.js artifact
pnpm test    # pretest builds first, then runs node --test
```

Tests use Node's built-in `node --test` with `jsdom`: `test/helpers/env.mjs` sets up jsdom plus fake `__ModuleLoader__`, fake `animate`, fake storage, and other fixtures; each `src/` module has its own test file. `bundle.test.mjs` smoke-tests the build artifact for the classic contract and the `apply` wiring, `panel-marker.test.mjs` covers settings-panel marking, and `settings-page.test.mjs` covers configuration-page rendering, field commits, and cross-tab sync.

## Publishing

Single-package release: run `pnpm publish`; when npm CLI's 2FA web authentication is needed, `pnpm pack` followed by `npm publish <tarball>`. Confirm `client.js` is rebuilt and matches the commit before publishing.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pull requests and pushes to `main` / `feat/**`: `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm test` → verify `client.js` matches the commit. It does not install dsh, publish, or use secrets.

## License

[MIT](./LICENSE) © tak1208
