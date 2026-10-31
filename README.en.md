# dsh-webui-transition

A third-party client plugin that adds open/close transitions to two places in the DSH (DeepSeek Harness) Web GUI: dropdown menus and the settings panel. It ships as a dsh bundle, runs entirely in the browser half, registers no slots, does not modify dsh source code, and has no third-party runtime dependencies.

## Scope

It only takes over the two surfaces the host does not animate, covering both enter and exit:

| Surface | Semantic selector | Enter | Exit |
| --- | --- | --- | --- |
| Dropdown menus (including the model menu inside Settings) | `role="menu"` | Fade in + float up (`-4px`) + slight scale (`.98`), about 150ms by default | Mirrored |
| Settings panel | `role="dialog"` + mask | Mask fades in (about 180ms); panel fades in + floats up (`12px`, about 220ms) | Mirrored |

- Duration and easing are read from host tokens (`--ds-transition-duration`, `--ds-transition-duration-fast`, `--ds-ease-in-out`) and clamped; the fallbacks are the values above.
- The host unmounts these nodes instantly on close, so exit uses a "ghost copy": an `inert` clone is inserted back in place and removed once the animation settles. It intercepts no input and stays out of the accessibility tree.
- Each element animates once per frame, so duplicate triggers do not replay it.

## Research Summary

- No existing plugin was found that can be installed as-is and meets the requirement.
- The runtime architecture borrows from `bilbillm/dsh-motion` (semantic classification + `MutationObserver` + WAAPI + paired exit ghosts, MIT).
- Motion parameters come from the finalized values in `dsh-motion-complete`.
- The source lives in `src/` as ESM modules split by responsibility; the `src/browser.js` entry is bundled by esbuild into the classic `client.js` required by the dsh client contract. There are no third-party runtime dependencies (esbuild is a development-time build tool only).

## Installation

This repository is a dsh bundle: `package.json` declares `dsh.bundle.patch` (one plugin line inserted by the Loader) and `dsh.client` (browser half, pointing at the build artifact `client.js`, classic script). It is compatible with dsh `0.2.2-alpha.2` (`engines.dsh: ">=0.2.2-alpha.2 <0.3.0"`).

**During development (before this repository is published)**: install it with dsh's `plugin_manager` tool, passing the absolute path of this repository as `target`:

```json
{ "action": "install_bundle", "target": "/absolute/path/to/dsh-webui-transition" }
```

- Since 0.2.1-alpha.2, dsh refuses to reinstall over an installed package (it returns `already-installed`); to reinstall, run `action: "remove_bundle"` first, then `install_bundle`.
- After installation the plugin shows up in Settings → Built-in plugins.

**After publishing to npm**:

```bash
dsh plugin --profile web add @tak1208/dsh-webui-transition
```

Uninstall: `dsh plugin --profile web remove @tak1208/dsh-webui-transition` (or `plugin_manager` with `remove_bundle`).

## Opting Out

Set `data-dsh-transition="off"` on any UI element or one of its ancestors and the whole subtree is left untouched (no enter animation, no exit ghost):

```html
<div data-dsh-transition="off">
  <div role="menu">…</div>
</div>
```

The attribute can also be added or removed at runtime. This is the same mechanism as `dsh-motion`'s `data-dsh-motion="off"`.

## Reduced Motion

When the system "Reduce motion" setting is on (`prefers-reduced-motion: reduce`), no animation plays and no ghost node is created. Turning it on at runtime immediately cancels animations that are playing and removes exit ghosts; after that, new animations automatically stay off, and they resume once the setting is turned off.

## Coexistence with Other Motion Plugins

- Works alongside motion-related plugins such as `dsh-reduce-effects` and `dsh-theme-studio`: this plugin only fills the two surfaces the host does not animate and never overrides existing host animations — an element with unfinished WAAPI animations or a non-`none` CSS `animation-name` is skipped entirely (the `canAnimate` gate).
- It does not do message entrance, streaming rendering, or smooth scrolling, so it does not overlap with plugins such as `dsh-smooth-stream`.
- To turn this plugin off as well: use `data-dsh-transition="off"` above, or enable the system "Reduce motion" setting.

## Known Limitations

- Only two surfaces: dropdown menus and the settings panel. No message entrance/streaming/smooth scrolling, no tab switching, toggles, or indicator bars inside Settings, and no menu pagination.
- Registers no slots and renders no components; observation + WAAPI only.
- Does not modify host unmount timing (all exits use the ghost copy, no delayed-unmount patch).
- Does not modify dsh source code and does not write `package.json` / `cordis.patch.yml` into a profile.
- Baseline is dsh `0.2.2-alpha.2`; after a dsh upgrade (especially 0.3.0 and later) the semantic selectors and client contract need re-checking.
- Coverage depends on the host's semantic DOM (`role="menu"`, `role="dialog"` + `[data-shortcut-modal="settings"]`); changes to that structure affect coverage.
- A glass surface's `backdrop-filter` (such as the menu's `.material` layer) stays blurred throughout the transition: the menu's fade is applied to its direct children and exit ghosts no longer strip `backdrop-filter`, so the page backdrop is sampled for the whole enter/exit animation.
- The menu container's `box-shadow` (the host elevation shadow) fades in/out together with the animation, so there is no "outline-only" frame at the start and no shadow left behind once the content has faded out.
- If a direct child of the menu carries its own host CSS animation, the plugin briefly overrides its `opacity` (the fill is released when the animation settles); this only affects the edge case where the host animates a child's `opacity`.

## Architecture and Development

The source is a set of ESM modules under `src/`, one responsibility per file: `defs.js` (constants and the `SURFACE_DEFS` surface descriptors), `utils.js` (shared small utilities), `policy.js` (token / reduced-motion / duration policy), `tracker.js` (surface state machine and DOM classification), `gate.js` (WAAPI / CSS animation / CSS transition conflict gate), `frames.js` (pure keyframe functions), `runtime.js` (observation, batching, enter animations, and exit ghosts), and `browser.js` (browser entry, registered on `window.__ModuleLoader__`). The entry is bundled by esbuild into the classic iife artifact `client.js` at the repository root: its top level contains only `window.__ModuleLoader__.load({ id, factory })` with no `import`/`export`, and the runtime factory lives inside the factory closure and exposes the frozen signature via `exports.*`.

`client.js` is a build artifact generated by `pnpm build`; **do not edit it by hand**. Change the implementation under `src/` and rebuild.

```bash
pnpm install
pnpm build   # src/browser.js → client.js (classic iife)
pnpm test    # pretest builds first, then runs node --test
```

Tests use Node's built-in `node --test` with `jsdom`: `test/helpers/env.mjs` sets up jsdom plus fake `__ModuleLoader__` / fake `animate` and other fixtures, each `src/` module has its own test file, and `bundle.test.mjs` smoke-tests the build artifact for the classic contract.

## License

[MIT](./LICENSE) © tak1208
