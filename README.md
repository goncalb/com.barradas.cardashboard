# Car Dashboard — Homey Pro companion

![Car Dashboard](assets/images/xlarge.png)

🇬🇧 English *(more languages on the roadmap — see below)*

The Homey Pro half of **Car Dashboard**, a native Android Automotive OS
app that puts your Homey smart home on the car's own screen and lets the
car take part in it. This app decides what the car may see and do, and
answers its questions: whitelists per category, per-car tokens, live
state, actions, Homey Energy totals, and the per-tile behaviour of the
geofence features.

The car side lives in its own repository:
[car-dashboard-aaos](https://github.com/goncalb/car-dashboard-aaos)
(Google Play, internal testing). Nothing works without it — install this
app, then pair your car once with a code.

**Least privilege by design.** The car never holds your Homey account.
Pairing issues a per-car token that can only read and act on the devices
you ticked; revoke it here and the car is out. Traffic goes through
Athom's cloud API to your own Homey; there is no third-party server.

Live on the [Homey App Store](https://homey.app/a/com.barradas.cardashboard) ·
[Community topic](https://community.homey.app/t/app-pro-car-dashboard-for-android-automotive-volvo-polestar-renault/158804) ·
[Report an issue](https://github.com/goncalb/com.barradas.cardashboard/issues)

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

## What it does

- Serves the car a curated **state**: tiles, lights by room, scenes,
  energy — only what you whitelisted, with your labels
- Executes **actions** the car sends (toggle, open/close, lock/unlock,
  level, run Flow) against the whitelisted devices only
- Issues and manages **per-car tokens** (pairing codes die on use;
  fleet view with last-seen; rename; two-step revoke)
- Computes the **energy** picture from your meter, inverter, battery and
  EV charger roles, plus Homey Energy's daily totals
- Carries each barrier tile's **geofence preferences** (notify, or close
  automatically on departure) so the car can act without asking twice
- Stores room order, honours Homey virtual classes, keeps blind state
  honest (position beats the last motor command)

## Tile types

![Settings](docs/settings.png)

| Tile | Device picker | On the car | Geofence |
|---|---|---|---|
| Garage door | one garage-door device | one tap, CLOSED / OPEN, amber when open | notifications · Notify or Close automatically |
| **Gate** | one garage-door *or* lock device | one tap by contract, CLOSED/OPEN or LOCKED/UNLOCKED | same controls as Garage; several gates = several tiles |
| Locks | any number of locks | summary tile; tap asks for confirmation | — |
| Blinds | any number of covers | position-aware summary; level screen with presets | — |
| Window / contact sensors | any number | ALL CLOSED / n OPEN | — |
| Temperature | one sensor | current value | — |
| Energy | roles: meter, inverter, battery, EV charger | live kW hero; detail screen with NOW and TODAY | — |

Every tile has a **name field** (pencil, max 20 characters) — the car
shows your words, not device names. New Garage and Gate tiles take the
picked device's name until you type your own.

## Settings page

| Area | In one line |
|---|---|
| Tiles | Add, order, name, pick devices; single-select pickers for Garage and Gate with a short description of the one-door-one-tap contract |
| Lights | Tick lights (virtual-class aware); drag rooms into the order the car shows — saves instantly with Undo |
| Scenes | Tick Flows; they become buttons in the car |
| Energy | One dropdown per role; consumption is house-only when a charger role is set |
| Cars | Pairing code (5-minute TTL, single use), fleet cards with last seen, rename, two-step revoke |
| Save | Sticky save bar with an "unsaved changes" indicator; explicit save for the dashboard, instant save with a receipt for room order and fleet actions |

The settings page runs in Homey's webview, which has rules of its own
(no `confirm()`, no `position: fixed`, DOM is rebuilt by the fleet poll);
the page is built around them — see the engineering notes in the repo
history if you touch it.

## API surface (consumed by the car app)

| Endpoint | Purpose |
|---|---|
| `POST /pair` | `{code, name}` → issues a car token |
| `GET /state?carToken=` | Whitelisted tiles, lights, scenes, energy, per-tile geofence flags — everything the car renders |
| `POST /action` | `{tileId, action, carToken}` — token in the **body** |
| `GET /devices` | Settings UI only; effective class is `virtualClass || class` |
| `GET /zones` · `POST /zone-order` | Room order |
| `GET/POST /pairing` | Codes, fleet, rename, revoke |

The app requests `homey:manager:api` to read device state and energy
reports. Nothing leaves your Homey except to your own paired cars.

## Building from source

```
git clone https://github.com/goncalb/com.barradas.cardashboard
cd com.barradas.cardashboard
npm i -g homey && homey login
homey app install
```

No build step, no `node_modules` needed at runtime. `app.json` is the
single manifest (no compose).

## Branding & assets

- Brand colour `#16222C` per Homey guidelines; app icon `assets/icon.svg`
- Store artwork (text-free per store rules): `assets/images/{small,large,xlarge}.png`
- README images: `docs/`

## Project structure

```text
app.js              App class: device map, energy report cache, zone names
api.js              All endpoints: pair, state, action, devices, zones, pairing
settings/
  index.html        The settings page — tiles, lights, scenes, energy, cars, save bar
assets/             Icon and store images
docs/               README images
CHANGELOG.md        Version history
```

## Roadmap

- **Translations** — settings strings and `app.json` texts move to Homey
  `locales/` (English base, then nl/de/it/pt), in step with the car app's
  string resources so labels match across both halves.
- Arrival/departure action as a chosen Flow.

## Related projects

[Android Automotive by Simone Di Maio](https://homey.app/a/com.dimapp.aaos)
([car](https://github.com/s-dimaio/HomeyAutomotive) ·
[Homey](https://github.com/s-dimaio/com.dimapp.aaos)) — the other
Homey ↔ AAOS bridge, with an OAuth relay and generic rendering. Both
projects are GPL-3.0 and ideas flow both ways; the Gate tile, the
virtual-class handling and device-named tiles came out of that exchange.

## License

[GNU GPL v3.0](LICENSE) — free to use, study, modify and share;
derivatives stay open under the same license.
