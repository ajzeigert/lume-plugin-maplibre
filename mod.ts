import { dirname, join } from "jsr:@std/path";
import { merge } from "lume/core/utils/object.ts";
import type Site from "lume/core/site.ts";
import type { Feature, FeatureCollection } from "npm:geojson@0.5.0";
import {
  generateInitScript,
  generateMapHtml,
  type CameraConfig,
  type MapHtmlParams,
} from "./components/map.ts";

export { generateInitScript, generateMapHtml };
export type { CameraConfig, FeatureCollection, MapHtmlParams };

const POSITRON_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export interface Options {
  defaultStyle?: string;
  styles?: Record<string, string>;
  layerSwitcher?: boolean;
  mapClass?: string;
  fallbackClass?: string;
  height?: number;
}

export const defaults: Options = {
  defaultStyle: "positron",
  styles: {},
};

interface MapFrontmatter {
  geojson?: string;
  coordinates?: [number, number];
  center?: [number, number];
  zoom?: number;
  style?: string;
  layerSwitcher?: boolean;
  fallback?: string;
  height?: number;
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
): FeatureCollection {
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
): FeatureCollection {
  if (geojson.type === "FeatureCollection") {
    return geojson as unknown as FeatureCollection;
  }
  if (geojson.type === "Feature") {
    return {
      type: "FeatureCollection",
      features: [geojson as unknown as Feature],
    };
  }
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      geometry: geojson as unknown as Feature["geometry"],
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
): Promise<FeatureCollection> {
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

export default function maplibre(userOptions?: Options): (site: Site) => void {
  const options = merge(defaults, userOptions);
  const allStyles: Record<string, string> = { positron: POSITRON_URL, ...options.styles };
  const styleCount = Object.keys(allStyles).length;

  return (site: Site) => {
    site.remoteFile(
      "_components/maplibre/map.ts",
      import.meta.resolve("./components/map.ts"),
    );

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
        const styleUrl = resolveStyleUrl(mapData.style, allStyles, options.defaultStyle);
        const camera = resolveCameraConfig(mapData);
        const switcher = showLayerSwitcher(
          options.layerSwitcher,
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
          mapClass: options.mapClass,
          fallbackClass: options.fallbackClass,
          height: mapData.height ?? options.height,
        });

        page.data.content = html + (page.data.content ?? "");
      }
    });
  };
}
