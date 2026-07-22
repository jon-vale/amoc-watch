import {
  geoAzimuthalEqualArea,
  geoGraticule,
  geoPath,
  type GeoPermissibleObjects,
} from "d3-geo";
import { feature, mesh } from "topojson-client";
import type { MultiLineString, MultiPoint } from "geojson";
import type {
  GeometryCollection,
  Topology,
} from "topojson-specification";
import worldAtlas from "world-atlas/countries-50m.json";

export type MapLayer = "circulation" | "freshwater" | "evidence";

type AtlasObjects = {
  countries: GeometryCollection;
  land: GeometryCollection;
};

type NorthAtlanticMapProps = {
  layer: MapLayer;
  observations?: MapObservations;
};

export type MapObservations = {
  targetMonth: string;
  argo?: {
    month: string;
    profileCount: number;
    aligned: boolean;
    bounds: {
      latitudeMin: number;
      latitudeMax: number;
      longitudeMin: number;
      longitudeMax: number;
    };
  };
  oisst?: {
    month: string;
    value: number;
    units: string;
    aligned: boolean;
    latitude: number;
    longitude: number;
  };
};

type Coordinate = [number, number];

const WIDTH = 800;
const HEIGHT = 580;

const atlas = worldAtlas as unknown as Topology<AtlasObjects>;
const region: MultiPoint = {
  type: "MultiPoint",
  coordinates: [
    [-72, 40],
    [16, 40],
    [16, 80],
    [-72, 80],
  ],
};

const projection = geoAzimuthalEqualArea()
  .rotate([30, -60])
  .fitExtent(
    [
      [18, 28],
      [WIDTH - 18, HEIGHT - 58],
    ],
    region,
  )
  .clipExtent([
    [12, 22],
    [WIDTH - 12, HEIGHT - 52],
  ]);

const path = geoPath(projection);
const land = feature(atlas, atlas.objects.land);
const borders = mesh(
  atlas,
  atlas.objects.countries,
  (countryA, countryB) => countryA !== countryB,
);
const graticule = geoGraticule()
  .extent([
    [-70, 40],
    [15, 80],
  ])
  .step([10, 10])();

function linePath(coordinates: Coordinate[]) {
  return path({ type: "LineString", coordinates } as GeoPermissibleObjects) ?? "";
}

function smoothLinePath(coordinates: Coordinate[]) {
  const points = coordinates.map(locate);
  if (points.length < 2) return "";
  const [startX, startY] = points[0];
  let value = `M${startX.toFixed(2)},${startY.toFixed(2)}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const [controlX, controlY] = points[index];
    const [nextX, nextY] = points[index + 1];
    value += ` Q${controlX.toFixed(2)},${controlY.toFixed(2)} ${((controlX + nextX) / 2).toFixed(2)},${((controlY + nextY) / 2).toFixed(2)}`;
  }
  const [controlX, controlY] = points.at(-2) ?? points[0];
  const [endX, endY] = points.at(-1) ?? points[0];
  return `${value} Q${controlX.toFixed(2)},${controlY.toFixed(2)} ${endX.toFixed(2)},${endY.toFixed(2)}`;
}

function multiLinePath(coordinates: Coordinate[][]) {
  const geometry: MultiLineString = { type: "MultiLineString", coordinates };
  return path(geometry) ?? "";
}

function locate(coordinate: Coordinate) {
  return projection(coordinate) ?? [0, 0];
}

const warmUpperLimb = smoothLinePath([
  [-58, 40.5],
  [-51, 43.5],
  [-44, 47.5],
  [-36, 51.5],
  [-27, 54],
  [-17, 56],
  [-8, 61],
]);

const subpolarWarmLoop = smoothLinePath([
  [-32, 52],
  [-24, 58],
  [-17, 63],
  [-25, 66],
  [-35, 64],
  [-43, 60],
]);

const easternWarmBranch = smoothLinePath([
  [-24, 55],
  [-15, 58],
  [-7, 62],
  [4, 66],
]);

const deepReturn = smoothLinePath([
  [-8, 72],
  [-18, 67],
  [-27, 63],
  [-34, 63],
  [-42, 59.5],
  [-49, 56],
  [-54, 51],
  [-53, 45],
  [-48, 40.5],
]);

const easternDeepBranch = smoothLinePath([
  [8, 74],
  [1, 69],
  [-8, 65],
  [-15, 59],
  [-20, 52],
  [-18, 46],
]);

const eastGreenlandCoastal = smoothLinePath([
  [-8, 79],
  [-14, 75],
  [-20, 71],
  [-27, 66],
  [-35, 62],
  [-43, 60],
]);

const labradorCoastal = smoothLinePath([
  [-58, 64],
  [-59, 59],
  [-58, 54],
  [-55, 49],
  [-51, 45],
]);

const eastGreenlandFreshwater = smoothLinePath([
  [-8, 79],
  [-14, 76],
  [-19, 72],
  [-24, 68],
  [-31, 64],
  [-38, 60],
]);

const baffinFreshwater = smoothLinePath([
  [-69, 76],
  [-65, 72],
  [-61, 67],
  [-58, 62],
  [-56, 56],
  [-54, 51],
]);

const osnapWest = linePath([
  [-56.5, 52.5],
  [-53, 54.2],
  [-50, 56.1],
  [-47, 58.2],
  [-44.5, 59.7],
]);

const osnapEast = multiLinePath([
  [
    [-42, 60],
    [-35, 59.2],
    [-28, 58.9],
    [-22.3, 59.2],
  ],
  [
    [-18.5, 59.1],
    [-13, 58.4],
    [-8, 57.8],
    [-5, 57.5],
  ],
]);

const freshwaterNodes: Coordinate[] = [
  [-18, 75],
  [-25, 69],
  [-36, 63],
  [-62, 68],
  [-57, 59],
];

const transformationZones: Array<{ name: string; coordinate: Coordinate }> = [
  { name: "LABRADOR", coordinate: [-53, 57] },
  { name: "IRMINGER", coordinate: [-34, 61.5] },
];

const labels: Array<{ name: string; coordinate: Coordinate; kind?: string }> = [
  { name: "CANADA", coordinate: [-64, 56], kind: "land-label" },
  { name: "GREENLAND", coordinate: [-41, 72], kind: "land-label" },
  { name: "ICELAND", coordinate: [-18.8, 65], kind: "land-label" },
  { name: "LABRADOR SEA", coordinate: [-55, 58] },
  { name: "IRMINGER SEA", coordinate: [-34, 63] },
  { name: "NORDIC SEAS", coordinate: [-3, 71] },
  { name: "NORTH ATLANTIC", coordinate: [-28, 45] },
];

const layerDescription: Record<MapLayer, string> = {
  circulation:
    "A geographic map of the subpolar North Atlantic with schematic warm surface currents, cold deep currents, coastal currents, and water-mass transformation zones.",
  freshwater:
    "A geographic map showing two conceptual freshwater pathways from the Arctic along East Greenland and through Baffin Bay into the Labrador Sea.",
  evidence:
    "A geographic map showing the OSNAP West and East reference transects, an observed OISST point, and the aggregate footprint of a bounded Argo validation sample.",
};

export function NorthAtlanticMap({ layer, observations }: NorthAtlanticMapProps) {
  const argo = observations?.argo;
  const argoFootprint = argo
    ? path({
      type: "Polygon",
      coordinates: [[
        [argo.bounds.longitudeMin, argo.bounds.latitudeMin],
        [argo.bounds.longitudeMax, argo.bounds.latitudeMin],
        [argo.bounds.longitudeMax, argo.bounds.latitudeMax],
        [argo.bounds.longitudeMin, argo.bounds.latitudeMax],
        [argo.bounds.longitudeMin, argo.bounds.latitudeMin],
      ]],
    } as GeoPermissibleObjects) ?? ""
    : "";
  const argoLabel = argo
    ? locate([
      (argo.bounds.longitudeMin + argo.bounds.longitudeMax) / 2,
      argo.bounds.latitudeMax,
    ])
    : null;
  const oisst = observations?.oisst;
  const oisstPoint = oisst ? locate([oisst.longitude, oisst.latitude]) : null;

  return (
    <div className="geo-map-shell">
      <div className="geo-map-meta" aria-hidden="true">
        <span>SUBPOLAR NORTH ATLANTIC</span>
        <span>40–80° N · 72° W–16° E</span>
      </div>
      <span className="geo-map-badge" aria-hidden="true">GEOGRAPHIC VIEW</span>

      <svg
        className="geo-map-canvas"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby="north-atlantic-map-title north-atlantic-map-description"
      >
        <title id="north-atlantic-map-title">Subpolar North Atlantic — {layer}</title>
        <desc id="north-atlantic-map-description">{layerDescription[layer]}</desc>
        <defs>
          <linearGradient id="ocean-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#246f91" />
            <stop offset="1" stopColor="#174c70" />
          </linearGradient>
          <radialGradient id="freshwater-field">
            <stop offset="0" stopColor="#78cbd7" stopOpacity="0.44" />
            <stop offset="1" stopColor="#78cbd7" stopOpacity="0" />
          </radialGradient>
          <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="warm-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f0a762" />
          </marker>
          <marker id="cold-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#79b9d1" />
          </marker>
          <marker id="fresh-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#78cbd7" />
          </marker>
          <marker id="coastal-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#b9c54a" />
          </marker>
          <clipPath id="map-viewport"><rect x="12" y="22" width="776" height="506" rx="18" /></clipPath>
        </defs>

        <rect className="ocean-field" x="12" y="22" width="776" height="506" rx="18" fill="url(#ocean-depth)" />
        <g clipPath="url(#map-viewport)">
          <path className="geo-graticule" d={path(graticule) ?? ""} />
          <path className="geo-land" d={path(land as GeoPermissibleObjects) ?? ""} />
          <path className="geo-borders" d={path(borders) ?? ""} />

          <g className="map-layer circulation-layer" aria-hidden={layer !== "circulation"}>
            <path className="flow flow-warm" d={warmUpperLimb} markerEnd="url(#warm-arrow)" />
            <path className="flow flow-warm branch" d={subpolarWarmLoop} markerEnd="url(#warm-arrow)" />
            <path className="flow flow-warm branch" d={easternWarmBranch} markerEnd="url(#warm-arrow)" />
            <path className="flow flow-cold" d={deepReturn} markerEnd="url(#cold-arrow)" />
            <path className="flow flow-cold branch" d={easternDeepBranch} markerEnd="url(#cold-arrow)" />
            <path className="flow flow-coastal" d={eastGreenlandCoastal} markerEnd="url(#coastal-arrow)" />
            <path className="flow flow-coastal" d={labradorCoastal} markerEnd="url(#coastal-arrow)" />
            {transformationZones.map(({ name, coordinate }) => {
              const [x, y] = locate(coordinate);
              return <g className="transformation-zone" key={name}>
                <circle cx={x} cy={y} r="13" />
                <circle className="transformation-core" cx={x} cy={y} r="5" />
              </g>;
            })}
            {(() => {
              const [warmX, warmY] = locate([-27, 54]);
              const [coldX, coldY] = locate([-50, 48]);
              return <>
                <text className="flow-label warm-label" x={warmX + 10} y={warmY - 13}>WARM SURFACE FLOW</text>
                <text className="flow-label cold-label" x={coldX + 12} y={coldY + 9}>COLD DEEP RETURN</text>
              </>;
            })()}
          </g>

          <g className="map-layer freshwater-layer" aria-hidden={layer !== "freshwater"}>
            {freshwaterNodes.map((coordinate) => {
              const [x, y] = locate(coordinate);
              return <circle key={coordinate.join(",")} className="freshwater-field" cx={x} cy={y} r="50" fill="url(#freshwater-field)" />;
            })}
            <path className="freshwater-route" d={eastGreenlandFreshwater} markerEnd="url(#fresh-arrow)" />
            <path className="freshwater-route" d={baffinFreshwater} markerEnd="url(#fresh-arrow)" />
            {(() => {
              const [eastX, eastY] = locate([-23, 70]);
              const [westX, westY] = locate([-61, 65]);
              return <>
                <text className="flow-label freshwater-label" x={eastX + 10} y={eastY - 8}>EAST GREENLAND EXPORT</text>
                <text className="flow-label freshwater-label" x={westX - 20} y={westY - 9}>BAFFIN–LABRADOR PATH</text>
              </>;
            })()}
          </g>

          <g className="map-layer evidence-layer" aria-hidden={layer !== "evidence"}>
            {argo && <path className="argo-footprint" d={argoFootprint} />}
            <path className="array-transect" d={osnapWest} />
            <path className="array-transect" d={osnapEast} />
            {oisst && oisstPoint && <g className="oisst-observation">
              <circle className="oisst-halo" cx={oisstPoint[0]} cy={oisstPoint[1]} r="14" />
              <circle className="oisst-point" cx={oisstPoint[0]} cy={oisstPoint[1]} r="5" />
              <text className="oisst-label" x={oisstPoint[0] + 11} y={oisstPoint[1] - 10}>
                OISST · {oisst.month.toUpperCase()} · {oisst.value.toFixed(2)}°C{oisst.aligned ? "" : " · NEAREST"}
              </text>
            </g>}
            {argo && argoLabel && <text className="argo-label" x={argoLabel[0]} y={argoLabel[1] - 9} textAnchor="middle">
              ARGO FOOTPRINT · {argo.month.toUpperCase()} · {argo.profileCount} PROFILES{argo.aligned ? "" : " · NEAREST"}
            </text>}
            {(() => {
              const [westX, westY] = locate([-50, 56]);
              const [eastX, eastY] = locate([-28, 59]);
              return <>
                <text className="array-label" x={westX - 52} y={westY + 35}>OSNAP WEST</text>
                <text className="array-label" x={eastX + 5} y={eastY - 13}>OSNAP EAST</text>
              </>;
            })()}
          </g>

          {labels.map(({ name, coordinate, kind }) => {
            const [x, y] = locate(coordinate);
            return <text key={name} className={`place-label ${kind ?? "ocean-name"}`} x={x} y={y}>{name}</text>;
          })}
        </g>

        <text className="axis-label" x="22" y="552">COASTLINE · NATURAL EARTH 1:50m</text>
        <text className="axis-label axis-label-right" x="778" y="552">AZIMUTHAL EQUAL-AREA PROJECTION</text>
      </svg>
    </div>
  );
}
