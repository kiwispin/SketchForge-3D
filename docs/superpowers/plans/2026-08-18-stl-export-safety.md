# STL export safety — implementation status

## Decision

The print-oriented STL action exports the complete visible design by default. A current selection no longer narrows the normal STL action, so selecting one part cannot accidentally produce a one-part STL from a larger project.

Selection-only STL export remains available as an explicit `Export selection as STL` action when a solid is selected.

## Export preparation

- The editor design is not mutated and no undo entry is created.
- Hidden top-level shapes are excluded from STL input.
- The existing group/boolean preparation pipeline is run temporarily before STL generation.
- Solid and hole operands are kept together for preparation so existing boolean cut support can apply hole shapes.
- The generated mesh is checked for finite vertices, valid face indices, and non-empty geometry before a download is started.
- If a hole preparation fails or the result is not valid, the download is refused with a clear notice.

## UI language

The Export panel keeps its existing three-format layout and blue primary action styling. The STL button is the normal full-design action; the selection-only action is secondary and explicitly labelled. The panel explains that STL applies hole cuts and that selection export is intentional/partial.

## Verification

- `npm run ci` — passed (18 files, 149 tests)
- `npm run test:e2e` — passed (8 tests)
- `npm run build` — passed
- Local browser smoke test — passed for opening the Export panel, whole-design STL export, explicit selection STL export, and clean empty-design state; no browser errors or warnings.

## Upstream-sync port note

On the `upstream-sync` branch (fork rebased onto upstream v0.9.0), upstream's export dialog (file name, format slider, STL/OBJ/STEP/SVG/SKF) replaces the fork's three-button panel. The same rules apply there: with STL selected, the primary **Export STL** button exports the full visible design with hole cuts, the scope badge reads "N full design", and **Export selection as STL (N)** appears in the dialog footer when a solid is selected.
