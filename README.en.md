<div align="center">
<img src="assets/icons/logo.png" alt="dsh-webui-transition logo" width="96" height="96" />
<h1>dsh-webui-transition</h1>
</div>


<div align="center">

[![npm version](https://img.shields.io/npm/v/@tak1208/dsh-webui-transition)](https://www.npmjs.com/package/@tak1208/dsh-webui-transition)
[![CI](https://github.com/T-MKT/dsh-webui-transition/actions/workflows/ci.yml/badge.svg)](https://github.com/T-MKT/dsh-webui-transition/actions/workflows/ci.yml)

</div>

A third-party client plugin that adds open/close transitions to two places in the DSH (DeepSeek Harness) Web GUI: dropdown menus and the settings panel. It ships as a dsh bundle, runs entirely in the browser half, does not modify dsh source code, and has no third-party runtime dependencies.

Since v0.3.0 the animation is **origin-aware**: when the trigger element can be inferred, the popup scales from the trigger's nearest edge/point as `transform-origin`; the exit reuses the origin cached on entry. When no trigger can be inferred, the configured fallback applies: **fade only** (default) or **pointer origin**. Since v1.0.0 the settings panel does a **center-origin scale**: it scales from its own center + fades in, independent of any trigger (the settings plugin marks the panel with `data-dsh-transition-origin="center"`; the main plugin only recognises the marker). The settings UI is provided by a separate plugin in the same bundle, `@tak1208/dsh-webui-transition-settings` (Settings → Transitions).

## Scope

It only takes over the two surfaces the host does not animate, covering both enter and exit:

| Surface | Semantic selector | Enter | Exit |
| --- | --- | --- | --- |
| Dropdown menus (including the model menu inside Settings) | `role="menu"` | Scales from the trigger's nearest edge/point (`.98`) + fades in, about 150ms by default | Reuses the entry origin, mirrored |
| Settings panel | `role="dialog"` + `data-dsh-transition-origin="center"` (marked by the settings plugin) | Scales from the panel's own center (`.98`) + fades in (about 220ms), independent of any trigger, always applied | Mirrored |
| Other `role="dialog"` popover panels (such as the Agent Team board and the context usage panel) | `role="dialog"` (optionally with a mask) | Mask fades in (about 180ms); panel scales from the trigger (`.98`) + fades in (about 220ms) | Mirrored |

- **Origin-aware**: the trigger is inferred in priority order — DOM adjacency (submenu / non-portal wrapper) → `aria-controls` → `[aria-expanded="true"][aria-haspopup]` (24px adjacency gate + 1400px distance cap) → most recent pointer target (within 2.5s) → keyboard focus. When nothing can be inferred, the configured fallback applies.
- **Surface-level origin marker**: a plugin that owns a surface may set `data-dsh-transition-origin="center"` on it; the main plugin then **unconditionally** uses the surface's own center as `transform-origin`, skipping trigger inference and the fallback. Currently only the settings plugin marks the settings panel (the marker belongs to the owning plugin; the main plugin recognises no host attributes such as `data-shortcut-modal` or `aria-modal`).
- **Fallback modes**: `Fade only` (default, no geometry at all) or `Pointer origin` (scale from the most recent pointer position); if neither is available it still degrades to fade only.
- Duration and easing are read from host tokens (`--ds-transition-duration`, `--ds-transition-duration-fast`, `--ds-ease-in-out`) and clamped; the fallbacks are the values above.
- The host unmounts these nodes instantly on close, so exit uses a "ghost copy": an `inert` clone is inserted back in place and removed once the animation settles. It intercepts no input and stays out of the accessibility tree.
- Each element animates once per frame, so duplicate triggers do not replay it.

## Settings

The settings page is provided by the separate plugin `@tak1208/dsh-webui-transition-settings`, at **Settings → Transitions**, with the outline icon in the nav row. It currently has one item:

| Setting | Values | Default | Meaning |
| --- | --- | --- | --- |
| Fallback when no anchor is found | `Fade only` / `Pointer origin` | `Fade only` | How a popup enters when its trigger cannot be inferred |

- Storage: `localStorage` key `dsh.webui-transition.settings.v1`, JSON `{ "fallback": "fade" | "pointer" }`.
- Same-tab changes take effect immediately through a Cordis event; cross-tab changes fall back to the `storage` event.
- **Without the settings plugin, or before any setting is saved, the main plugin runs normally with the default `fade`**; the settings plugin is only an optional UI entry.
- Browser "clear browsing data / site data", closing incognito, changing origin (port/host), or switching browser/profile all clear the setting; the only consequence is falling back to the default `fade`, and the main plugin keeps working.

## Installation

This repository is a dsh bundle: the root `package.json` declares `dsh.bundle.patch` (the Loader inserts two plugin rows: the main plugin and the settings plugin) and `dsh.client` (browser half, pointing at the build artifact `client.js`, classic script). The root package depends on the settings package via `workspace:^`; publishing must go through pnpm, which rewrites it to `^1.0.0` (see "Publishing" below).
Developed against dsh `0.2.2-rc.1`, compatible with dsh `0.2.2-alpha.2` and above. (`engines.dsh: ">=0.2.2-alpha.2 <0.3.0"`).

**Install from npm (recommended)**:

```bash
dsh plugin --profile web add @tak1208/dsh-webui-transition
```

One command installs both the root package and the settings package it depends on. You can also install the npm package directly with dsh's `plugin_manager` tool:

```json
{ "action": "install_bundle", "target": "@tak1208/dsh-webui-transition" }
```

- Since 0.2.1-alpha.2, dsh refuses to reinstall over an installed package (it returns `already-installed`); to reinstall, run `action: "remove_bundle"` first, then `install_bundle`.
- After installation the plugin shows up in Settings → Built-in plugins.
- Uninstall: `dsh plugin --profile web remove @tak1208/dsh-webui-transition` (or `plugin_manager` with `remove_bundle`).

**Install from source (during development / before publication)**: this repository is a pnpm workspace (root package + `packages/dsh-webui-transition-settings`). Because the root package depends on the settings package via `workspace:^`, **running `install_bundle` against the repository's absolute path fails on the workspace protocol**. Development workflow:

1. Run `pnpm install && pnpm build` to generate both `client.js` artifacts;
2. Link / install the two packages into the profile separately (or publish a prerelease of the settings package first, then install the root package);
3. Publish order: `dsh-webui-transition-settings` first, then `dsh-webui-transition`.

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
- Registers no slots and renders no components (except the settings plugin); the main plugin is observation + WAAPI only.
- Does not modify host unmount timing (all exits use the ghost copy, no delayed-unmount patch).
- Does not modify dsh source code and does not write `package.json` / `cordis.patch.yml` into a profile.
- Baseline is dsh `0.2.2-alpha.2`; older dsh versions are not supported yet. After a dsh upgrade (especially 0.3.0 and later) the semantic selectors, `settings.section`, and client contract need re-checking.
- Coverage depends on the host's semantic DOM (`role="menu"`, `role="dialog"` + `[data-shortcut-modal="settings"]`); changes to that structure affect coverage.
- Trigger inference is heuristic: it keeps a 2.5s freshness window, a 24px adjacency gate, and a 1400px distance cap; when it cannot be sure it prefers the fallback over guessing.
- A glass surface's `backdrop-filter` (such as the menu's `.material` layer) stays blurred throughout the transition: the menu's fade is applied to its direct children and exit ghosts no longer strip `backdrop-filter`, so the page backdrop is sampled for the whole enter/exit animation.
- When the glass layer lives on a `::before` / `::after` pseudo-element (the Agent Team board in the current host), the plugin animates the pseudo-element's own opacity and keeps only scaling and shadow on the surface, so the blur holds during the animation; where WAAPI's `pseudoElement` option is unsupported (older non-Chromium implementations) that glass layer does not fade, but the blur still holds for the whole transition. Panels whose glass sits on the element itself (such as the context usage panel) keep their existing whole-surface fade.
- The menu container's `box-shadow` (the host elevation shadow) fades in/out together with the animation, so there is no "outline-only" frame at the start and no shadow left behind once the content has faded out.
- If a direct child of the menu carries its own host CSS animation, the plugin briefly overrides its `opacity` (the fill is released when the animation settles); this only affects the edge case where the host animates a child's `opacity`.

## Architecture and Development

The repository is a pnpm workspace with two packages:

- Root package `@tak1208/dsh-webui-transition`: the bundle + main client plugin. The source is a set of ESM modules under `src/`, one responsibility per file: `defs.js` (constants and the `SURFACE_DEFS` surface descriptors), `utils.js` (shared small utilities), `policy.js` (token / reduced-motion / duration policy), `tracker.js` (surface state machine and DOM classification), `gate.js` (WAAPI / CSS animation / CSS transition conflict gate), `settings.js` (localStorage settings contract), `origin.js` (interaction capture, trigger resolution, and origin geometry), `marker.js` (surface-level center-origin marker contract and center geometry), `frames.js` (pure keyframe functions, including origin-aware geometry and the pseudo-element glass split), `runtime.js` (observation, batching, enter animations, and exit ghosts), and `browser.js` (browser entry, registered on `window.__ModuleLoader__`). The entry is bundled by esbuild into the classic iife artifact `client.js` at the repository root.
- Settings package `packages/dsh-webui-transition-settings`: a separate client plugin. `src/browser.js` registers the `settings.section` page and its `settings.section.icon` nav icon (built from `assets/icons/outline.svg` by `pnpm build`), `src/settings-page.js` renders it with `SegmentedControl` from `@deepseek-ai/dsh-client-ui-primitives`, `src/contract.js` independently implements the same settings contract as the root `src/settings.js` (kept in sync by `test/contract.test.mjs`), and `src/panel-marker.js` observes `document.body` to mark the settings panel with the center origin. Its build artifact is the package's `client.js` (esbuild cjs wrapped in a `__ModuleLoader__.load` factory).

Both `client.js` files are build artifacts generated by `pnpm build`; **do not edit them by hand**. Change the implementation under `src/` and rebuild.

```bash
pnpm install
pnpm build   # main iife + settings factory artifacts
pnpm test    # pretest builds first, then runs node --test
```

Tests use Node's built-in `node --test` with `jsdom`: `test/helpers/env.mjs` sets up jsdom plus fake `__ModuleLoader__`, fake `animate`, fake storage, and other fixtures; each `src/` module has its own test file. `bundle.test.mjs` smoke-tests both build artifacts for the classic contract, `contract.test.mjs` compares the two settings contracts, and `settings-page.test.mjs` / `settings-plugin.test.mjs` cover the settings page and slot registration.

## Publishing

Publish the two packages in order: `@tak1208/dsh-webui-transition-settings` first, then the root package `@tak1208/dsh-webui-transition` (the root package depends on the settings package's `^1.0.0`).

Packing must go through pnpm: `pnpm publish`, or `pnpm pack` followed by `npm publish <tarball>` (use the latter when npm CLI's 2FA web authentication is needed). **Do not publish from the directory with `npm pack` / `npm publish`**: npm does not rewrite the `workspace:` protocol, the tarball keeps `workspace:^`, and consumers fail to install (`EUNSUPPORTEDPROTOCOL`: `Unsupported URL Type "workspace:"`).

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pull requests and pushes to `main` / `feat/**`: `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm test` → verify both `client.js` artifacts match the commit. It does not install dsh, publish, or use secrets.

## License

[MIT](./LICENSE) © tak1208
