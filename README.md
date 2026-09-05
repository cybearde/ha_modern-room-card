# Modern Room Card

A maintained, modernized successor to the deprecated
[room-card](https://github.com/marcokreeft87/room-card) for Home Assistant dashboards. It displays a room title,
main entity, compact status entities, multiple icon rows, and nested cards in one card.

![Room Card layout](https://raw.githubusercontent.com/marcokreeft87/room-card/master/example.png)

> The screenshot shows the original card's layout. Modern Room Card preserves that configuration model while updating
> its dependencies, editor, and runtime behavior.

## Installation

### HACS

1. Open HACS, select **Dashboard**, then open the three-dot menu and choose **Custom repositories**.
2. Add this GitHub repository as category **Dashboard**.
3. Install **Modern Room Card** and reload Home Assistant.

HACS installs `dist/modern-room-card.js`. If Home Assistant does not add the resource automatically, add
`/hacsfiles/ha_modern-room-card/modern-room-card.js` as a JavaScript module. The URL uses the GitHub repository name;
adjust `ha_modern-room-card` if you publish the repository under a different name.

### Manual

Run `npm ci && npm run build`, copy `dist/modern-room-card.js` into Home Assistant's `config/www` directory, and add
`/local/modern-room-card.js` as a JavaScript module dashboard resource.

## Basic configuration

```yaml
type: custom:modern-room-card
title: Living room
entity: light.living_room
icon: mdi:sofa
show_icon: true
tap_action:
  action: toggle
info_entities:
  - entity: sensor.living_room_temperature
    format: precision1
  - entity: sensor.living_room_humidity
    format: precision0
entities:
  - entity: light.ceiling
    name: Ceiling
    tap_action:
      action: toggle
  - entity: media_player.living_room
    name: Media
```

The visual editor covers the common fields. Advanced configuration remains available as YAML.

## Rows and empty slots

Use `rows` to control wrapping and alignment. An empty object reserves an invisible slot, which is useful for keeping
icons aligned between cards. Its width can be changed with the CSS variable `--modern-room-card-empty-slot-width`.

```yaml
type: custom:modern-room-card
title: Office
rows:
  - content_alignment: center
    entities:
      - entity: light.office
        name: Light
      - {} # keep this position empty
      - entity: climate.office
        name: Heating
```

`content_alignment` accepts `left`, `center`, or `right` on the card and on individual rows.

## Entity options

Entries in `entities`, `info_entities`, and row `entities` accept either an entity ID or an object. Common object keys
are `entity`, `name`, `attribute`, `unit`, `icon`, `show_icon`, `show_name`, `show_state`, `state_color`, `toggle`,
`format`, `hide_unavailable`, `hide_if`, `styles`, `template`, and the standard Home Assistant action keys.

Supported formats are `relative`, `total`, `date`, `time`, `datetime`, `brightness`, `duration`, `duration-m`, `kilo`,
`invert`, `position`, and `precision0` through `precision9`.

Conditions in `hide_if.conditions` and `icon.conditions` support `equals`, `not_equals`, `above`, and `below`. A
condition can inspect the current value or specify another `entity` and optional `attribute`.

JavaScript templates from the original card remain supported for compatibility. They execute in the browser with
access to `states`, `entity`, `user`, `hass`, and Lit's `html` helper. Only use configuration you trust.

## Nested cards

Standard and custom cards can be placed under `cards`. Add `show_states` or `hide_if` to show them conditionally.
Modern Room Card waits for nested custom elements before creating them.

## Development

```bash
npm ci
npm run check
```

Pull requests must keep `dist/modern-room-card.js` synchronized with the TypeScript source. The CI workflow verifies
the typecheck and production build; the HACS workflow validates the repository as a Dashboard plugin.

## Credits and license

This project is based on Marco Kreeft's room-card and retains the original MIT notice. See [LICENSE](LICENSE).
