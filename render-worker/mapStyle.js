// mapStyle.src.ts
function buildMapStyle(config, mapboxToken, maptilerToken, contourTileUrl, stadiaToken) {
  if (config.preset === "topographic") {
    return buildTopographicStyle(config, mapboxToken, contourTileUrl);
  }
  if (config.preset === "route-only") {
    return buildRouteOnlyStyle(config, mapboxToken, maptilerToken, contourTileUrl);
  }
  if (config.preset === "road-network") {
    return buildRoadNetworkStyle(config, mapboxToken, contourTileUrl);
  }
  if (config.preset === "contour-art") {
    return buildContourArtStyle(config, mapboxToken, contourTileUrl);
  }
  if (config.preset === "natural-topo") {
    return buildNaturalTopoStyle(config, mapboxToken, maptilerToken, contourTileUrl);
  }
  if (config.preset === "stadia-watercolor") {
    return buildStadiaWatercolorStyle(config, contourTileUrl, stadiaToken, mapboxToken);
  }
  if (config.preset === "stadia-toner") {
    return buildStadiaTonerStyle(config, contourTileUrl, stadiaToken, mapboxToken);
  }
  if (config.preset === "native-toner") {
    return buildNativeTonerStyle(config, mapboxToken, contourTileUrl);
  }
  if (config.preset === "native-watercolor") {
    return buildNativeWatercolorStyle(config, contourTileUrl, mapboxToken);
  }
  if (config.preset === "alidade-smooth") {
    return buildAlidadeSmoothStyle(config, maptilerToken, mapboxToken, contourTileUrl);
  }
  if (config.preset === "alidade-smooth-dark") {
    return buildAlidadeSmoothDarkStyle(config, maptilerToken, mapboxToken, contourTileUrl);
  }
  return buildMinimalistStyle(config, mapboxToken, maptilerToken, contourTileUrl);
}
var CONTOUR_THRESHOLDS = {
  0: { 1: [1e3, 5e3], 7: [500, 2e3], 8: [500, 2e3], 9: [300, 1500], 10: [200, 1e3], 11: [200, 1e3], 12: [200, 1e3], 13: [100, 500], 14: [50, 200] },
  1: { 1: [500, 2e3], 7: [300, 1500], 8: [200, 1e3], 9: [100, 500], 10: [100, 500], 11: [100, 500], 12: [100, 500], 13: [50, 200], 14: [20, 100] },
  2: { 1: [200, 1e3], 7: [200, 1e3], 8: [100, 500], 9: [50, 250], 10: [50, 200], 11: [50, 200], 12: [50, 200], 13: [20, 100], 14: [10, 50] },
  3: { 1: [100, 500], 7: [100, 500], 8: [50, 250], 9: [30, 150], 10: [20, 100], 11: [20, 100], 12: [20, 100], 13: [10, 50], 14: [5, 20] },
  // default
  4: { 1: [50, 250], 7: [50, 250], 8: [30, 150], 9: [20, 100], 10: [10, 50], 11: [10, 50], 12: [10, 50], 13: [5, 20], 14: [5, 10] },
  5: { 1: [20, 100], 7: [20, 100], 8: [10, 50], 9: [10, 50], 10: [5, 20], 11: [5, 20], 12: [5, 20], 13: [2, 10], 14: [2, 5] }
};
function blendHex(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t).toString(16).padStart(2, "0");
  const g = Math.round(ag + (bg - ag) * t).toString(16).padStart(2, "0");
  const bh = Math.round(ab + (bb - ab) * t).toString(16).padStart(2, "0");
  return `#${r}${g}${bh}`;
}
function styledTileUrls(config, urls) {
  const effect = config.tile_effect ?? "none";
  if (effect === "none") return urls;
  if (effect === "duotone") {
    const shadow = (config.label_text_color ?? "#1C1917").replace("#", "");
    const highlight = (config.background_color ?? "#F7F4EF").replace("#", "");
    const strength = Math.round((config.tile_duotone_strength ?? 0.9) * 100);
    return urls.map((u) => `styledtile://duotone,${shadow},${highlight},${strength}|${u}`);
  }
  if (effect === "posterize") {
    const levels = config.tile_posterize_levels ?? 4;
    return urls.map((u) => `styledtile://posterize,${levels}|${u}`);
  }
  if (effect === "layer-color") {
    const shadowHex = config.tile_shadow_color ?? config.label_text_color ?? "#1C1917";
    const highlightHex = config.tile_highlight_color ?? config.background_color ?? "#F7F4EF";
    const midHex = config.tile_midtone_color ?? blendHex(shadowHex, highlightHex, 0.5);
    const shadow = shadowHex.replace("#", "");
    const mid = midHex.replace("#", "");
    const highlight = highlightHex.replace("#", "");
    return urls.map((u) => `styledtile://layer-color,${shadow},${mid},${highlight}|${u}`);
  }
  return urls;
}
function demSource(_token) {
  return {
    "mapbox-dem": {
      type: "raster-dem",
      tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 15,
      encoding: "terrarium",
      attribution: "\xA9 Mapzen, \xA9 OpenStreetMap contributors"
    }
  };
}
function mlContourSource(tileUrl) {
  return {
    "contours": {
      type: "vector",
      tiles: [tileUrl],
      minzoom: 0,
      maxzoom: 14
    }
  };
}
function terrainV2Source(token) {
  return {
    "mapbox-terrain-v2": {
      type: "vector",
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 10,
      maxzoom: 15,
      attribution: "\xA9 Mapbox"
    }
  };
}
function contourSource(token, contourTileUrl) {
  return contourTileUrl ? mlContourSource(contourTileUrl) : terrainV2Source(token);
}
function hillshadeLayers(config) {
  if (!config.show_hillshade) return [];
  return [
    {
      id: "hillshade",
      type: "hillshade",
      source: "mapbox-dem",
      paint: {
        "hillshade-shadow-color": "#000000",
        "hillshade-highlight-color": "#FFFFFF",
        "hillshade-accent-color": "#000000",
        "hillshade-illumination-direction": 335,
        "hillshade-exaggeration": config.hillshade_intensity
      }
    }
  ];
}
function contourLayers(config, usingMlContour) {
  if (!config.show_contours) return [];
  if (usingMlContour) {
    const layers2 = [
      {
        id: "contours-minor",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        filter: ["!=", ["get", "level"], 1],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": config.contour_color,
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            config.contour_opacity,
            14,
            config.contour_opacity * 0.9
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8 * (config.contour_minor_width ?? 1), 14, 1 * (config.contour_minor_width ?? 1)]
        }
      },
      {
        id: "contours-major",
        type: "line",
        source: "contours",
        "source-layer": "contours",
        filter: ["==", ["get", "level"], 1],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": config.contour_major_color,
          "line-opacity": config.contour_opacity,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.5 * (config.contour_major_width ?? 1), 14, 2.5 * (config.contour_major_width ?? 1)]
        }
      }
    ];
    if (config.show_elevation_labels) {
      layers2.push({
        id: "contours-labels",
        type: "symbol",
        source: "contours",
        "source-layer": "contours",
        filter: ["==", ["get", "level"], 1],
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": 500,
          "text-field": ["concat", ["to-string", ["get", "ele"]], "m"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 9, 14, 13],
          "text-letter-spacing": 0.06,
          "text-padding": 4,
          "text-pitch-alignment": "viewport",
          // viewport keeps labels horizontal — far more legible than map-aligned
          // which tilts text to follow the contour curve
          "text-rotation-alignment": "viewport"
        },
        paint: {
          "text-color": config.contour_major_color,
          // Use the poster background colour as the halo so it reads on both
          // light (chalk/topaz) and dark (obsidian/midnight) themes
          "text-halo-color": config.background_color,
          "text-halo-width": 2,
          "text-opacity": config.contour_opacity
        }
      });
    }
    return layers2;
  }
  const detail = Math.round(config.contour_detail ?? 2);
  const layers = [];
  if (detail >= 2) {
    layers.push({
      id: "contours-minor",
      type: "line",
      source: "mapbox-terrain-v2",
      "source-layer": "contour",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": config.contour_color,
        "line-opacity": [
          "interpolate",
          ["linear"],
          ["zoom"],
          5,
          config.contour_opacity,
          14,
          config.contour_opacity * 0.9
        ],
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8 * (config.contour_minor_width ?? 1), 14, 1 * (config.contour_minor_width ?? 1)]
      }
    });
  }
  if (detail >= 1) {
    layers.push({
      id: "contours-mid",
      type: "line",
      source: "mapbox-terrain-v2",
      "source-layer": "contour",
      filter: ["==", ["get", "index"], 5],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": config.contour_color,
        "line-opacity": config.contour_opacity,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.1 * (config.contour_minor_width ?? 1), 14, 1.5 * (config.contour_minor_width ?? 1)]
      }
    });
  }
  layers.push({
    id: "contours-major",
    type: "line",
    source: "mapbox-terrain-v2",
    "source-layer": "contour",
    filter: ["==", ["get", "index"], 10],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": config.contour_major_color,
      "line-opacity": config.contour_opacity,
      "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.5 * (config.contour_major_width ?? 1), 14, 2.5 * (config.contour_major_width ?? 1)]
    }
  });
  if (config.show_elevation_labels) {
    layers.push({
      id: "contours-labels",
      type: "symbol",
      source: "mapbox-terrain-v2",
      "source-layer": "contour",
      filter: ["==", ["get", "index"], 10],
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 500,
        "text-field": ["concat", ["to-string", ["get", "ele"]], "m"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 9, 14, 13],
        "text-letter-spacing": 0.06,
        "text-padding": 4,
        "text-pitch-alignment": "viewport",
        "text-rotation-alignment": "viewport"
      },
      paint: {
        "text-color": config.contour_major_color,
        "text-halo-color": config.background_color,
        "text-halo-width": 2,
        "text-opacity": config.contour_opacity
      }
    });
  }
  return layers;
}
function roadsSource(token) {
  return {
    "mapbox-streets": {
      type: "vector",
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: "\xA9 Mapbox \xA9 OpenStreetMap contributors"
    }
  };
}
function placeLabelTypes(scale) {
  if (scale === "city") return ["city"];
  if (scale === "village") return ["city", "town", "village"];
  return ["city", "town"];
}
function roadsLayers(config) {
  if (!config.show_roads) return [];
  const roadColor = config.roads_color ?? config.label_text_color;
  const roadOpacity = config.roads_opacity ?? 0.6;
  const labelColor = config.place_labels_color ?? config.label_text_color;
  const labelOpacity = config.place_labels_opacity ?? 0.75;
  const poiColor = config.poi_labels_color ?? config.label_text_color;
  const poiOpacity = config.poi_labels_opacity ?? 0.65;
  const layers = [
    // Motorways + trunk — widest, most prominent
    {
      id: "roads-major",
      type: "line",
      source: "mapbox-streets",
      "source-layer": "road",
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": roadColor,
        "line-opacity": roadOpacity * 0.5,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1, 14, 3.5]
      }
    },
    // Primary + secondary
    {
      id: "roads-primary",
      type: "line",
      source: "mapbox-streets",
      "source-layer": "road",
      filter: ["in", ["get", "class"], ["literal", ["primary", "secondary"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": roadColor,
        "line-opacity": roadOpacity * 0.37,
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.7, 14, 2.5]
      }
    },
    // Tertiary + local streets
    {
      id: "roads-minor",
      type: "line",
      source: "mapbox-streets",
      "source-layer": "road",
      filter: ["in", ["get", "class"], ["literal", ["tertiary", "street", "service", "path"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": roadColor,
        "line-opacity": roadOpacity * 0.23,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 14, 1.5]
      }
    }
  ];
  if (config.show_place_labels !== false) {
    layers.push({
      id: "roads-place-labels",
      type: "symbol",
      source: "mapbox-streets",
      "source-layer": "place_label",
      filter: ["in", ["get", "type"], ["literal", placeLabelTypes(config.place_labels_scale)]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 8, 9, 14, 13],
        "text-anchor": "center",
        "text-max-width": 8
      },
      paint: {
        "text-color": labelColor,
        "text-opacity": labelOpacity,
        "text-halo-color": config.background_color,
        "text-halo-width": 1.5
      }
    });
  }
  if (config.show_poi_labels) {
    layers.push({
      id: "roads-poi-labels",
      type: "symbol",
      source: "mapbox-streets",
      "source-layer": "poi_label",
      filter: [
        "all",
        ["<=", ["to-number", ["get", "filterrank"], 5], 3],
        ["!=", ["get", "maki"], "marker"]
      ],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
        "text-size": 10,
        "text-anchor": "top",
        "text-offset": [0, 0.6],
        "text-max-width": 6,
        "icon-image": ""
      },
      paint: {
        "text-color": poiColor,
        "text-opacity": poiOpacity,
        "text-halo-color": config.background_color,
        "text-halo-width": 1
      }
    });
  }
  return layers;
}
function trailSegmentSources(segments = []) {
  const sources = {};
  for (const seg of segments) {
    if (!seg.visible) continue;
    sources[`trail-seg-${seg.id}`] = {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    };
  }
  return sources;
}
function trailSegmentLayers(segments = [], config) {
  const layers = [];
  for (const seg of segments) {
    if (!seg.visible) continue;
    const width = seg.width ?? config.route_width ?? 2;
    const opacity = seg.opacity ?? 0.9;
    const dashArray = seg.dash ? [4, 3] : void 0;
    layers.push({
      id: `trail-seg-casing-${seg.id}`,
      type: "line",
      source: `trail-seg-${seg.id}`,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": config.segment_casing_color ?? "#FFFFFF",
        "line-width": width + (config.segment_casing_width ?? 3),
        "line-opacity": opacity
      }
    });
    const lineLayer = {
      id: `trail-seg-line-${seg.id}`,
      type: "line",
      source: `trail-seg-${seg.id}`,
      layout: {
        "line-join": "round",
        "line-cap": "round"
      },
      paint: {
        "line-color": seg.color,
        "line-width": width,
        "line-opacity": opacity,
        ...dashArray ? { "line-dasharray": dashArray } : {}
      }
    };
    layers.push(lineLayer);
  }
  return layers;
}
function segmentHandleSource() {
  return {
    "segment-handles": {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    }
  };
}
function segmentHandleLayers(config) {
  const dotR = config.segment_dot_size ?? 4;
  return [
    {
      id: "segment-handle-halo",
      type: "circle",
      source: "segment-handles",
      paint: {
        "circle-radius": dotR + 3,
        "circle-color": config.segment_casing_color ?? "#FFFFFF",
        "circle-opacity": 0.88,
        "circle-blur": 0.15
      }
    },
    {
      id: "segment-handle-dot",
      type: "circle",
      source: "segment-handles",
      paint: {
        "circle-radius": dotR,
        "circle-color": ["get", "color"],
        "circle-stroke-color": config.segment_casing_color ?? "#FFFFFF",
        "circle-stroke-width": 1.5,
        "circle-opacity": 1
      }
    }
  ];
}
function routeSource(config) {
  const useGradient = config.route_color_mode === "gradient" && !(config.route_deleted_ranges ?? []).length;
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    ...useGradient ? { lineMetrics: true } : {}
  };
}
function routeLayers(config) {
  const casing = {
    id: "route-line-casing",
    type: "line",
    source: "route",
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": config.background_color ?? "#F7F4EF",
      "line-width": config.route_width + 4,
      "line-opacity": config.route_opacity
    }
  };
  const useGradient = config.route_color_mode === "gradient" && !(config.route_deleted_ranges ?? []).length;
  if (useGradient) {
    return [
      casing,
      {
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-gradient": [
            "interpolate",
            ["linear"],
            ["line-progress"],
            0,
            "#4F8EF7",
            0.25,
            "#52B788",
            0.6,
            "#F4A261",
            0.85,
            "#E76F51",
            1,
            "#C1121F"
          ],
          "line-width": config.route_width,
          "line-opacity": config.route_opacity
        }
      }
    ];
  }
  return [
    casing,
    {
      id: "route-line",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": config.route_color,
        "line-width": config.route_width,
        "line-opacity": config.route_opacity
      }
    }
  ];
}
function buildMinimalistStyle(config, mapboxToken, maptilerToken, contourTileUrl) {
  const mapboxTk = mapboxToken || "";
  const maptilerTk = maptilerToken || "";
  const base = config.base_tile_style ?? "carto-light";
  const usingMlContour = !!contourTileUrl;
  let baseTileSource;
  let baseTileOpacity;
  let baseTileAttribution;
  if (base === "maptiler-outdoor" || base === "maptiler-topo" || base === "maptiler-winter") {
    const styleMap = {
      "maptiler-outdoor": "outdoor-v2",
      "maptiler-topo": "topo-v2",
      "maptiler-winter": "winter-v2"
    };
    baseTileSource = {
      type: "raster",
      tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/${styleMap[base]}/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
      tileSize: 512
    };
    baseTileOpacity = 0.85;
    baseTileAttribution = "\xA9 MapTiler \xA9 OpenStreetMap contributors";
  } else {
    const dark = base === "carto-dark";
    const sub = (s) => ["a", "b", "c", "d"].map((p) => `https://${p}.basemaps.cartocdn.com/${s}/{z}/{x}/{y}@2x.png`);
    baseTileSource = {
      type: "raster",
      tiles: styledTileUrls(config, dark ? sub("dark_all") : sub("light_all")),
      tileSize: 512
    };
    baseTileOpacity = base === "carto-dark" ? 0.45 : 0.55;
    baseTileAttribution = "\xA9 CARTO \xA9 OpenStreetMap contributors";
  }
  return {
    version: 8,
    name: "RadMaps Minimalist",
    glyphs: mapboxTk ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "base-tiles": { ...baseTileSource, attribution: baseTileAttribution },
      ...config.show_hillshade || config.map_3d ? demSource(mapboxTk) : {},
      ...config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {},
      ...config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      {
        id: "base-tiles",
        type: "raster",
        source: "base-tiles",
        paint: {
          "raster-opacity": baseTileOpacity,
          "raster-contrast": config.tile_contrast ?? 0,
          "raster-saturation": config.tile_saturation ?? 0,
          "raster-hue-rotate": config.tile_hue_rotate ?? 0
        }
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...mapboxTk ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildRouteOnlyStyle(config, mapboxToken, maptilerToken, contourTileUrl) {
  const mapboxTk = mapboxToken || "";
  const usingMlContour = !!contourTileUrl;
  const glyphs = mapboxTk ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
  return {
    version: 8,
    name: "RadMaps Route Only",
    glyphs,
    sources: {
      ...config.show_hillshade || config.map_3d ? demSource(mapboxTk) : {},
      ...config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {},
      ...config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...mapboxTk ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildRoadNetworkStyle(config, mapboxToken, contourTileUrl) {
  const token = mapboxToken || "";
  const usingMlContour = !!contourTileUrl;
  const bg = config.background_color;
  const ink = config.label_text_color;
  const sources = {
    ...config.show_hillshade || config.map_3d ? demSource(token) : {},
    ...config.show_contours ? contourSource(token, contourTileUrl) : {},
    route: routeSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource()
  };
  const fillLayers = [];
  const roadLineLayers = [];
  if (token) {
    sources["mapbox-streets"] = {
      type: "vector",
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: "\xA9 Mapbox \xA9 OpenStreetMap contributors"
    };
    fillLayers.push({
      id: "rn-water",
      type: "fill",
      source: "mapbox-streets",
      "source-layer": "water",
      paint: { "fill-color": config.water_color ?? "#B8D8E8", "fill-opacity": 0.6 }
    });
    fillLayers.push({
      id: "rn-landuse",
      type: "fill",
      source: "mapbox-streets",
      "source-layer": "landuse",
      filter: ["in", ["get", "class"], ["literal", ["park", "grass", "wood", "forest", "scrub"]]],
      paint: { "fill-color": ink, "fill-opacity": 0.04 }
    });
    roadLineLayers.push({
      id: "rn-service",
      type: "line",
      source: "mapbox-streets",
      "source-layer": "road",
      filter: ["in", ["get", "class"], ["literal", ["service", "path", "pedestrian", "track"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ink,
        "line-opacity": 0.18,
        "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.3, 15, 0.8]
      }
    });
    roadLineLayers.push({
      id: "rn-street",
      type: "line",
      source: "mapbox-streets",
      "source-layer": "road",
      filter: ["in", ["get", "class"], ["literal", ["street", "street_limited", "tertiary"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ink,
        "line-opacity": 0.32,
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.4, 14, 1.2]
      }
    });
    roadLineLayers.push({
      id: "rn-secondary",
      type: "line",
      source: "mapbox-streets",
      "source-layer": "road",
      filter: ["in", ["get", "class"], ["literal", ["secondary", "primary"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ink,
        "line-opacity": 0.55,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 14, 2]
      }
    });
    roadLineLayers.push({
      id: "rn-motorway",
      type: "line",
      source: "mapbox-streets",
      "source-layer": "road",
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": ink,
        "line-opacity": 0.75,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 14, 3]
      }
    });
  }
  return {
    version: 8,
    name: "RadMaps Road Network",
    glyphs: token ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources,
    layers: [
      { id: "background", type: "background", paint: { "background-color": bg } },
      ...fillLayers,
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...roadLineLayers,
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildContourArtStyle(config, mapboxToken, contourTileUrl) {
  const token = mapboxToken || "";
  const usingMlContour = !!contourTileUrl;
  const artConfig = { ...config, show_contours: true, contour_detail: 4 };
  const glyphs = token ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
  return {
    version: 8,
    name: "RadMaps Contour Art",
    glyphs,
    sources: {
      ...config.show_hillshade || config.map_3d ? demSource(token) : {},
      ...contourSource(token, contourTileUrl),
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      // Hillshade at very low opacity for subtle topographic depth
      ...config.show_hillshade ? [{
        id: "hillshade",
        type: "hillshade",
        source: "mapbox-dem",
        paint: {
          "hillshade-shadow-color": "#000000",
          "hillshade-highlight-color": "#FFFFFF",
          "hillshade-accent-color": "#000000",
          "hillshade-illumination-direction": 335,
          "hillshade-exaggeration": Math.min(config.hillshade_intensity, 0.25)
        }
      }] : [],
      // Contour art layers — wider lines for bold print look
      ...usingMlContour ? [
        {
          id: "contours-minor",
          type: "line",
          source: "contours",
          "source-layer": "contours",
          filter: ["!=", ["get", "level"], 1],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": artConfig.contour_color,
            "line-opacity": artConfig.contour_opacity,
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.5, 14, 0.9]
          }
        },
        {
          id: "contours-major",
          type: "line",
          source: "contours",
          "source-layer": "contours",
          filter: ["==", ["get", "level"], 1],
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": artConfig.contour_major_color,
            "line-opacity": artConfig.contour_opacity,
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1.2, 14, 2]
          }
        },
        ...config.show_elevation_labels ? [{
          id: "contours-labels",
          type: "symbol",
          source: "contours",
          "source-layer": "contours",
          filter: ["==", ["get", "level"], 1],
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 500,
            "text-field": ["concat", ["to-string", ["get", "ele"]], "m"],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 5, 9, 14, 13],
            "text-letter-spacing": 0.06,
            "text-padding": 4,
            "text-pitch-alignment": "viewport",
            "text-rotation-alignment": "viewport"
          },
          paint: {
            "text-color": artConfig.contour_major_color,
            "text-halo-color": config.background_color,
            "text-halo-width": 2,
            "text-opacity": artConfig.contour_opacity
          }
        }] : []
      ] : contourLayers(artConfig, false),
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildNaturalTopoStyle(config, mapboxToken, maptilerToken, contourTileUrl) {
  const mapboxTk = mapboxToken || "";
  const maptilerTk = maptilerToken || "";
  const usingMlContour = !!contourTileUrl;
  const tileStyle = config.base_tile_style === "maptiler-topo" || config.base_tile_style === "maptiler-winter" ? config.base_tile_style : "maptiler-outdoor";
  const styleMap = {
    "maptiler-outdoor": "outdoor-v2",
    "maptiler-topo": "topo-v2",
    "maptiler-winter": "winter-v2"
  };
  const tileMapStyle = styleMap[tileStyle] ?? "outdoor-v2";
  return {
    version: 8,
    name: "RadMaps Natural Topo",
    glyphs: mapboxTk ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "base-tiles": {
        type: "raster",
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/${tileMapStyle}/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: "\xA9 MapTiler \xA9 OpenStreetMap contributors"
      },
      ...config.show_hillshade || config.map_3d ? demSource(mapboxTk) : {},
      ...config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {},
      ...config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      {
        id: "base-tiles",
        type: "raster",
        source: "base-tiles",
        paint: {
          "raster-opacity": 0.95,
          "raster-contrast": config.tile_contrast ?? 0,
          "raster-saturation": config.tile_saturation ?? 0,
          "raster-hue-rotate": config.tile_hue_rotate ?? 0
        }
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...mapboxTk ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildStadiaWatercolorStyle(config, contourTileUrl, stadiaToken, mapboxToken) {
  const usingMlContour = !!contourTileUrl;
  const keyParam = stadiaToken ? `?api_key=${stadiaToken}` : "";
  const mapboxTk = mapboxToken || "";
  return {
    version: 8,
    name: "RadMaps Watercolor",
    glyphs: mapboxTk ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "base-tiles": {
        type: "raster",
        // Use @2x (512×512 retina) tiles + tileSize 512 so the worker
        // gets twice the source pixel density. At print DPI the rendered
        // zoom often exceeds the source maxzoom (Stadia stamen_watercolor
        // is capped at z14 server-side), and MapLibre upscales — @2x
        // halves the upscale factor so glyphs/edges stay sharp.
        tiles: styledTileUrls(config, [
          `https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}@2x.jpg${keyParam}`
        ]),
        tileSize: 512,
        // Stadia stamen_watercolor's effective server-side maxzoom is 14 —
        // higher zooms return 204 No Content even though they advertise 16.
        // Cap here so MapLibre upscales z14 tiles for higher view zooms
        // (e.g. 300 DPI print rendering at zoom 15+) instead of leaving
        // gaps. Watercolor is artistic — soft upscale looks fine.
        maxzoom: 14,
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> / <a href="https://stadiamaps.com">Stadia Maps</a>, CC BY 3.0. Data \xA9 <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
      },
      ...config.show_hillshade || config.map_3d ? demSource("") : {},
      ...config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {},
      ...config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#d4dde1" } },
      {
        id: "base-tiles",
        type: "raster",
        source: "base-tiles",
        paint: {
          "raster-opacity": 0.95,
          "raster-contrast": config.tile_contrast ?? 0,
          "raster-saturation": config.tile_saturation ?? 0,
          "raster-hue-rotate": config.tile_hue_rotate ?? 0
        }
      },
      ...config.show_hillshade ? hillshadeLayers(config) : [],
      ...config.show_contours ? contourLayers(config, usingMlContour) : [],
      ...mapboxTk ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildStadiaTonerStyle(config, contourTileUrl, stadiaToken, mapboxToken) {
  const usingMlContour = !!contourTileUrl;
  const keyParam = stadiaToken ? `?api_key=${stadiaToken}` : "";
  const mapboxTk = mapboxToken || "";
  return {
    version: 8,
    name: "RadMaps Toner",
    glyphs: mapboxTk ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "base-tiles": {
        type: "raster",
        // @2x for HiDPI print rendering — see watercolor source comment.
        tiles: styledTileUrls(config, [
          `https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}@2x.png${keyParam}`
        ]),
        tileSize: 512,
        attribution: 'Map tiles by <a href="https://stamen.com">Stamen Design</a> / <a href="https://stadiamaps.com">Stadia Maps</a>, CC BY 3.0. Data \xA9 <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
      },
      ...config.show_hillshade || config.map_3d ? demSource("") : {},
      ...config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {},
      ...config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#ffffff" } },
      {
        id: "base-tiles",
        type: "raster",
        source: "base-tiles",
        paint: {
          "raster-opacity": 0.85,
          "raster-contrast": config.tile_contrast ?? 0,
          "raster-saturation": config.tile_saturation ?? 0,
          "raster-hue-rotate": config.tile_hue_rotate ?? 0
        }
      },
      ...config.show_hillshade ? hillshadeLayers(config) : [],
      ...config.show_contours ? contourLayers(config, usingMlContour) : [],
      ...mapboxTk ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildNativeTonerStyle(config, mapboxToken, contourTileUrl) {
  const token = mapboxToken || "";
  const usingMlContour = !!contourTileUrl;
  const ink = config.label_text_color;
  const sources = {
    ...config.show_hillshade || config.map_3d ? demSource(token) : {},
    ...config.show_contours ? contourSource(token, contourTileUrl) : {},
    route: routeSource(config),
    ...trailSegmentSources(config.trail_segments),
    ...segmentHandleSource()
  };
  const baseLayers = [];
  const roadLineLayers = [];
  if (token) {
    sources["mapbox-streets"] = {
      type: "vector",
      tiles: [`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf?access_token=${token}`],
      minzoom: 0,
      maxzoom: 16,
      attribution: "\xA9 Mapbox \xA9 OpenStreetMap contributors"
    };
    baseLayers.push(
      {
        id: "nt-water",
        type: "fill",
        source: "mapbox-streets",
        "source-layer": "water",
        paint: { "fill-color": ink, "fill-opacity": 0.85 }
      },
      {
        id: "nt-landuse",
        type: "fill",
        source: "mapbox-streets",
        "source-layer": "landuse",
        filter: ["in", ["get", "class"], ["literal", ["park", "grass", "wood", "forest", "scrub"]]],
        paint: { "fill-color": ink, "fill-opacity": 0.08 }
      },
      {
        id: "nt-buildings",
        type: "fill",
        source: "mapbox-streets",
        "source-layer": "building",
        paint: { "fill-color": ink, "fill-opacity": 0.06 }
      }
    );
    roadLineLayers.push(
      {
        id: "nt-service",
        type: "line",
        source: "mapbox-streets",
        "source-layer": "road",
        filter: ["in", ["get", "class"], ["literal", ["service", "path", "pedestrian", "track"]]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ink,
          "line-opacity": 0.25,
          "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.4, 15, 1]
        }
      },
      {
        id: "nt-street",
        type: "line",
        source: "mapbox-streets",
        "source-layer": "road",
        filter: ["in", ["get", "class"], ["literal", ["street", "street_limited", "tertiary"]]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ink,
          "line-opacity": 0.55,
          "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 14, 1.6]
        }
      },
      {
        id: "nt-secondary",
        type: "line",
        source: "mapbox-streets",
        "source-layer": "road",
        filter: ["in", ["get", "class"], ["literal", ["secondary", "primary"]]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ink,
          "line-opacity": 0.8,
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.8, 14, 2.8]
        }
      },
      {
        id: "nt-motorway",
        type: "line",
        source: "mapbox-streets",
        "source-layer": "road",
        filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk"]]],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ink,
          "line-opacity": 1,
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 1, 14, 4]
        }
      }
    );
  } else {
    sources["base-tiles"] = {
      type: "raster",
      tiles: ["a", "b", "c", "d"].map((p) => `https://${p}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`),
      tileSize: 512,
      attribution: "\xA9 CARTO \xA9 OpenStreetMap contributors"
    };
    baseLayers.push({
      id: "base-tiles",
      type: "raster",
      source: "base-tiles",
      paint: { "raster-opacity": 0.9, "raster-saturation": -1, "raster-contrast": 0.3 }
    });
  }
  return {
    version: 8,
    name: "RadMaps Native Toner",
    glyphs: token ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources,
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      ...baseLayers,
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...roadLineLayers,
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildNativeWatercolorStyle(config, contourTileUrl, mapboxToken) {
  const usingMlContour = !!contourTileUrl;
  const mapboxTk = mapboxToken || "";
  const cartoUrls = ["a", "b", "c", "d"].map(
    (p) => `https://${p}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png`
  );
  return {
    version: 8,
    name: "RadMaps Native Watercolor",
    glyphs: mapboxTk ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "base-tiles": {
        type: "raster",
        tiles: styledTileUrls(config, cartoUrls),
        tileSize: 512,
        attribution: "\xA9 CARTO \xA9 OpenStreetMap contributors"
      },
      ...config.show_hillshade || config.map_3d ? demSource("") : {},
      ...config.show_contours && contourTileUrl ? { contours: { type: "vector", tiles: [contourTileUrl], minzoom: 0, maxzoom: 14 } } : {},
      ...config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      {
        id: "base-tiles",
        type: "raster",
        source: "base-tiles",
        paint: {
          "raster-opacity": 0.38,
          "raster-saturation": (config.tile_saturation ?? 0) - 0.35,
          "raster-hue-rotate": (config.tile_hue_rotate ?? 0) + 18,
          "raster-contrast": (config.tile_contrast ?? 0) - 0.15
        }
      },
      ...config.show_hillshade ? hillshadeLayers(config) : [],
      ...config.show_contours && usingMlContour ? contourLayers(config, true) : [],
      ...mapboxTk ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildAlidadeSmoothStyle(config, maptilerToken, mapboxToken, contourTileUrl) {
  const maptilerTk = maptilerToken || "";
  const mapboxTk = mapboxToken || "";
  const usingMlContour = !!contourTileUrl;
  return {
    version: 8,
    name: "RadMaps Alidade Smooth",
    glyphs: mapboxTk ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "base-tiles": {
        type: "raster",
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: "\xA9 MapTiler \xA9 OpenStreetMap contributors"
      },
      ...config.show_hillshade || config.map_3d ? demSource(mapboxTk) : {},
      ...config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {},
      ...config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      {
        id: "base-tiles",
        type: "raster",
        source: "base-tiles",
        paint: {
          "raster-opacity": 0.92,
          "raster-contrast": config.tile_contrast ?? 0,
          "raster-saturation": config.tile_saturation ?? 0,
          "raster-hue-rotate": config.tile_hue_rotate ?? 0
        }
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...mapboxTk ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildAlidadeSmoothDarkStyle(config, maptilerToken, mapboxToken, contourTileUrl) {
  const maptilerTk = maptilerToken || "";
  const mapboxTk = mapboxToken || "";
  const usingMlContour = !!contourTileUrl;
  return {
    version: 8,
    name: "RadMaps Alidade Smooth Dark",
    glyphs: mapboxTk ? `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${mapboxTk}` : "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "base-tiles": {
        type: "raster",
        tiles: styledTileUrls(config, [`https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}@2x.png?key=${maptilerTk}`]),
        tileSize: 512,
        attribution: "\xA9 MapTiler \xA9 OpenStreetMap contributors"
      },
      ...config.show_hillshade || config.map_3d ? demSource(mapboxTk) : {},
      ...config.show_contours ? contourSource(mapboxTk, contourTileUrl) : {},
      ...config.show_roads && mapboxTk ? roadsSource(mapboxTk) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      {
        id: "base-tiles",
        type: "raster",
        source: "base-tiles",
        paint: {
          "raster-opacity": 0.88,
          "raster-contrast": config.tile_contrast ?? 0,
          "raster-saturation": config.tile_saturation ?? 0,
          "raster-hue-rotate": config.tile_hue_rotate ?? 0
        }
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...mapboxTk ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
function buildTopographicStyle(config, mapboxToken, contourTileUrl) {
  const token = mapboxToken || "";
  const usingMlContour = !!contourTileUrl;
  return {
    version: 8,
    name: "RadMaps Topographic",
    glyphs: `https://api.mapbox.com/fonts/v1/mapbox/{fontstack}/{range}.pbf?access_token=${token}`,
    sources: {
      "mapbox-outdoors": {
        type: "raster",
        tiles: styledTileUrls(config, [`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}`]),
        tileSize: 512,
        attribution: "\xA9 Mapbox \xA9 OpenStreetMap contributors"
      },
      ...config.show_hillshade || config.map_3d ? demSource(token) : {},
      ...config.show_contours ? contourSource(token, contourTileUrl) : {},
      ...config.show_roads && token ? roadsSource(token) : {},
      route: routeSource(config),
      ...trailSegmentSources(config.trail_segments),
      ...segmentHandleSource()
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": config.background_color } },
      {
        id: "outdoors-tiles",
        type: "raster",
        source: "mapbox-outdoors",
        paint: {
          "raster-opacity": config.show_hillshade ? 0.75 : 0.9,
          "raster-saturation": Math.max(-1, Math.min(1, (config.show_hillshade ? -0.15 : 0) + (config.tile_saturation ?? 0))),
          "raster-contrast": config.tile_contrast ?? 0,
          "raster-hue-rotate": config.tile_hue_rotate ?? 0
        }
      },
      ...hillshadeLayers(config),
      ...contourLayers(config, usingMlContour),
      ...token ? roadsLayers(config) : [],
      ...routeLayers(config),
      ...trailSegmentLayers(config.trail_segments, config),
      ...segmentHandleLayers(config)
    ]
  };
}
export {
  CONTOUR_THRESHOLDS,
  blendHex,
  buildMapStyle,
  trailSegmentLayers,
  trailSegmentSources
};
