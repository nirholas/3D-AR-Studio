# 3D AR Studio

**Drop a full augmented-reality studio into any web page.**

Place as many 3D models as you like in your real room through the camera, describe a new one
and watch it appear, arrange everything by hand, then share the whole scene as a link, a QR
code, or a live room someone else can build in with you.

[**Live demo**](https://nirholas.github.io/3D-AR-Studio/) · [npm](https://www.npmjs.com/package/3d-ar-studio) · [MCP server](#mcp-server)

```html
<script type="module" src="https://unpkg.com/3d-ar-studio/dist/ar-studio.min.js"></script>
<ar-studio></ar-studio>
```

That is a working AR studio. No build step, no API key, no account. It comes wired to a free
library of a few hundred public-domain models and a free, keyless text-to-3D lane; point it at
your own catalogue with one option when you are ready.

---

## Why this exists

Every web-AR drop-in places exactly one model and then hands off to a native viewer, which
ends the session. This one keeps the whole scene in your page:

- **Many models, one room.** Place, drag, pinch-resize, twist-rotate and duplicate as many
  models as you want in a single live camera view.
- **Generate without leaving the camera.** Type "a brass desk lamp" into the dock. The
  generation runs behind the live view and the finished model drops into the room.
- **Real WebXR where it exists.** An always-armed hit-test reticle, one `XRAnchor` per placed
  model, real-world light estimation, and depth occlusion so models hide behind your furniture.
- **A designed path on every other device.** Camera passthrough with gyro world-lock and
  room-light matching on iOS, a grid preview with a QR hand-off on desktop, plus Quick Look and
  Scene Viewer for single models.
- **Scenes are links.** Models, positions, rotations and scales round-trip through the URL.
  Compose on a laptop, scan the QR, it reopens exactly on your phone.
- **Build together, live.** Open a room, share a six-character code, and every add and move
  syncs to everyone in it.
- **Characters actually move.** Any humanoid GLB with no baked animation gets an idle clip
  retargeted onto its own skeleton. No rig allow-list, no T-poses.
- **Agents can drive it.** A bundled MCP server lets Claude, ChatGPT or your own agent
  generate a model, compose an arrangement, and hand a person one link that opens it in
  their room.

The rendering ladder, anchor lifecycle, retargeting pipeline, scene format and shared-room
protocol are extracted from the AR surfaces running in production on
[three.ws](https://three.ws), and generalized so they work on your site with your models.

---

## Install

```bash
npm i 3d-ar-studio three
```

`three` is a peer dependency, so you keep one copy of it and pick the version. The CDN bundle
(`dist/ar-studio.min.js`) has three.js inside it and needs nothing else.

```js
import { createArStudio } from '3d-ar-studio'

const studio = createArStudio('#stage', {
  branding: { title: 'Acme AR', accent: '#00b894' },
})

studio.on('add', ({ placement }) => console.log('placed', placement.title))
```

The studio fills its host element absolutely, so give the host a height (any positioned box
with a real height works; a `<div>` with no height gets a sensible `70vh` default rather than
rendering invisibly).

### Scaffold a deployable page

```bash
npx 3d-ar-studio create my-ar-site     # a folder you can publish as-is
cd my-ar-site
npx 3d-ar-studio dev                   # look at it locally
npx 3d-ar-studio deploy                # push it and turn on GitHub Pages
```

`deploy` prints every `git` and `gh` command before it runs it. It needs
[git](https://git-scm.com) and the [GitHub CLI](https://cli.github.com); without them it tells
you the three manual steps instead of failing silently.

Templates: `static` (one HTML file, no build), `vite`, `react`.

Both `3d-ar-studio` and `ar-studio` run the CLI. The MCP server is a separate
binary in its own package, so `npx 3d-ar-studio-mcp` resolves cleanly: see
[MCP server](#mcp-server).

---

## Your own models

The tray is filled from three.ws by default: a few hundred public-domain (CC0) props, free for
commercial use, served with open CORS. Swap in your own with the `assets` option.

**A JSON file anywhere.** Five common shapes are read without reshaping:

```js
createArStudio(el, { assets: 'https://cdn.acme.com/models.json' })
```

```jsonc
// Any of these work:
[ { "url": "https://cdn.acme.com/chair.glb", "name": "Aero chair" } ]
{ "items":     [ … ] }
{ "objects":   [ … ] }   // three.ws object library
{ "creations": [ … ] }   // three.ws forge gallery
{ "models":    [ … ] }
```

Per entry, the model URL is read from the first present of `src`, `url`, `glb`, `glb_url`,
`glbUrl`, `file` or `model`; the label from `title`, `label`, `name` or `prompt`; and the
thumbnail from `poster`, `thumb`, `thumbnail`, `image` or `preview_image_url`. Anything that
is not an https (or site-relative) URL is dropped rather than handed to the loader.

**A list you hold in code:**

```js
import { staticSource } from '3d-ar-studio/sources'

createArStudio(el, {
  assets: staticSource({
    label: 'Our furniture',
    items: [{ src: 'https://cdn.acme.com/chair.glb', title: 'Aero chair', poster: '…' }],
  }),
})
```

**Several tabs at once, in the order you want them:**

```js
createArStudio(el, { assets: ['recent', myCatalogue, 'objects', 'link'] })
```

Built-in keys: `'three.ws'` (the default set), `'recent'`, `'objects'`, `'community'`, `'link'`.

**Anything else.** A source is an object with a `list()`:

```js
createArStudio(el, {
  assets: {
    id: 'search',
    label: 'Search',
    searchable: true,
    async list() {
      const rows = await fetch('/api/models').then((r) => r.json())
      return rows.map((m) => ({ src: m.glb, title: m.name, poster: m.thumb }))
    },
  },
})
```

Throwing from `list()` is fine: the tray renders a designed error state with a Retry button.

**Your users can retarget it too**, without touching your code: `?assets=https://…/manifest.json`
on the page URL. Only https URLs are accepted, and every model source is re-validated before it
reaches the loader, so a hostile link can add a catalogue but can never smuggle a
`javascript:` or `data:` model into the scene. Set `allowUrlOverride: false` to switch that off.

### CORS

Models are loaded by the browser, so the host serving your `.glb` files has to allow
cross-origin requests (`access-control-allow-origin`). If a model fails to load, that is
almost always why, and the studio says so in the status line rather than failing silently.

---

## Options

| Option | Default | What it does |
| --- | --- | --- |
| `assets` | `'three.ws'` | Where models come from: a preset key, a manifest URL, a source object, or an array of them. |
| `generate` | enabled | `{ enabled, endpoint, kind, tier, timeoutMs, pollMs }`. `endpoint` is any MCP server exposing a compatible generate tool. |
| `rooms` | enabled | `{ enabled, server }`. Point `server` at your own Colyseus deployment to host shared rooms yourself. |
| `animations` | three.ws idle clip | `{ enabled, manifestUrl, clip }`. The clip retargeted onto humanoid models that ship no animation. |
| `lighting` | `'studio'` HDRI | `{ preset, urls }`. `preset: null` uses procedural lighting only and downloads no HDRI. |
| `branding` |: | `{ title, accent, backHref, backLabel }`. |
| `shareBaseUrl` | this page | Where share links and QR codes point. |
| `origin` | `https://three.ws` | Origin for the hosted "View in your space" launcher and viewer links. |
| `persistKey` | `'ar-studio:scene:v1'` | localStorage key for the saved scene. Change it to run two studios on one origin. |
| `persist` | `true` | Restore the last scene on load. |
| `maxPlacements` | `20` | Cap on simultaneous models. Keeps low-end phones interactive. |
| `fullscreen` | auto | Render as a fixed full-screen layer. Defaults to true only when mounted on `document.body`. |
| `allowUrlOverride` | `true` | Honour `?assets=`, `?src=`, `?room=` and `?forge=` on the hosting page's URL. |
| `onEvent` | `null` | Called with `(event, detail)` for every notable action. Wire it to your analytics. |

### URL parameters

| Parameter | Effect |
| --- | --- |
| `?assets=<https url>` | Swap the catalogue. |
| `?src=<glb>&title=<name>` | Load models into the scene. Repeatable. |
| `#s=<payload>` | Reopen a full arrangement, transforms included. Written by `shareUrl()`. |
| `?room=<code>` | Join a shared room. |
| `?forge=<prompt>` | Start a generation on load. |

### Methods

```js
await studio.addModel({ src, title })        // place a model
studio.clear()                               // remove everything; returns what was there
studio.getScene()                            // [{ src, title, x, z, yaw, scale }]
await studio.setScene(items)                 // replace the arrangement
studio.shareUrl()                            // a link that reopens it exactly
await studio.generate('a brass desk lamp')   // text to 3D, into the room
studio.viewInYourSpace(src, title)           // hand one model to Quick Look / Scene Viewer
await studio.startCamera()                   // needs a user gesture on iOS
await studio.toggleImmersive()               // enter or leave WebXR
await studio.openRoom()                      // returns the room code
studio.destroy()                             // releases camera, socket and GPU context
```

### Events

`studio.on(name, fn)` returns an unsubscribe function. The same events also fire as
`ar-studio:<name>` DOM events on the mounted element.

| Event | Detail |
| --- | --- |
| `add` | `{ placement, remote }` |
| `remove` | `{ src, title }` |
| `select` | `{ placement }` (null when deselected) |
| `clear` | `{ items }` |
| `generate` | `{ model }` |
| `generate-error` | `{ error, prompt }` |
| `camera` | `{ active }` |
| `xr` | `{ active }` |
| `room` | `{ status, code }` |
| `share` | `{ url }` |

---

## Web component

```html
<ar-studio
  assets="https://cdn.acme.com/models.json"
  title="Acme AR"
  accent="#00b894"
  generate="true"
  rooms="true"
></ar-studio>
```

`element.studio` is the live instance. Importing `3d-ar-studio/auto` (what the CDN bundle
does) registers the element for you.

---

## Keyboard and accessibility

Every control is a real button with an accessible name, the source tabs implement the full
ARIA tablist contract, and each dialog takes and returns focus.

| Key | Action |
| --- | --- |
| Arrows | Nudge the selected model, camera-relative. Hold Shift for fine steps. |
| `R` | Rotate 45°. |
| `D` | Duplicate. |
| Delete / Backspace | Remove, with an undo in the status line. |
| Escape | Close the open panel, or deselect. |

`prefers-reduced-motion` removes the spawn-in animation and every transition.

---

## MCP server

```bash
npx 3d-ar-studio-mcp
```

```json
{
  "mcpServers": {
    "3d-ar-studio": {
      "command": "npx",
      "args": ["-y", "3d-ar-studio-mcp"]
    }
  }
}
```

No API key. Every tool is free and keyless.

| Tool | What it does |
| --- | --- |
| `generate_3d_model` | Turn a text prompt into a textured GLB. Returns the model plus links that open it in AR. |
| `check_generation` | Collect a generation that was still rendering when the first call returned. |
| `search_models` | Search the free CC0 library (or any catalogue you configure) by name, category and tag. |
| `compose_ar_scene` | Arrange several models into one scene and return a single link that reopens it exactly. |
| `export_ar` | Turn any GLB URL into a device-aware "View in your space" link. |
| `create_ar_page` | Emit a complete, self-contained HTML page embedding the studio, ready to commit. |

| Environment variable | Default | What it changes |
| --- | --- | --- |
| `AR_STUDIO_PAGE_URL` | the hosted demo | The page `compose_ar_scene` links to. Set it to your own deployment. |
| `AR_STUDIO_ASSETS` | the free CC0 library | Catalogue `search_models` searches. |
| `AR_STUDIO_MCP_ENDPOINT` | three.ws 3D Studio | The MCP endpoint used for generation. |
| `AR_STUDIO_ORIGIN` | `https://three.ws` | Origin for hosted AR launch and viewer links. |

A session looks like this:

```
> Put a mid-century lamp and a potted fern in my living room.

  generate_3d_model  { prompt: "a brass mid-century desk lamp" }   → lamp.glb
  search_models      { query: "potted plant" }                     → fern.glb
  compose_ar_scene   { models: [{ src: lamp.glb, x: 0,   z: -1.4 },
                                { src: fern.glb, x: 0.9, z: -1.2 }] }

  → one link; open it on a phone and both objects stand in the room.
```

---

## Device support

| Device | Path | What you get |
| --- | --- | --- |
| Android Chrome | WebXR `immersive-ar` | Hit-test placement, per-model anchors, light estimation, depth occlusion. |
| iOS Safari | Camera passthrough | Live camera behind the scene, gyro world-lock, room-light matching, plus Quick Look for a single model. |
| Desktop | Preview | Grid floor, drag-look, QR hand-off to a phone. |
| Headsets | WebXR | Same as Android Chrome. |

Camera and WebXR both need a secure context: `https://` or `localhost`.

---

## Development

```bash
npm install
npm test                 # 55 unit tests, no browser needed
npm run build            # dist/ bundles
npm run build:site       # docs/ (the GitHub Pages site)
npm run test:browser     # end-to-end in a real browser (needs Playwright)
npm run inspect          # MCP Inspector against the local server
```

The published site is committed under `docs/` and served by GitHub Pages from the `main`
branch. There is no CI workflow: `npm run build && npm run build:site`, commit, push.

---

## Licence and credits

Apache-2.0.

The bundle includes [three.js](https://threejs.org) (MIT) and
[colyseus.js](https://colyseus.io) (MIT). The default model library is CC0 content from
[Poly Haven](https://polyhaven.com), and the default generation and animation lanes are hosted
by [three.ws](https://three.ws). None of them is required: every one is a URL you can change.
