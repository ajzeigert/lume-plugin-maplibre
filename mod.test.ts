import { assertEquals, assertStringIncludes } from "jsr:@std/assert";
import {
  resolveStyleUrl,
  showLayerSwitcher,
  coordinatesToGeoJson,
  normalizeToFeatureCollection,
  resolveCameraConfig,
  generateInitScript,
  generateMapHtml,
} from "./mod.ts";

const POSITRON = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const styles = { positron: POSITRON, dark: DARK };

// resolveStyleUrl
Deno.test("resolveStyleUrl: named key resolves to URL", () => {
  assertEquals(resolveStyleUrl("dark", styles, "positron"), DARK);
});

Deno.test("resolveStyleUrl: full URL passes through", () => {
  const url = "https://example.com/style.json";
  assertEquals(resolveStyleUrl(url, styles, "positron"), url);
});

Deno.test("resolveStyleUrl: undefined falls back to defaultStyle", () => {
  assertEquals(resolveStyleUrl(undefined, styles, "dark"), DARK);
});

Deno.test("resolveStyleUrl: unknown key falls back to defaultStyle", () => {
  assertEquals(resolveStyleUrl("satellite", styles, "positron"), POSITRON);
});

Deno.test("resolveStyleUrl: no styles at all falls back to hardcoded Positron", () => {
  assertEquals(resolveStyleUrl(undefined, {}, "positron"), POSITRON);
});

// showLayerSwitcher
Deno.test("showLayerSwitcher: single style always hidden", () => {
  assertEquals(showLayerSwitcher(undefined, undefined, 1), false);
});

Deno.test("showLayerSwitcher: multiple styles, no override → shown", () => {
  assertEquals(showLayerSwitcher(undefined, undefined, 2), true);
});

Deno.test("showLayerSwitcher: plugin-level false hides globally", () => {
  assertEquals(showLayerSwitcher(false, undefined, 2), false);
});

Deno.test("showLayerSwitcher: frontmatter false hides for post", () => {
  assertEquals(showLayerSwitcher(undefined, false, 2), false);
});

Deno.test("showLayerSwitcher: frontmatter false overrides even when plugin allows", () => {
  assertEquals(showLayerSwitcher(undefined, false, 3), false);
});

// coordinatesToGeoJson
Deno.test("coordinatesToGeoJson: returns FeatureCollection with Point", () => {
  const result = coordinatesToGeoJson([-85.854, 42.006]);
  assertEquals(result.type, "FeatureCollection");
  assertEquals(result.features.length, 1);
  assertEquals(result.features[0].geometry.type, "Point");
  assertEquals(result.features[0].geometry.coordinates, [-85.854, 42.006]);
  assertEquals(result.features[0].properties, {});
});

// normalizeToFeatureCollection
Deno.test("normalizeToFeatureCollection: passes through FeatureCollection", () => {
  const fc = { type: "FeatureCollection", features: [] };
  assertEquals(normalizeToFeatureCollection(fc).type, "FeatureCollection");
});

Deno.test("normalizeToFeatureCollection: wraps bare Feature", () => {
  const feature = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [0, 0] },
    properties: { name: "test" },
  };
  const result = normalizeToFeatureCollection(feature);
  assertEquals(result.type, "FeatureCollection");
  assertEquals(result.features.length, 1);
});

Deno.test("normalizeToFeatureCollection: wraps bare Geometry", () => {
  const geometry = { type: "Point", coordinates: [0, 0] };
  const result = normalizeToFeatureCollection(geometry);
  assertEquals(result.type, "FeatureCollection");
  assertEquals(result.features[0].type, "Feature");
  assertEquals(result.features[0].geometry, geometry);
  assertEquals(result.features[0].properties, {});
});

// resolveCameraConfig
Deno.test("resolveCameraConfig: coordinates → explicit camera at zoom 13", () => {
  const result = resolveCameraConfig({ coordinates: [-85.854, 42.006] });
  assertEquals(result, { type: "explicit", center: [-85.854, 42.006], zoom: 13 });
});

Deno.test("resolveCameraConfig: coordinates + zoom → explicit camera", () => {
  const result = resolveCameraConfig({ coordinates: [-85.854, 42.006], zoom: 10 });
  assertEquals(result, { type: "explicit", center: [-85.854, 42.006], zoom: 10 });
});

Deno.test("resolveCameraConfig: coordinates + center override", () => {
  const result = resolveCameraConfig({
    coordinates: [-85.854, 42.006],
    center: [-86.0, 42.0],
  });
  assertEquals(result.center, [-86.0, 42.0]);
});

Deno.test("resolveCameraConfig: geojson only → fitBounds", () => {
  const result = resolveCameraConfig({ geojson: "./foo.geojson" });
  assertEquals(result.type, "fitBounds");
  assertEquals(result.zoom, undefined);
  assertEquals(result.center, undefined);
});

Deno.test("resolveCameraConfig: geojson + both zoom and center → explicit", () => {
  const result = resolveCameraConfig({
    geojson: "./foo.geojson",
    zoom: 10,
    center: [-85.854, 42.006],
  });
  assertEquals(result, { type: "explicit", center: [-85.854, 42.006], zoom: 10 });
});

Deno.test("resolveCameraConfig: geojson + zoom only → fitBounds with zoom hint", () => {
  const result = resolveCameraConfig({ geojson: "./foo.geojson", zoom: 8 });
  assertEquals(result.type, "fitBounds");
  assertEquals(result.zoom, 8);
});

// generateInitScript
const sampleGeoJson = {
  type: "FeatureCollection" as const,
  features: [{
    type: "Feature" as const,
    geometry: { type: "Point", coordinates: [-85.854, 42.006] },
    properties: { "marker-color": "#ff0000", title: "Test" },
  }],
};

Deno.test("generateInitScript: embeds container ID", () => {
  const script = generateInitScript({
    containerId: "map-my-post",
    geojson: sampleGeoJson,
    styleUrl: "https://example.com/style.json",
    camera: { type: "explicit", center: [-85.854, 42.006], zoom: 13 },
    showSwitcher: false,
    styles: {},
  });
  assertStringIncludes(script, "map-my-post");
});

Deno.test("generateInitScript: embeds style URL", () => {
  const script = generateInitScript({
    containerId: "map-test",
    geojson: sampleGeoJson,
    styleUrl: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    camera: { type: "explicit", center: [-85.854, 42.006], zoom: 13 },
    showSwitcher: false,
    styles: {},
  });
  assertStringIncludes(script, "positron-gl-style");
});

Deno.test("generateInitScript: includes fitBounds call for fitBounds camera", () => {
  const script = generateInitScript({
    containerId: "map-test",
    geojson: sampleGeoJson,
    styleUrl: "https://example.com/style.json",
    camera: { type: "fitBounds", center: undefined, zoom: undefined },
    showSwitcher: false,
    styles: {},
  });
  assertStringIncludes(script, "fitBounds");
});

Deno.test("generateInitScript: includes overlay toggle checkbox", () => {
  const script = generateInitScript({
    containerId: "map-test",
    geojson: sampleGeoJson,
    styleUrl: "https://example.com/style.json",
    camera: { type: "explicit", center: [0, 0], zoom: 5 },
    showSwitcher: false,
    styles: {},
  });
  assertStringIncludes(script, "MapControls");
  assertStringIncludes(script, "Show overlays");
  assertStringIncludes(script, 'type = "checkbox"');
});

Deno.test("generateInitScript: includes style select when showSwitcher true", () => {
  const script = generateInitScript({
    containerId: "map-test",
    geojson: sampleGeoJson,
    styleUrl: "https://example.com/style.json",
    camera: { type: "explicit", center: [0, 0], zoom: 5 },
    showSwitcher: true,
    styles: {
      positron: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    },
  });
  assertStringIncludes(script, 'createElement("select")');
});

Deno.test("generateInitScript: includes SimpleStyle circle-color expression", () => {
  const script = generateInitScript({
    containerId: "map-test",
    geojson: sampleGeoJson,
    styleUrl: "https://example.com/style.json",
    camera: { type: "explicit", center: [0, 0], zoom: 5 },
    showSwitcher: false,
    styles: {},
  });
  assertStringIncludes(script, "circle-color");
  assertStringIncludes(script, "marker-color");
});

// generateMapHtml
const baseParams = {
  slug: "my-post",
  geojson: {
    type: "FeatureCollection" as const,
    features: [{
      type: "Feature" as const,
      geometry: { type: "Point", coordinates: [0, 0] },
      properties: {},
    }],
  },
  styleUrl: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  camera: { type: "explicit" as const, center: [0, 0] as [number, number], zoom: 13 },
  showSwitcher: false,
  styles: {},
  fallback: null,
};

Deno.test("generateMapHtml: includes map-container div with id", () => {
  const html = generateMapHtml(baseParams);
  assertStringIncludes(html, 'class="map-container"');
  assertStringIncludes(html, 'id="map-my-post"');
});

Deno.test("generateMapHtml: appends mapClass to container div", () => {
  const html = generateMapHtml({ ...baseParams, mapClass: "nofeed" });
  assertStringIncludes(html, 'class="map-container nofeed"');
});

Deno.test("generateMapHtml: no fallback img when fallback is null", () => {
  const html = generateMapHtml(baseParams);
  assertEquals(html.includes("<img"), false);
});

Deno.test("generateMapHtml: includes fallback img without class by default", () => {
  const html = generateMapHtml({ ...baseParams, fallback: "./map.png" });
  assertStringIncludes(html, '<img loading="lazy"');
  assertStringIncludes(html, "map.png");
});

Deno.test("generateMapHtml: includes fallbackClass on img when set", () => {
  const html = generateMapHtml({
    ...baseParams,
    fallback: "./map.png",
    fallbackClass: "feedonly",
  });
  assertStringIncludes(html, 'class="feedonly"');
});

Deno.test("generateMapHtml: includes MapLibre CDN URLs in init script", () => {
  const html = generateMapHtml(baseParams);
  assertStringIncludes(html, "maplibre-gl.css");
  assertStringIncludes(html, "maplibre-gl");
});

Deno.test("generateMapHtml: init script uses dynamic import for MapLibre", () => {
  const html = generateMapHtml(baseParams);
  assertStringIncludes(html, "await import(");
});
