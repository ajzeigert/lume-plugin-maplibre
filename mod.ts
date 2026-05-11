import { dirname, join } from "jsr:@std/path";
import type Site from "lume/core/site.ts";

const POSITRON_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const MAPLIBRE_VERSION = "4.7.1";
const MAPLIBRE_CSS =
  `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
const MAPLIBRE_JS =
  `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;

export interface Options {
  defaultStyle?: string;
  styles?: Record<string, string>;
  layerSwitcher?: boolean;
  mapClass?: string;
  fallbackClass?: string;
}

interface MapFrontmatter {
  geojson?: string;
  coordinates?: [number, number];
  center?: [number, number];
  zoom?: number;
  style?: string;
  layerSwitcher?: boolean;
  fallback?: string;
}

interface GeoJsonFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

type CameraConfig =
  | { type: "explicit"; center: [number, number]; zoom: number }
  | { type: "fitBounds"; center?: [number, number]; zoom?: number };

interface InitScriptParams {
  containerId: string;
  geojson: GeoJsonFeatureCollection;
  styleUrl: string;
  camera: CameraConfig;
  showSwitcher: boolean;
  styles: Record<string, string>;
}

interface MapHtmlParams {
  slug: string;
  geojson: GeoJsonFeatureCollection;
  styleUrl: string;
  camera: CameraConfig;
  showSwitcher: boolean;
  styles: Record<string, string>;
  fallback: string | null;
  mapClass?: string;
  fallbackClass?: string;
}

export function resolveStyleUrl(
  style: string | undefined,
  styles: Record<string, string> = {},
  defaultStyle = "positron",
): string {
  const candidate = style ?? defaultStyle;
  if (candidate && candidate.startsWith("http")) return candidate;
  if (candidate && styles[candidate]) return styles[candidate];
  return styles[defaultStyle] ?? POSITRON_URL;
}

export function showLayerSwitcher(
  pluginFlag: boolean | undefined,
  frontmatterFlag: boolean | undefined,
  styleCount: number,
): boolean {
  if (styleCount <= 1) return false;
  if (pluginFlag === false) return false;
  if (frontmatterFlag === false) return false;
  return true;
}

export function coordinatesToGeoJson(
  [lng, lat]: [number, number],
): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: {},
    }],
  };
}

export function normalizeToFeatureCollection(
  geojson: Record<string, unknown>,
): GeoJsonFeatureCollection {
  if (geojson.type === "FeatureCollection") {
    return geojson as unknown as GeoJsonFeatureCollection;
  }
  if (geojson.type === "Feature") {
    return {
      type: "FeatureCollection",
      features: [geojson as unknown as GeoJsonFeature],
    };
  }
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: geojson as unknown as GeoJsonFeature["geometry"],
      properties: {},
    }],
  };
}

export function resolveCameraConfig(mapData: MapFrontmatter): CameraConfig {
  if (mapData.coordinates) {
    return {
      type: "explicit",
      center: mapData.center ?? mapData.coordinates,
      zoom: mapData.zoom ?? 13,
    };
  }
  if (mapData.zoom !== undefined && mapData.center !== undefined) {
    return { type: "explicit", center: mapData.center, zoom: mapData.zoom };
  }
  return {
    type: "fitBounds",
    center: mapData.center,
    zoom: mapData.zoom,
  };
}

export async function resolveGeoJson(
  mapData: MapFrontmatter,
  pageDir: string,
): Promise<GeoJsonFeatureCollection> {
  if (mapData.geojson) {
    const path = join(pageDir, mapData.geojson);
    const text = await Deno.readTextFile(path);
    return normalizeToFeatureCollection(JSON.parse(text));
  }
  if (mapData.coordinates) {
    return coordinatesToGeoJson(mapData.coordinates);
  }
  throw new Error(
    "map frontmatter requires either 'geojson' or 'coordinates'",
  );
}

export function generateInitScript(
  { containerId, geojson, styleUrl, camera, showSwitcher, styles }:
    InitScriptParams,
): string {
  const config = JSON.stringify({
    containerId,
    geojson,
    styleUrl,
    camera,
    showSwitcher,
    styles,
  });

  return `
<script>
(function() {
  var CONFIG = ${config};

  function ensureMapLibre(callback) {
    if (typeof maplibregl !== 'undefined') { callback(); return; }
    if (window._maplibreLoading) {
      var t = setInterval(function() {
        if (typeof maplibregl !== 'undefined') { clearInterval(t); callback(); }
      }, 50);
      return;
    }
    window._maplibreLoading = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = '${MAPLIBRE_CSS}';
    document.head.appendChild(link);
    var script = document.createElement('script');
    script.src = '${MAPLIBRE_JS}';
    script.onload = function() { window._maplibreLoading = false; callback(); };
    document.head.appendChild(script);
  }

  function getBbox(geojson) {
    var minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    function walk(c) {
      if (typeof c[0] === 'number') {
        if (c[0] < minLng) minLng = c[0];
        if (c[1] < minLat) minLat = c[1];
        if (c[0] > maxLng) maxLng = c[0];
        if (c[1] > maxLat) maxLat = c[1];
      } else { c.forEach(walk); }
    }
    geojson.features.forEach(function(f) { walk(f.geometry.coordinates); });
    return [[minLng, minLat], [maxLng, maxLat]];
  }

  function addLayers(map) {
    map.addSource('data', { type: 'geojson', data: CONFIG.geojson });

    var types = CONFIG.geojson.features.map(function(f) { return f.geometry.type; });

    if (types.some(function(t) { return t === 'Polygon' || t === 'MultiPolygon'; })) {
      map.addLayer({
        id: 'map-fill', type: 'fill', source: 'data',
        filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
        paint: {
          'fill-color': ['coalesce', ['get', 'fill'], '#555555'],
          'fill-opacity': ['coalesce', ['get', 'fill-opacity'], 0.5]
        }
      });
      map.addLayer({
        id: 'map-line-border', type: 'line', source: 'data',
        filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
        paint: {
          'line-color': ['coalesce', ['get', 'stroke'], '#555555'],
          'line-width': ['coalesce', ['get', 'stroke-width'], 2],
          'line-opacity': ['coalesce', ['get', 'stroke-opacity'], 1]
        }
      });
    }

    if (types.some(function(t) { return t === 'LineString' || t === 'MultiLineString'; })) {
      map.addLayer({
        id: 'map-line', type: 'line', source: 'data',
        filter: ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false],
        paint: {
          'line-color': ['coalesce', ['get', 'stroke'], '#555555'],
          'line-width': ['coalesce', ['get', 'stroke-width'], 2],
          'line-opacity': ['coalesce', ['get', 'stroke-opacity'], 1]
        }
      });
    }

    if (types.some(function(t) { return t === 'Point' || t === 'MultiPoint'; })) {
      map.addLayer({
        id: 'map-circle', type: 'circle', source: 'data',
        filter: ['match', ['geometry-type'], ['Point', 'MultiPoint'], true, false],
        paint: {
          'circle-color': ['coalesce', ['get', 'marker-color'], '#555555'],
          'circle-radius': ['case',
            ['==', ['get', 'marker-size'], 'small'], 4,
            ['==', ['get', 'marker-size'], 'large'], 9,
            6
          ],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    ['map-fill', 'map-line', 'map-line-border', 'map-circle'].forEach(function(layerId) {
      if (!map.getLayer(layerId)) return;
      map.on('click', layerId, function(e) {
        var props = e.features[0].properties;
        if (!props.title && !props.description) return;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML('<strong>' + (props.title || '') + '</strong>' +
            (props.description ? '<p>' + props.description + '</p>' : ''))
          .addTo(map);
      });
    });
  }

  function LayerSwitcher(styles, currentUrl) {
    this._styles = styles;
    this._current = currentUrl;
  }
  LayerSwitcher.prototype.onAdd = function(map) {
    this._map = map;
    var self = this;
    var el = document.createElement('div');
    el.className = 'maplibregl-ctrl maplibregl-ctrl-group';
    Object.keys(this._styles).forEach(function(name) {
      var url = self._styles[name];
      var btn = document.createElement('button');
      btn.textContent = name;
      btn.style.padding = '4px 8px';
      btn.style.fontWeight = url === self._current ? 'bold' : 'normal';
      btn.onclick = function() {
        self._current = url;
        map.setStyle(url);
        el.querySelectorAll('button').forEach(function(b) {
          b.style.fontWeight = b.textContent === name ? 'bold' : 'normal';
        });
      };
      el.appendChild(btn);
    });
    this._container = el;
    return el;
  };
  LayerSwitcher.prototype.onRemove = function() {
    this._container.parentNode.removeChild(this._container);
    this._map = undefined;
  };

  function initMap() {
    ensureMapLibre(function() {
    var mapOptions = { container: CONFIG.containerId, style: CONFIG.styleUrl };

    if (CONFIG.camera.type === 'explicit') {
      mapOptions.center = CONFIG.camera.center;
      mapOptions.zoom = CONFIG.camera.zoom;
    }

    var map = new maplibregl.Map(mapOptions);

    function onStyleLoad() {
      if (map.getSource('data')) return;
      addLayers(map);
      if (CONFIG.camera.type === 'fitBounds') {
        var bbox = getBbox(CONFIG.geojson);
        var opts = { padding: 40 };
        if (CONFIG.camera.zoom !== undefined) opts.maxZoom = CONFIG.camera.zoom;
        if (CONFIG.camera.center !== undefined) opts.center = CONFIG.camera.center;
        map.fitBounds(bbox, opts);
      }
    }

    map.on('load', onStyleLoad);
    map.on('style.load', onStyleLoad);

    if (CONFIG.showSwitcher) {
      map.addControl(new LayerSwitcher(CONFIG.styles, CONFIG.styleUrl), 'top-right');
    }
    }); // ensureMapLibre
  }

  initMap();
})();
</script>`;
}

export function generateMapHtml(
  { slug, geojson, styleUrl, camera, showSwitcher, styles, fallback, mapClass, fallbackClass }:
    MapHtmlParams,
): string {
  const containerId = `map-${slug}`;
  const parts: string[] = [];

  if (fallback) {
    const classAttr = fallbackClass ? ` class="${fallbackClass}"` : "";
    parts.push(
      `<img${classAttr} loading="lazy" src="${fallback}" alt="Map">`,
    );
  }

  const divClass = ["map-container", mapClass].filter(Boolean).join(" ");
  parts.push(
    `<div class="${divClass}" id="${containerId}" style="height:400px;"></div>`,
  );
  parts.push(
    generateInitScript({ containerId, geojson, styleUrl, camera, showSwitcher, styles }),
  );

  return parts.join("\n") + "\n";
}

export default function maplibrePlugin(userOptions: Options = {}): (site: Site) => void {
  const {
    defaultStyle = "positron",
    styles: userStyles = {},
    layerSwitcher: globalLayerSwitcher,
    mapClass,
    fallbackClass,
  } = userOptions;

  const allStyles: Record<string, string> = { positron: POSITRON_URL, ...userStyles };
  const styleCount = Object.keys(allStyles).length;

  return (site: Site) => {
    site.preprocess([".md", ".html"], async (pages) => {
      for (const page of pages) {
        if (!page.data.map) continue;

        const mapData = page.data.map as MapFrontmatter;
        const pagePath = site.src(page.src.path).toString().replace(
          /^file:\/\//,
          "",
        );
        const pageDir = dirname(pagePath);

        const geojson = await resolveGeoJson(mapData, pageDir);
        const styleUrl = resolveStyleUrl(mapData.style, allStyles, defaultStyle);
        const camera = resolveCameraConfig(mapData);
        const switcher = showLayerSwitcher(
          globalLayerSwitcher,
          mapData.layerSwitcher,
          styleCount,
        );

        const html = generateMapHtml({
          slug: (page.data.url || page.src.path)
            .replace(/\//g, "-")
            .replace(/[^a-z0-9-]/gi, "")
            .replace(/^-+|-+$/g, ""),
          geojson,
          styleUrl,
          camera,
          showSwitcher: switcher,
          styles: switcher ? allStyles : {},
          fallback: mapData.fallback ?? null,
          mapClass,
          fallbackClass,
        });

        page.data.content = html + (page.data.content ?? "");
      }
    });
  };
}
