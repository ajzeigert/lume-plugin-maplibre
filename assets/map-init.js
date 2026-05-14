// Injected into a <script type="module"> by components/map.ts.
// CONFIG is provided as a module-scoped variable prepended by generateInitScript.

var MAPLIBRE_CSS = "https://cdn.jsdelivr.net/npm/maplibre-gl@latest/dist/maplibre-gl.css";
var MAPLIBRE_JS = "https://cdn.jsdelivr.net/npm/maplibre-gl@latest/+esm";

function toStyle(url) {
	if (url.indexOf("{z}") === -1) return url;
	return {
		version: 8,
		sources: { basemap: { type: "raster", tiles: [url], tileSize: 256 } },
		layers: [{ id: "basemap", type: "raster", source: "basemap" }],
	};
}

function getBbox(geojson) {
	var minLng = Infinity,
		minLat = Infinity,
		maxLng = -Infinity,
		maxLat = -Infinity;
	function walk(c) {
		if (typeof c[0] === "number") {
			if (c[0] < minLng) minLng = c[0];
			if (c[1] < minLat) minLat = c[1];
			if (c[0] > maxLng) maxLng = c[0];
			if (c[1] > maxLat) maxLat = c[1];
		} else {
			c.forEach(walk);
		}
	}
	geojson.features.forEach((f) => {
		walk(f.geometry.coordinates);
	});
	return [
		[minLng, minLat],
		[maxLng, maxLat],
	];
}

function addLayers(map) {
	map.addSource("data", { type: "geojson", data: CONFIG.geojson });

	var types = CONFIG.geojson.features.map((f) => {
		return f.geometry.type;
	});

	if (
		types.some((t) => {
			return t === "Polygon" || t === "MultiPolygon";
		})
	) {
		map.addLayer({
			id: "map-fill",
			type: "fill",
			source: "data",
			filter: [
				"match",
				["geometry-type"],
				["Polygon", "MultiPolygon"],
				true,
				false,
			],
			paint: {
				"fill-color": ["coalesce", ["get", "fill"], "#555555"],
				"fill-opacity": ["coalesce", ["get", "fill-opacity"], 0.5],
			},
		});
		map.addLayer({
			id: "map-line-border",
			type: "line",
			source: "data",
			filter: [
				"match",
				["geometry-type"],
				["Polygon", "MultiPolygon"],
				true,
				false,
			],
			paint: {
				"line-color": ["coalesce", ["get", "stroke"], "#555555"],
				"line-width": ["coalesce", ["get", "stroke-width"], 2],
				"line-opacity": ["coalesce", ["get", "stroke-opacity"], 1],
			},
		});
	}

	if (
		types.some((t) => {
			return t === "LineString" || t === "MultiLineString";
		})
	) {
		map.addLayer({
			id: "map-line",
			type: "line",
			source: "data",
			filter: [
				"match",
				["geometry-type"],
				["LineString", "MultiLineString"],
				true,
				false,
			],
			paint: {
				"line-color": ["coalesce", ["get", "stroke"], "#555555"],
				"line-width": ["coalesce", ["get", "stroke-width"], 2],
				"line-opacity": ["coalesce", ["get", "stroke-opacity"], 1],
			},
		});
	}

	if (
		types.some((t) => {
			return t === "Point" || t === "MultiPoint";
		})
	) {
		map.addLayer({
			id: "map-circle",
			type: "circle",
			source: "data",
			filter: [
				"match",
				["geometry-type"],
				["Point", "MultiPoint"],
				true,
				false,
			],
			paint: {
				"circle-color": ["coalesce", ["get", "marker-color"], "#555555"],
				"circle-radius": [
					"case",
					["==", ["get", "marker-size"], "small"],
					4,
					["==", ["get", "marker-size"], "large"],
					9,
					6,
				],
				"circle-stroke-width": 1,
				"circle-stroke-color": "#ffffff",
			},
		});
	}

	["map-fill", "map-line", "map-line-border", "map-circle"].forEach(
		(layerId) => {
			if (!map.getLayer(layerId)) return;
			map.on("click", layerId, (e) => {
				var props = e.features[0].properties;
				if (!props.title && !props.description) return;
				new maplibregl.Popup()
					.setLngLat(e.lngLat)
					.setHTML(
						"<strong>" +
							(props.title || "") +
							"</strong>" +
							(props.description ? "<p>" + props.description + "</p>" : ""),
					)
					.addTo(map);
			});
			map.on("mouseenter", layerId, (e) => {
				var props = e.features[0].properties;
				if (props.title || props.description) {
					map.getCanvas().style.cursor = "pointer";
				}
			});
			map.on("mouseleave", layerId, () => {
				map.getCanvas().style.cursor = "";
			});
		},
	);
}

var overlayVisible = true;

function applyOverlayVisibility(map) {
	var v = overlayVisible ? "visible" : "none";
	["map-fill", "map-line", "map-line-border", "map-circle"].forEach((id) => {
		if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", v);
	});
}

function MapControls(styles, currentUrl, showSwitcher) {
	this._styles = styles;
	this._current = currentUrl;
	this._showSwitcher = showSwitcher;
}
MapControls.prototype.onAdd = function (map) {
	this._map = map;
	var self = this;
	var el = document.createElement("div");
	el.className = "maplibregl-ctrl maplibregl-ctrl-group lume-map-controls";

	var label = document.createElement("label");
	var checkbox = document.createElement("input");
	checkbox.type = "checkbox";
	checkbox.checked = true;
	checkbox.onchange = () => {
		overlayVisible = checkbox.checked;
		applyOverlayVisibility(map);
	};
	label.appendChild(checkbox);
	label.appendChild(document.createTextNode(" Show overlays"));
	el.appendChild(label);

	if (this._showSwitcher) {
		var select = document.createElement("select");
		Object.keys(this._styles).forEach((name) => {
			var url = self._styles[name];
			var opt = document.createElement("option");
			opt.value = url;
			opt.textContent = name;
			opt.selected = url === self._current;
			select.appendChild(opt);
		});
		select.onchange = () => {
			self._current = select.value;
			map.setStyle(toStyle(select.value), { diff: false });
		};
		el.appendChild(select);
	}

	this._container = el;
	return el;
};
MapControls.prototype.onRemove = function () {
	this._container.parentNode.removeChild(this._container);
	this._map = undefined;
};
if (!document.querySelector('link[href="' + MAPLIBRE_CSS + '"]')) {
	var link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = MAPLIBRE_CSS;
	document.head.appendChild(link);
}

var { default: maplibregl } = await import(MAPLIBRE_JS);

var mapOptions = {
	container: CONFIG.containerId,
	style: toStyle(CONFIG.styleUrl),
};

if (CONFIG.camera.type === "explicit") {
	mapOptions.center = CONFIG.camera.center;
	mapOptions.zoom = CONFIG.camera.zoom;
}

var map = new maplibregl.Map(mapOptions);

map.on("style.load", () => {
	if (map.getSource("data")) return;
	addLayers(map);
	applyOverlayVisibility(map);
	if (CONFIG.camera.type === "fitBounds") {
		var bbox = getBbox(CONFIG.geojson);
		var opts = { padding: 40 };
		if (CONFIG.camera.zoom !== undefined) opts.maxZoom = CONFIG.camera.zoom;
		if (CONFIG.camera.center !== undefined) opts.center = CONFIG.camera.center;
		map.fitBounds(bbox, opts);
	}
});

map.addControl(new maplibregl.NavigationControl(), "top-right");
map.addControl(
	new MapControls(CONFIG.styles, CONFIG.styleUrl, CONFIG.showSwitcher),
	"bottom-left",
);
