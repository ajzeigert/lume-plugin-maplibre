import { DOMParser } from "https://cdn.jsdelivr.net/gh/b-fuze/deno-dom@0.1.56/deno-dom-wasm.ts";
import type { Feature, FeatureCollection } from "npm:geojson@0.5.0";


const INIT_SCRIPT = await fetch(
	import.meta.resolve("../assets/map-init.js"),
).then((r) => r.text());
const _doc = new DOMParser().parseFromString("", "text/html")!;

export type { Feature, FeatureCollection };

export type CameraConfig =
	| { type: "explicit"; center: [number, number]; zoom: number }
	| { type: "fitBounds"; center?: [number, number]; zoom?: number };

interface InitScriptParams {
	containerId: string;
	geojson: FeatureCollection;
	styleUrl: string;
	camera: CameraConfig;
	showSwitcher: boolean;
	styles: Record<string, string>;
}

export interface MapHtmlParams {
	slug: string;
	geojson: FeatureCollection;
	styleUrl: string;
	camera: CameraConfig;
	showSwitcher: boolean;
	styles: Record<string, string>;
	fallback: string | null;
	mapClass?: string;
	fallbackClass?: string;
	height?: number;
}

// CSS that resets ds.css rules (details, summary, button, select) bleeding into MapLibre controls.
const DS_RESET_CSS = `
@scope (.maplibregl-control-container) {
  details { all: revert; }
  summary { all: revert; }
  summary::before { display: none; content: none; }
  button { all: revert; }
  select { all: revert; margin: 6px; padding: 2px 4px; font-size: 12px; cursor: pointer; }
  label { display: flex; align-items: center; gap: 4px; padding: 4px 6px; font-size: 12px; cursor: pointer; }
  input[type="checkbox"] { all: revert; }
  .d-flex { display: flex }
  .flex-column { flex-direction: column }
}`;

export function generateInitScript({
	containerId,
	geojson,
	styleUrl,
	camera,
	showSwitcher,
	styles,
}: InitScriptParams): string {
	const config = JSON.stringify({
		containerId,
		geojson,
		styleUrl,
		camera,
		showSwitcher,
		styles,
	});

	return `<script type="module">\nvar CONFIG = ${config};\n${INIT_SCRIPT}\n</script>`;
}

export function generateMapHtml({
	slug,
	geojson,
	styleUrl,
	camera,
	showSwitcher,
	styles,
	fallback,
	mapClass,
	fallbackClass,
	height = 400,
}: MapHtmlParams): string {
	const containerId = `map-${slug}`;
	const elements: string[] = [];

	if (fallback) {
		const img = _doc.createElement("img");
		img.setAttribute("loading", "lazy");
		img.setAttribute("src", fallback);
		img.setAttribute("alt", "Map");
		if (fallbackClass) img.setAttribute("class", fallbackClass);
		elements.push(img.outerHTML);
	}

	const div = _doc.createElement("div");
	div.setAttribute(
		"class",
		["map-container", mapClass].filter(Boolean).join(" "),
	);
	div.setAttribute("id", containerId);
	div.setAttribute("style", `height:${height}px;`);
	elements.push(div.outerHTML);

	elements.push(`<style>${DS_RESET_CSS}</style>`);

	elements.push(
		generateInitScript({
			containerId,
			geojson,
			styleUrl,
			camera,
			showSwitcher,
			styles,
		}),
	);

	return elements.join("\n\n") + "\n\n";
}

export default function (params: MapHtmlParams): string {
	return generateMapHtml(params);
}
