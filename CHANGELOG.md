# Changelog

## 0.1.0

First release.

- **The studio.** A live multi-model AR scene for any web page: place, drag, pinch-resize,
  twist-rotate and duplicate any number of models through the device camera, with a designed
  path on every device (WebXR on Android and headsets, camera passthrough with gyro world-lock
  on iOS, grid preview with a QR hand-off on desktop).
- **Text to 3D, in the camera.** A prompt box in the dock generates a model on a free, keyless
  lane and drops the result into the room. Progress narration reports only what the pipeline
  actually reported.
- **Pluggable model sources.** Ships wired to a few hundred CC0 props. `assets` takes a
  manifest URL, an inline list, a custom source object, or an ordered array of them; five
  common catalogue shapes are read without reshaping.
- **Scenes are links.** Models and transforms round-trip through the URL and a QR code, and
  persist to localStorage between visits.
- **Shared rooms.** A six-character code puts two or more people in one arrangement, with live
  presence and per-owner edit gating.
- **Universal idle animation.** Humanoid models with no baked clip get one retargeted onto
  their own skeleton, with no rig allow-list.
- **MCP server.** Six tools so an agent can generate, search, arrange, export and scaffold AR
  experiences: `generate_3d_model`, `check_generation`, `search_models`, `compose_ar_scene`,
  `export_ar`, `create_ar_page`.
- **CLI.** `create`, `dev`, `deploy` and `page`, so adding AR to a project is two commands.
