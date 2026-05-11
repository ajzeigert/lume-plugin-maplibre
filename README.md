# lume-plugin-maplibre

A [Lume](https://lume.land) plugin that renders interactive [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) maps from post frontmatter.

## Features

- Render a map from a GeoJSON file or a coordinate pair
- Camera auto-fits to GeoJSON bounds, or use explicit center/zoom
- [Mapbox SimpleStyle](https://github.com/mapbox/simplestyle-spec) property support for per-feature styling
- Optional layer switcher for multiple named basemap styles
- Fallback image support for RSS feeds (see [cleanfeed](https://github.com/ajzeigert/zeigert.com/blob/main/src/utils/cleanfeed.js))
- MapLibre GL JS loaded dynamically — no build step required

## Installation

Add the plugin to your `_config.ts`:

```ts
import maplibrePlugin from "https://cdn.jsdelivr.net/gh/ajzeigert/lume-plugin-maplibre@main/mod.ts";

site.use(maplibrePlugin());
```

## Usage

Add a `map` key to your post frontmatter.

### From coordinates

```yaml
---
title: My post
map:
  coordinates: [-85.854, 42.006]
  zoom: 13
---
```

### From a GeoJSON file

```yaml
---
title: My post
map:
  geojson: ./route.geojson
---
```

The map will auto-fit to the bounding box of the GeoJSON. You can set a max zoom:

```yaml
map:
  geojson: ./route.geojson
  zoom: 14
```

### With a fallback image

Provide a pre-rendered image for RSS readers and other contexts where JavaScript is unavailable:

```yaml
map:
  coordinates: [-85.854, 42.006]
  zoom: 13
  fallback: /img/my-map.png
```

## Options

```ts
site.use(maplibrePlugin({
  // Default basemap style key (must be a key in `styles`, or a full URL)
  defaultStyle: "positron",

  // Named basemap styles. A layer switcher appears automatically when more than one is defined.
  styles: {
    positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  },

  // Set to false to disable the layer switcher globally
  layerSwitcher: true,

  // CSS class added to the map container div
  mapClass: "nofeed",

  // CSS class added to the fallback img element
  fallbackClass: "feedonly",
}));
```

### RSS feed compatibility

The `mapClass` and `fallbackClass` options are designed to work with feed-stripping utilities. For example, with [cleanfeed](https://github.com/ajzeigert/zeigert.com/blob/main/src/utils/cleanfeed.js), elements with `class="nofeed"` are removed from feed content and elements with `class="feedonly"` are kept. Configure the classes to match whatever convention your setup uses.

## Frontmatter reference

| Key | Type | Description |
|-----|------|-------------|
| `coordinates` | `[lng, lat]` | Center point. Generates a point marker. |
| `geojson` | `string` | Path to a GeoJSON file, relative to the post. |
| `center` | `[lng, lat]` | Override the camera center (used with `geojson`). |
| `zoom` | `number` | Explicit zoom, or max zoom when fitting to bounds. |
| `style` | `string` | Style key or full URL, overrides `defaultStyle`. |
| `layerSwitcher` | `boolean` | Override layer switcher visibility for this post. |
| `fallback` | `string` | Path to a fallback image for RSS/no-JS contexts. |

## GeoJSON styling

Features are styled using [Mapbox SimpleStyle](https://github.com/mapbox/simplestyle-spec) properties:

| Property | Applies to | Description |
|----------|-----------|-------------|
| `fill` | Polygons | Fill color |
| `fill-opacity` | Polygons | Fill opacity |
| `stroke` | Lines, Polygon borders | Stroke color |
| `stroke-width` | Lines, Polygon borders | Stroke width |
| `stroke-opacity` | Lines, Polygon borders | Stroke opacity |
| `marker-color` | Points | Circle color |
| `marker-size` | Points | `small`, `medium` (default), or `large` |
| `title` | All | Popup title on click |
| `description` | All | Popup body text on click |
