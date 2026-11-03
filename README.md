# OTCI Studio (CMS)

React port of the OTCI Studio artifact: the website CMS for otci.lagosstate.gov.ng.
Same screens, styles and behaviour as the original, in light and dark mode.

```bash
cd cms
npm install
npm run dev      # http://localhost:5174
npm run build
```

## Screens

Login (email + 6-digit code), Overview, Pages (section editor with live preview,
drag to reorder, show/hide, send for review, publish), Service charters (list,
5-tab editor, checks, website preview, spreadsheet import, JSON import/export),
Media library (folders, uploads, cover image), Activity, Department admins,
How it's built, and the ⌘K search palette.

## Layout

```
src/
  App.jsx              shell: sidebar, top bar, breadcrumbs, routing, shortcuts
  store.js             state, persistence, routing, toasts, modals, metrics
  components/          icons, pills, meters, stepper, timeline, palette
  views/               one file per screen
  data/                content, section schemas, charter seed and icons (verbatim from the artifact)
  lib/charterLogic.js  charter labels, checks and spreadsheet parsing (verbatim)
  styles.css           the original stylesheet, unchanged
public/media/          the photos, extracted from the artifact's inline base64
```

## Data

Like the original, everything is stored in the browser (`localStorage`) and
starts from sample content. No backend is connected. Places that need an API
are marked `TODO(api)`. The list of endpoints the CMS still needs is in the
main OTCI repo, under `docs/cms-api-check.md`.
