"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  NorthAtlanticMap,
  type MapLayer,
  type MapObservations,
} from "./components/NorthAtlanticMap";

type FamilyAssessment = {
  family: string;
  available: boolean;
  score: number;
  coverage: number;
  latestZ: number | null;
};

type Assessment = {
  asOf: string;
  knowledgeDate: string;
  modelVersion: string;
  datasetMode: string;
  regime: string;
  evidence: number;
  transitionRisk: number | null;
  dataCoherence?: number;
  confidence?: number;
  operationalEligible?: boolean;
  caveat?: string;
  families: FamilyAssessment[];
};

type Validation = {
  status: string;
  productionEligible: boolean;
  brier: number | null;
};

type SourceEntry = {
  id: string;
  name?: string;
  family: string;
  tier: string;
  cadence: string;
  latency: string;
  revision?: string;
  adapter: string;
  url?: string;
};

type ObservedMetric = {
  mean: number | null;
  uncertainty: number | null;
  count: number;
};

type ArgoMonth = {
  month: string;
  profile_count: number;
  provisional_fraction: number;
  thermodynamic_methods: string[];
  surface_density: ObservedMetric;
  stratification_0_200m: ObservedMetric;
  freshwater_0_1000m: ObservedMetric;
  mixed_layer_depth: ObservedMetric;
  coverage: {
    deep_profile_fraction: number;
    latitude_min: number;
    latitude_max: number;
    longitude_min: number;
    longitude_max: number;
  };
};

type OisstObservation = {
  date: string;
  value: number;
  units: string;
  quality: string;
  revision: string;
  provisional: boolean;
  anomaly: number;
  baseline: string;
};

type ObservationalBeta = {
  argo?: {
    accepted_profiles?: number;
    rejected_profile_count?: number;
    dataset_mode?: string;
    caveat?: string;
    months?: ArgoMonth[];
  };
  oisst?: {
    generated_at?: string;
    dataset_mode?: string;
    caveat?: string;
    region?: { points?: Array<{ latitude: number; longitude: number }> };
    observations?: OisstObservation[];
  };
};

type SnapshotPayload = {
  assessment: Assessment;
  validation: Validation;
  observationalBeta?: ObservationalBeta;
  sources: SourceEntry[];
};

type HistoryEntry = {
  id: string;
  environmentalDate: string;
  knowledgeDate: string;
  modelVersion: string;
  publishedAt: string | null;
  payload: SnapshotPayload;
};

type AssessmentResponse = SnapshotPayload & {
  dataState: { storage: string; message: string; snapshotCount: number };
  history: HistoryEntry[];
  pipelineStatus: Array<{
    runKey: string;
    environmentalMonth: string;
    knowledgeDate: string;
    pipelineVersion: string;
    status: string;
    completedAt: string | null;
    featureCount: number;
    sourceCount: number;
  }>;
};

const layerCopy: Record<MapLayer, { title: string; body: string; label: string }> = {
  circulation: { title: "A circulation, not a conveyor belt", body: "The North Atlantic Current carries warm water northeast. Boundary currents and transformed deep waters complete a variable, three-dimensional system.", label: "Simplified circulation" },
  freshwater: { title: "Freshwater changes the balance", body: "Two important export routes follow East Greenland and Baffin Bay toward the subpolar seas. They are pathways—not measured anomaly fields.", label: "Conceptual pathways" },
  evidence: { title: "Where this prototype observes", body: "OSNAP is shown as two real transects. The OISST point and Argo rectangle are small validation samples, not basin-wide coverage.", label: "Connected observations" },
};

const mapLayers: MapLayer[] = ["circulation", "freshwater", "evidence"];

const mapLegend: Record<MapLayer, Array<{ tone: string; label: string }>> = {
  circulation: [
    { tone: "key-warm", label: "Warm upper-ocean branches" },
    { tone: "key-cold", label: "Cold boundary currents" },
    { tone: "key-deep", label: "Conceptual deep lower limb" },
    { tone: "key-sinking", label: "Transformation regions" },
  ],
  freshwater: [
    { tone: "key-fresh", label: "Conceptual freshwater routes" },
  ],
  evidence: [
    { tone: "key-array", label: "OSNAP West + East" },
    { tone: "key-argo", label: "Argo sample extent" },
    { tone: "key-oisst", label: "OISST observed point" },
  ],
};

const familyPresentation: Record<string, { name: string; role: string; explainer: string }> = {
  overturning: {
    name: "Overturning",
    role: "Direct arrays and transport estimates",
    explainer: "How much water moves north near the surface and returns south at depth.",
  },
  density: {
    name: "Density structure",
    role: "Temperature and salinity profiles",
    explainer: "Whether temperature and salinity make surface water dense enough to sink.",
  },
  convection: {
    name: "Deep convection",
    role: "Mixed-layer and water-mass proxies",
    explainer: "How deeply winter cooling and mixing reach into the ocean.",
  },
  freshwater: {
    name: "Freshwater pressure",
    role: "Salinity, ice, runoff, and forcing",
    explainer: "Freshening that can make surface water lighter and resist sinking.",
  },
  thermalPattern: {
    name: "Thermal pattern",
    role: "Spatial sea-surface temperature field",
    explainer: "The shape and persistence of North Atlantic surface-temperature anomalies.",
  },
};

const familyMethod: Record<string, { method: string; watchFor: string; sourceIds: string[] }> = {
  overturning: {
    method: "Standardize transport and overturning estimates against their seasonal baselines, then test whether departures persist across releases.",
    watchFor: "Persistent transport changes that agree across direct arrays—not one unusually strong or weak month.",
    sourceIds: ["osnap", "rapid"],
  },
  density: {
    method: "Combine temperature and salinity profiles into density and upper-ocean stratification features using TEOS-10 calculations.",
    watchFor: "Lighter surface water or stronger stratification that repeatedly reduces the conditions favorable for sinking.",
    sourceIds: ["argo", "en4"],
  },
  convection: {
    method: "Track mixed-layer depth and water-mass transformation proxies in the Labrador, Irminger, and Nordic Seas.",
    watchFor: "Persistently shallow winter mixing across regions, while accounting for atmospheric forcing and sampling gaps.",
    sourceIds: ["argo", "copernicus-phy"],
  },
  freshwater: {
    method: "Compare salinity, ice, runoff, mass-change, and atmospheric forcing indicators without assuming one freshwater pathway dominates.",
    watchFor: "Coherent freshening that reaches water-mass formation regions and persists beyond short-lived weather variability.",
    sourceIds: ["argo", "era5", "nsidc-sic", "grace-fo"],
  },
  thermalPattern: {
    method: "Measure the spatial shape and persistence of sea-surface temperature departures, with seasonal baselines kept explicit.",
    watchFor: "A durable subpolar pattern that agrees with subsurface and circulation evidence—not an isolated cold or warm point.",
    sourceIds: ["oisst"],
  },
};

type TimedSample<T> = { sample: T; aligned: boolean };

function selectTimedSample<T>(items: T[] | undefined, dateOf: (item: T) => string, targetMonth: string): TimedSample<T> | null {
  if (!items?.length) return null;
  const ordered = [...items].sort((left, right) => dateOf(left).localeCompare(dateOf(right)));
  const exact = ordered.find((item) => dateOf(item).slice(0, 7) === targetMonth);
  if (exact) return { sample: exact, aligned: true };
  const prior = ordered.filter((item) => dateOf(item).slice(0, 7) < targetMonth).at(-1);
  return { sample: prior ?? ordered[0], aligned: false };
}

function formatObservedMetric(metric: ObservedMetric | undefined, digits: number, units: string) {
  if (!metric || metric.mean === null) return "Not resolved";
  const uncertainty = metric.uncertainty === null ? "" : ` ± ${metric.uncertainty.toFixed(digits)}`;
  return `${metric.mean.toFixed(digits)}${uncertainty} ${units}`;
}

function SignalTrend({ values }: { values: Array<{ date: string; value: number | null }> }) {
  const observed = values.filter((item): item is { date: string; value: number } => item.value !== null && Number.isFinite(item.value));
  const width = 560;
  const height = 132;
  const margin = 16;
  const maxAbs = Math.max(1, ...observed.map((item) => Math.abs(item.value)));
  const xFor = (index: number) => observed.length <= 1 ? width / 2 : margin + (index / (observed.length - 1)) * (width - margin * 2);
  const yFor = (value: number) => height / 2 - (value / maxAbs) * (height / 2 - margin);
  const points = observed.map((item, index) => `${xFor(index)},${yFor(item.value)}`).join(" ");

  return <svg className="signal-trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Signed anomaly through the available versioned assessment history">
    <line x1={margin} y1={height / 2} x2={width - margin} y2={height / 2} />
    {observed.length > 1 && <polyline points={points} />}
    {observed.map((item, index) => <circle key={`${item.date}-${index}`} cx={xFor(index)} cy={yFor(item.value)} r={index === observed.length - 1 ? 4.5 : 3} />)}
  </svg>;
}

function formatMonth(value?: string) {
  if (!value) return "—";
  const dateValue = value.length >= 10 ? value.slice(0, 10) : `${value.slice(0, 7)}-01`;
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${dateValue}T00:00:00Z`))
    .toUpperCase();
}

function formatKnowledgeDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(value));
}

function familyState(score: number, available: boolean) {
  if (!available) return { label: "Unavailable", tone: "muted" };
  if (score < 0.24) return { label: "Within range", tone: "stable" };
  if (score < 0.45) return { label: "Unusual", tone: "watch" };
  if (score < 0.68) return { label: "Persistent anomaly", tone: "warn" };
  return { label: "Research shift signal", tone: "warn" };
}

function tierLabel(tier: string) {
  if (tier === "direct") return "Direct";
  if (tier === "reanalysis") return "Reanalysis";
  return "Observed";
}

export default function Home() {
  const [layer, setLayer] = useState<MapLayer>("circulation");
  const [selectedSnapshot, setSelectedSnapshot] = useState(0);
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("All");
  const [data, setData] = useState<AssessmentResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const copy = layerCopy[layer];

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/assessment", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Assessment request failed (${response.status})`);
        return response.json() as Promise<AssessmentResponse>;
      })
      .then((payload) => {
        setData(payload);
        setSelectedSnapshot(Math.max(0, payload.history.length - 1));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "Assessment unavailable");
      });
    return () => controller.abort();
  }, []);

  const stopPlayback = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
  }, []);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const history = data?.history ?? [];
  const snapshot = history[selectedSnapshot];
  const payload = snapshot?.payload ?? data;
  const assessment = payload?.assessment ?? null;
  const validation = payload?.validation ?? null;
  const sources = payload?.sources ?? [];
  const observationalBeta = payload?.observationalBeta ?? data?.observationalBeta;
  const operational = Boolean(assessment?.operationalEligible && validation?.productionEligible);
  const targetMonth = (snapshot?.environmentalDate ?? assessment?.asOf ?? "").slice(0, 7);
  const selectedArgo = selectTimedSample(observationalBeta?.argo?.months, (item) => item.month, targetMonth);
  const selectedOisst = selectTimedSample(observationalBeta?.oisst?.observations, (item) => item.date, targetMonth);
  const oisstPoint = observationalBeta?.oisst?.region?.points?.[0];
  const mapObservations: MapObservations = {
    targetMonth,
    ...(selectedArgo ? {
      argo: {
        month: selectedArgo.sample.month,
        profileCount: selectedArgo.sample.profile_count,
        aligned: selectedArgo.aligned,
        bounds: {
          latitudeMin: selectedArgo.sample.coverage.latitude_min,
          latitudeMax: selectedArgo.sample.coverage.latitude_max,
          longitudeMin: selectedArgo.sample.coverage.longitude_min,
          longitudeMax: selectedArgo.sample.coverage.longitude_max,
        },
      },
    } : {}),
    ...(selectedOisst && oisstPoint ? {
      oisst: {
        month: selectedOisst.sample.date,
        value: selectedOisst.sample.value,
        units: selectedOisst.sample.units,
        aligned: selectedOisst.aligned,
        latitude: oisstPoint.latitude,
        longitude: oisstPoint.longitude,
      },
    } : {}),
  };

  const visibleSources = sources.filter((source) => sourceFilter === "All" || tierLabel(source.tier) === sourceFilter);
  const snapshotLabel = snapshot ? formatMonth(snapshot.environmentalDate) : "LOADING";
  const statusLabel = !data
    ? (loadError ? "ASSESSMENT UNAVAILABLE" : "LOADING ASSESSMENT")
    : operational
      ? "OPERATIONAL SNAPSHOT"
      : data.dataState.storage === "supabase" ? "RESEARCH SNAPSHOT" : "LOCAL RESEARCH FIXTURE";
  const latestPipelineRun = data?.pipelineStatus?.[0];
  const activeFamily = assessment?.families.find((family) => family.family === selectedFamily) ?? null;
  const activePresentation = selectedFamily ? familyPresentation[selectedFamily] : null;
  const activeMethod = selectedFamily ? familyMethod[selectedFamily] : null;
  const activeSources = activeMethod ? sources.filter((source) => activeMethod.sourceIds.includes(source.id)) : [];
  const activeHistory = selectedFamily ? history.map((item) => ({
    date: item.environmentalDate,
    value: item.payload.assessment.families.find((family) => family.family === selectedFamily)?.latestZ ?? null,
  })) : [];

  const observedReadings = (() => {
    if (!selectedFamily) return [];
    const argoMonth = selectedArgo?.sample;
    const oisst = selectedOisst?.sample;
    if (selectedFamily === "density") return [
      { label: "Surface density", value: formatObservedMetric(argoMonth?.surface_density, 2, "kg m⁻³") },
      { label: "0–200 m stratification", value: formatObservedMetric(argoMonth?.stratification_0_200m, 2, "kg m⁻³") },
    ];
    if (selectedFamily === "convection") return [
      { label: "Mixed-layer depth", value: formatObservedMetric(argoMonth?.mixed_layer_depth, 1, "dbar") },
      { label: "Deep-profile fraction", value: argoMonth ? `${Math.round(argoMonth.coverage.deep_profile_fraction * 100)}%` : "Not connected" },
    ];
    if (selectedFamily === "freshwater") return [
      { label: "0–1000 m freshwater", value: formatObservedMetric(argoMonth?.freshwater_0_1000m, 2, "m equivalent") },
      { label: "Profiles meeting depth need", value: argoMonth ? String(argoMonth.freshwater_0_1000m.count) : "Not connected" },
    ];
    if (selectedFamily === "thermalPattern") return [
      { label: "Observed SST point", value: oisst ? `${oisst.value.toFixed(2)} °C` : "Not connected" },
      { label: "Point location", value: oisstPoint ? `${oisstPoint.latitude.toFixed(0)}° N · ${Math.abs(oisstPoint.longitude).toFixed(0)}° W` : "Not connected" },
    ];
    return [
      { label: "Direct transport feed", value: "Planned" },
      { label: "Current headline input", value: "Versioned research fixture" },
    ];
  })();

  function togglePlayback() {
    if (playing) {
      stopPlayback();
      return;
    }
    if (history.length <= 1) return;
    if (selectedSnapshot >= history.length - 1) setSelectedSnapshot(0);
    setPlaying(true);
    timerRef.current = window.setInterval(() => {
      setSelectedSnapshot((current) => {
        if (current >= history.length - 1) {
          stopPlayback();
          return current;
        }
        return current + 1;
      });
    }, 900);
  }

  function inspectFamily(family: string) {
    setSelectedFamily(family);
    window.setTimeout(() => document.getElementById("signal-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 0);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AMOC Watch home"><span className="brand-mark" /> AMOC WATCH</a>
        <nav aria-label="Main navigation">
          <a href="#observe">Observe</a><a href="#evidence">Evidence</a><a href="#learn">Learn</a><a href="#sources">Sources</a>
        </nav>
        <div className="update" title={loadError ?? data?.dataState.message}><span className={`pulse ${operational ? "" : "research"}`} /> {statusLabel} · {snapshotLabel}</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">North Atlantic observatory · Research alpha</p>
          <h1>The circulation shaping our climate is <em>under threat.</em></h1>
          <p className="lede">AMOC Watch follows the signals beneath the surface—tracking whether natural variability is becoming structural change.</p>
          <a className="text-link" href="#observe">Explore the latest evidence <span>↓</span></a>
        </div>

        <div className={`map map-${layer}`}>
          <NorthAtlanticMap layer={layer} observations={mapObservations} />
          <div className="map-caption">
            <span className="caption-index">{String(mapLayers.indexOf(layer) + 1).padStart(2, "0")} / 03 · {copy.label}</span>
            <h2>{copy.title}</h2>
            <p>{copy.body}</p>
          </div>
          <div className="map-key" aria-hidden="true">
            {mapLegend[layer].map((item) => <span key={item.label}><i className={item.tone} /> {item.label}</span>)}
          </div>
          <p className="map-caveat">{layer === "evidence" ? "Reference transects · Bounded observed samples · Month labels show alignment" : "Geographic coastlines · Schematic flow paths · Not a velocity field"}</p>
        </div>

        <div className="layer-tabs" aria-label="Map layers">
          {mapLayers.map((item, index) => <button key={item} onClick={() => setLayer(item)} className={layer === item ? "active" : ""} aria-pressed={layer === item}><b>0{index + 1}</b>{item === "evidence" ? "observations" : item}</button>)}
        </div>
      </section>

      <section className="learn" id="learn">
        <div className="learn-intro">
          <p className="eyebrow">The system, in three movements</p>
          <h2>How the Atlantic overturns</h2>
          <p>AMOC is not a single current or conveyor belt. It is a shifting, three-dimensional circulation shaped by winds, heat, freshwater, and the density of seawater.</p>
        </div>
        <div className="movement-grid">
          <article><span>01</span><div className="movement-orbit warm-orbit"><i/></div><h3>Move heat north</h3><p>Warm, salty upper-ocean water carries heat toward the subpolar Atlantic.</p></article>
          <article><span>02</span><div className="movement-orbit sink-orbit"><i/></div><h3>Transform water</h3><p>Cooling, mixing, and salt content change density. Dense water can sink into the ocean interior.</p></article>
          <article><span>03</span><div className="movement-orbit cold-orbit"><i/></div><h3>Return at depth</h3><p>Cold, dense waters flow south, completing an overturning circulation spanning the Atlantic.</p></article>
        </div>
        <aside className="threat-note"><b>Where the threat enters</b><p>Ocean warming and additional freshwater can make surface waters lighter. But the response depends on where, when, and how those changes interact with wind and circulation.</p><span>Freshwater is one hypothesis among several—not an assumed answer.</span></aside>
      </section>

      <section className="observe" id="observe">
        <div className="section-heading">
          <div><p className="eyebrow">Versioned evidence</p><h2>What the system is showing</h2></div>
          <p>Every displayed signal belongs to a specific environmental month, knowledge date, model version, and source revision.</p>
        </div>

        <div className="research-disclosure" role="status" aria-live="polite">
          <div><b>{operational ? "Operational assessment" : "Research output—not an AMOC alarm"}</b><span>{operational ? "All publication gates passed." : "Transition probability is withheld until observational and model hindcasts pass calibration."}</span></div>
          {latestPipelineRun && <small><i /> REAL-FEATURE PIPELINE · {formatMonth(latestPipelineRun.environmentalMonth)} · {latestPipelineRun.sourceCount} SOURCES · {latestPipelineRun.featureCount} FEATURES · QUARANTINED</small>}
        </div>

        <div className="timeline-card">
          <div className="timeline-top">
            <div><span className="small-label">ENVIRONMENTAL STATE</span><strong>{snapshotLabel}</strong></div>
            <div className="knowledge-date"><span>KNOWLEDGE STATE</span><b>{formatKnowledgeDate(snapshot?.knowledgeDate)}</b><small>MODEL v{snapshot?.modelVersion ?? "—"}</small></div>
          </div>
          <div className="timeline-controls">
            <button className="play" onClick={togglePlayback} aria-label={playing ? "Pause timeline" : "Play timeline"} disabled={history.length <= 1}>{playing ? "Ⅱ" : "▶"}</button>
            <input aria-label="Choose assessment snapshot" type="range" min="0" max={Math.max(0, history.length - 1)} value={selectedSnapshot} disabled={history.length <= 1} onChange={(event) => { stopPlayback(); setSelectedSnapshot(Number(event.target.value)); }}/>
          </div>
          <div className="snapshot-buttons" aria-label="Available assessment snapshots">
            {history.map((item, index) => <button key={item.id} className={selectedSnapshot === index ? "active" : ""} aria-pressed={selectedSnapshot === index} onClick={() => { stopPlayback(); setSelectedSnapshot(index); }}><b>{formatMonth(item.environmentalDate)}</b><span>{formatKnowledgeDate(item.knowledgeDate)} · v{item.modelVersion}</span></button>)}
            {!history.length && <span className="loading-state">{loadError ?? "Loading versioned assessments…"}</span>}
          </div>
        </div>

        <div className="signal-reading-guide" aria-label="How to read the signal cards">
          <span><b>σ anomaly</b> Signed distance from that variable&apos;s seasonal baseline.</span>
          <span><b>Evidence</b> Strength and persistence of unusual behavior.</span>
          <span><b>Coverage</b> Share of expected observations available.</span>
        </div>

        <div className="signal-grid" id="evidence">
          {(assessment?.families ?? []).map((family, index) => {
            const presentation = familyPresentation[family.family] ?? { name: family.family, role: "Model family", explainer: "A grouped physical signal used by the monitoring model." };
            const state = familyState(family.score, family.available);
            return <article className={`signal ${selectedFamily === family.family ? "selected" : ""}`} key={family.family}>
              <div className="signal-top"><span>{String(index + 1).padStart(2, "0")}</span><span className={`state ${state.tone}`}>{state.label}</span></div>
              <h3>{presentation.name}</h3>
              <p className="signal-explainer">{presentation.explainer}</p>
              <span className="signal-value-label">LATEST σ ANOMALY</span>
              <strong>{family.latestZ === null ? "—" : `${family.latestZ >= 0 ? "+" : ""}${family.latestZ.toFixed(2)}σ`}</strong>
              <div className="evidence-bar" role="img" aria-label={`${Math.round(family.score * 100)} percent family evidence`}><i style={{ width: `${family.score * 100}%` }}/></div>
              <div className="signal-metrics"><span><b>{Math.round(family.score * 100)}%</b> evidence</span><span><b>{Math.round(family.coverage * 100)}%</b> coverage</span></div>
              <p className="signal-source">{presentation.role}</p>
              <button className="signal-open" onClick={() => inspectFamily(family.family)} aria-expanded={selectedFamily === family.family} aria-controls="signal-detail">Inspect evidence <span aria-hidden="true">→</span></button>
            </article>;
          })}
          {!assessment && <article className="signal signal-loading"><h3>Assessment loading</h3><p>No model values are displayed until a versioned snapshot is available.</p></article>}
        </div>

        {selectedFamily && activeFamily && activePresentation && activeMethod && <section className="signal-detail" id="signal-detail" aria-labelledby="signal-detail-title">
          <div className="signal-detail-heading">
            <div>
              <p className="eyebrow">Signal detail · {formatMonth(snapshot?.environmentalDate)}</p>
              <h3 id="signal-detail-title">{activePresentation.name}</h3>
              <p>{activePresentation.explainer}</p>
            </div>
            <button className="signal-close" onClick={() => setSelectedFamily(null)} aria-label={`Close ${activePresentation.name} detail`}>Close ×</button>
          </div>
          <div className="signal-detail-grid">
            <article className="detail-trend">
              <span className="detail-label">VERSIONED σ HISTORY</span>
              <SignalTrend values={activeHistory} />
              <div className="trend-range"><span>{formatMonth(activeHistory[0]?.date)}</span><b>{activeFamily.latestZ === null ? "No current anomaly" : `${activeFamily.latestZ >= 0 ? "+" : ""}${activeFamily.latestZ.toFixed(2)}σ selected`}</b><span>{formatMonth(activeHistory.at(-1)?.date)}</span></div>
              <p>{activeMethod.watchFor}</p>
            </article>
            <article className="detail-observations">
              <span className="detail-label">CONNECTED OBSERVATION</span>
              <div className="observation-status">
                {selectedFamily === "thermalPattern" && selectedOisst ? `${selectedOisst.aligned ? "MATCHED" : "NEAREST"} · OISST ${formatMonth(selectedOisst.sample.date)}` : selectedFamily !== "overturning" && selectedArgo ? `${selectedArgo.aligned ? "MATCHED" : "NEAREST"} · ARGO ${formatMonth(selectedArgo.sample.month)}` : "NOT YET CONNECTED"}
              </div>
              <dl>
                {observedReadings.map((reading) => <div key={reading.label}><dt>{reading.label}</dt><dd>{reading.value}</dd></div>)}
              </dl>
              <p>{selectedFamily === "thermalPattern" ? observationalBeta?.oisst?.caveat : selectedFamily === "overturning" ? "Direct transport sources are listed, but their published values are not yet connected to this interface." : observationalBeta?.argo?.caveat}</p>
            </article>
            <article className="detail-method">
              <span className="detail-label">METHOD + FRESHNESS</span>
              <p>{activeMethod.method}</p>
              <dl className="detail-dates">
                <div><dt>Environmental state</dt><dd>{formatMonth(snapshot?.environmentalDate)}</dd></div>
                <div><dt>Knowledge state</dt><dd>{formatKnowledgeDate(snapshot?.knowledgeDate)}</dd></div>
                <div><dt>Model version</dt><dd>v{snapshot?.modelVersion ?? assessment.modelVersion}</dd></div>
              </dl>
              <ul className="detail-sources">
                {activeSources.map((source) => <li key={source.id}><span>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name ?? source.id}</a> : source.name ?? source.id}</span><small>{source.cadence} · {source.latency} · {source.revision ?? source.adapter}</small></li>)}
              </ul>
            </article>
          </div>
          <p className="detail-caveat">Connected observations are bounded pipeline-validation samples and are excluded from the headline regime assessment until coverage, hindcasts, and calibration gates pass.</p>
        </section>}
      </section>

      <section className="sources" id="sources">
        <div className="section-heading sources-heading">
          <div><p className="eyebrow">Evidence ledger</p><h2>Trace every signal</h2></div>
          <p>Fast preliminary fields and slower research releases retain separate identities, latencies, revisions, and roles.</p>
        </div>
        <div className="source-filters" aria-label="Filter sources">
          {["All", "Direct", "Observed", "Reanalysis"].map((filter) => <button key={filter} onClick={() => setSourceFilter(filter)} className={sourceFilter === filter ? "active" : ""} aria-pressed={sourceFilter === filter}>{filter}</button>)}
        </div>
        <div className="source-list">
          {visibleSources.map((source, index) => (
            <article className="source-row" key={source.id}>
              <span className="source-index">{String(index + 1).padStart(2, "0")}</span><i className={source.tier}/><h3>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name ?? source.id}</a> : (source.name ?? source.id)}</h3><p>{familyPresentation[source.family]?.role ?? source.family}</p><span className="source-type">{tierLabel(source.tier)}</span><span className="cadence">{source.cadence}</span><span className="source-latency">{source.latency}</span><span className="source-revision">{source.revision ?? source.adapter}</span>
            </article>
          ))}
        </div>
        <div className="knowledge-state"><span>ENVIRONMENTAL STATE</span><b>The ocean month represented</b><span>KNOWLEDGE STATE</span><b>What was actually available then</b><p>Revised inputs create a new version. Earlier knowledge states remain available rather than being silently overwritten.</p></div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark"/> AMOC WATCH</a><p>A calm view of a changing ocean.</p><span>Research alpha · {assessment?.datasetMode ?? "assessment loading"} · Method v{assessment?.modelVersion ?? "—"}</span></footer>
    </main>
  );
}
