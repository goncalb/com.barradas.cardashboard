# Changelog

Companion app for Car Dashboard on Android Automotive OS. The car app has
its own [CHANGELOG](https://github.com/goncalb/car-dashboard-aaos/blob/main/CHANGELOG.md);
versions are numbered in step where they ship together.

## 1.4.17 (2026-09-02) — Settings, reorganised

- Settings redesigned as four tabs: Tiles, Scenes, Rooms, Cars. Tile
  cards collapse to a summary line and expand one at a time; new tiles
  open expanded and scroll into view.
- The unsaved-changes indicator now says where the changes are
  ("here and in Scenes"); the save bar appears only where saving applies.
- New users land on the Cars tab with a getting-started guide whose
  step links switch tabs.
- Scenes sort alphabetically — in settings and, served sorted, on every
  car immediately.
- Groundwork for the next car release, shipped dark: Homey name and
  owner in metadata, and a /timeline endpoint (newest 30 entries,
  flattened to single lines).
- Webview lesson of the release: short tab pages surrendered drag
  gestures to the native sheet; every tab is now minimally scrollable.

## 1.4.16 (2026-09-01) — Live, and pointing home

- Published to the Homey App Store after certification. The store page
  now links the community topic, the source repository and the issue
  tracker — the one thing the reviewers asked for that the first
  submission had left as placeholders.

## 1.4.15 (2026-08-31) — Tiles that know their own name

- New Garage and Gate tiles take the name of the device you pick
  ("Cancello Auto", not "Gate"), trimmed to the 20-character car limit.
  Re-picking updates the name as long as you never typed your own; a
  typed name is yours and stays. Reported by Simone Di Maio after
  finding three tiles all called "Gate" on his car.

## 1.4.14 (2026-08-30) — A save button you can always reach

- The Save button lives in a bar pinned to the bottom of the settings
  page. An amber "Unsaved changes" dot appears on the first keystroke or
  tick — names, scenes, energy roles, devices, geofence choices all
  count — and clears on save. Auto-save was considered and rejected: the
  dashboard save prunes device-less tiles, so saving mid-configuration
  would delete a tile the moment it was added.
- Room re-ordering saves the instant you drop, says so in the save bar,
  and offers one-step Undo. Two drops, one undo — it's for the mis-drop,
  not an editing history.
- Disconnecting a car is a two-tap action: the button turns red with
  "Tap again to disconnect" and reverts after ten seconds. The armed
  state survives the fleet's five-second refresh because it lives in a
  variable, not the DOM.
- Renaming a car: full-width pencil field; "Save name" appears only when
  the name differs; receipt in the save bar.
- Garage tiles pick a single door — like Gate tiles — with a description
  of the contract. The state had always used the first device; the
  picker now says so instead of letting you tick five.
- Removed: an orphaned auto-close text on the garage card that never had
  a control behind it, the fixed-position toast (this webview breaks
  scrolling around `position: fixed`; all feedback now goes through the
  save bar), and a dead `instant` field.

## 1.4.13 (2026-08-29) — One gate, one tile

- Gate tiles select exactly one device, with radio buttons and a hint to
  add another tile for another gate. Tiles created with several gates on
  1.4.10–1.4.12 keep working on the first device and show a note until
  re-picked.
- Tile names are visibly editable — pencil icon, hint, 20-character
  cap — after a user reported never having noticed the field.
- A short description on the Gate card explains the one-gate-one-tap
  design and why a gate that should ask for confirmation belongs on a
  Locks tile instead.

## 1.4.12 (2026-08-29) — Lights that are lights, whatever their class

- Devices reassigned in Homey via *virtual class* are honoured
  everywhere: a socket or wall switch marked as a light appears in the
  Lights picker. Implemented at the source — both device serializers now
  report `virtualClass || class` — so every class-based filter (lights,
  EV charger, solar, gate) benefits without changes. Reported by Simone
  Di Maio, whose lights are relays behind switches.

## 1.4.11 (2026-08-28) — Buttons that don't wrap

- Layout fix for the new geofence controls on Garage and Gate tiles: the
  Notify / Close-automatically choice reused a 32-pixel icon-button class
  and collapsed into slivers. Now proper pills, in their own block.

## 1.4.10 (2026-08-28) — The Gate tile

- New tile type **Gate**: a sibling of Garage, not a kind of Lock.
  Accepts garage-door-class or lock-class devices, one tap from the car
  by contract, its own icon.
- Per-tile geofence controls for Garage and Gate: include in arrival and
  departure notifications; on departure, notify with a button or close
  automatically (always with a receipt in the car). Defaults: notify.
- State carries per-tile `geofence`, `auto`, `openLabel` and
  `closeLabel`, so the car builds one state-aware notification for all
  barriers together.

## 1.4.8 (2026-08-26) — The charger, counted apart

- Energy: an EV charger role. Its power is subtracted from the home
  meter so consumption is house-only, and it gets its own line in the
  live and daily views. Loads are listed before sources.
- Settings: device switches reflect their state visually (a CSS
  omission left them all grey).

## Earlier

- 1.4.0–1.4.7: Energy tile with Homey Energy daily totals; fleet view
  with per-car tokens, rename and revoke; room ordering by drag; scenes;
  whitelists per category; blind state from position. See the git
  history for details.
