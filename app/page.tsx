"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NorthAtlanticMap, type MapLayer } from "./components/NorthAtlanticMap";

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

type ObservationalBeta = {
  argo?: { accepted_profiles?: number; months?: Array<{ month: string }> };
  oisst?: { observations?: Array<{ value: number }> };
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
  circulation: { title: "A planetary heat engine", body: "Warm, salty water travels north near the surface. As it cools and grows denser, it sinks and returns south through the deep Atlantic.", label: "Circulation estimate" },
  freshwater: { title: "Freshwater changes the balance", body: "Melt, precipitation, runoff, and Arctic export can reduce surface density—making deep-water formation more difficult.", label: "Freshwater anomaly" },
  evidence: { title: "Many signals, one system", body: "Floats, moorings, satellites, and ocean reanalyses each reveal part of the circulation. The model looks for persistent, coherent change.", label: "Observation coverage" },
};

const mapLayers: MapLayer[] = ["circulation", "freshwater", "evidence"];

const mapLegend: Record<MapLayer, Array<{ tone: string; label: string }>> = {
  circulation: [
    { tone: "key-warm", label: "Warm upper limb" },
    { tone: "key-cold", label: "Deep return · schematic" },
  ],
  freshwater: [
    { tone: "key-fresh", label: "Freshwater pathway" },
    { tone: "key-field", label: "Pressure field" },
  ],
  evidence: [
    { tone: "key-array", label: "OSNAP transect" },
    { tone: "key-argo", label: "Argo sampling domain" },
  ],
};

const familyPresentation: Record<string, { name: string; role: string }> = {
  overturning: { name: "Overturning", role: "Direct arrays and transport estimates" },
  density: { name: "Density structure", role: "Temperature and salinity profiles" },
  convection: { name: "Deep convection", role: "Mixed-layer and water-mass proxies" },
  freshwater: { name: "Freshwater pressure", role: "Salinity, ice, runoff, and forcing" },
  thermalPattern: { name: "Thermal pattern", role: "Spatial sea-surface temperature field" },
};

function formatMonth(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
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
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
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
  const operational = Boolean(assessment?.operationalEligible && validation?.productionEligible);
  const evidence = assessment?.evidence ?? 0;
  const dataCoherence = assessment?.dataCoherence ?? assessment?.confidence ?? 0;

  const observedBeta = useMemo(() => {
    const argoMonth = payload?.observationalBeta?.argo?.months?.at(-1);
    const oisst = payload?.observationalBeta?.oisst?.observations ?? [];
    if (!payload?.observationalBeta) return null;
    return {
      argoProfiles: payload.observationalBeta.argo?.accepted_profiles ?? 0,
      argoMonth: argoMonth?.month ?? "—",
      oisstMonths: oisst.length,
      oisstLatest: oisst.at(-1)?.value ?? null,
    };
  }, [payload]);

  const visibleSources = sources.filter((source) => sourceFilter === "All" || tierLabel(source.tier) === sourceFilter);
  const snapshotLabel = snapshot ? formatMonth(snapshot.environmentalDate) : "LOADING";
  const statusLabel = !data
    ? (loadError ? "ASSESSMENT UNAVAILABLE" : "LOADING ASSESSMENT")
    : operational
      ? "OPERATIONAL SNAPSHOT"
      : data.dataState.storage === "supabase" ? "RESEARCH SNAPSHOT" : "LOCAL RESEARCH FIXTURE";
  const latestPipelineRun = data?.pipelineStatus?.[0];

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
          <NorthAtlanticMap layer={layer} />
          <div className="map-caption">
            <span className="caption-index">{String(mapLayers.indexOf(layer) + 1).padStart(2, "0")} / 03 · {copy.label}</span>
            <h2>{copy.title}</h2>
            <p>{copy.body}</p>
          </div>
          <div className="map-key" aria-hidden="true">
            {mapLegend[layer].map((item) => <span key={item.label}><i className={item.tone} /> {item.label}</span>)}
          </div>
          <p className="map-caveat">Geographic coastlines · Schematic flow paths · Not a velocity field</p>
        </div>

        <div className="layer-tabs" aria-label="Map layers">
          {mapLayers.map((item, index) => <button key={item} onClick={() => setLayer(item)} className={layer === item ? "active" : ""} aria-pressed={layer === item}><b>0{index + 1}</b>{item}</button>)}
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

        <div className="signal-grid" id="evidence">
          {(assessment?.families ?? []).map((family, index) => {
            const presentation = familyPresentation[family.family] ?? { name: family.family, role: "Model family" };
            const state = familyState(family.score, family.available);
            return <article className="signal" key={family.family}>
              <div className="signal-top"><span>{String(index + 1).padStart(2, "0")}</span><span className={`state ${state.tone}`}>{state.label}</span></div>
              <h3>{presentation.name}</h3><strong>{family.latestZ === null ? "—" : `${family.latestZ >= 0 ? "+" : ""}${family.latestZ.toFixed(2)}σ`}</strong>
              <div className="evidence-bar" role="img" aria-label={`${Math.round(family.score * 100)} percent family evidence`}><i style={{ width: `${family.score * 100}%` }}/></div>
              <p>{presentation.role} · {Math.round(family.coverage * 100)}% coverage</p>
            </article>;
          })}
          {!assessment && <article className="signal signal-loading"><h3>Assessment loading</h3><p>No model values are displayed until a versioned snapshot is available.</p></article>}
        </div>
      </section>

      <section className="risk" id="about">
        <div className="risk-copy"><p className="eyebrow">Research classification</p><h2>Change is not the same as collapse.</h2><p>The model asks a narrower question: does the current configuration still resemble recent variability, or is it becoming a different and persistent statistical state?</p><button onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Hide model framing" : "How the assessment works"} <span>{expanded ? "−" : "+"}</span></button></div>
        <div className="risk-panel">
          <div className="risk-header"><span>REGIME EVIDENCE</span><span>MONTHLY MODEL · v{assessment?.modelVersion ?? "—"}</span></div>
          <div className="risk-scale"><div className="scale-fill" style={{ right: `${100 - evidence * 100}%` }}/><i className="scale-marker" style={{ left: `calc(${evidence * 100}% - 11px)` }}/></div>
          <div className="scale-labels"><span>Recent range</span><span>Unusual</span><span>Persistent</span><span>Possible shift</span></div>
          <div className="risk-result"><span>{operational ? "Current assessment" : "Public assessment"}</span><strong>{operational ? assessment?.regime : "Research output only"}</strong></div>
          {!operational && assessment && <p className="research-classification">Illustrative classification: <b>{assessment.regime}</b></p>}
          <div className="model-numbers"><span><b>{assessment ? `${Math.round(evidence * 100)}%` : "—"}</b> evidence index</span><span><b>{operational && assessment?.transitionRisk !== null ? `${Math.round((assessment?.transitionRisk ?? 0) * 100)}%` : "WITHHELD"}</b> 5-year probability</span><span><b>{assessment ? `${Math.round(dataCoherence * 100)}%` : "—"}</b> coverage + agreement</span></div>
          <div className="validation-gate"><i className={operational ? "eligible" : "blocked"}/><span><b>{validation?.status ?? "validation pending"}</b> · Public operational claims {operational ? "enabled" : "blocked"}{validation?.brier != null ? ` · synthetic-test Brier ${validation.brier.toFixed(3)}` : ""}</span></div>
          {observedBeta && <div className="observed-beta"><div><span>REAL ARGO SAMPLE</span><b>{observedBeta.argoProfiles} profiles</b><small>{observedBeta.argoMonth} · validation only</small></div><div><span>REAL OISST SAMPLE</span><b>{observedBeta.oisstLatest === null ? "—" : `${observedBeta.oisstLatest.toFixed(2)}°C`}</b><small>{observedBeta.oisstMonths} observed months</small></div><p>Observed pipeline evidence · excluded from the research classification</p></div>}
          <p className="risk-note">{assessment?.caveat ?? "Waiting for a versioned assessment."}</p>
          {expanded && <div className="method"><b>Evidence, not an alarm.</b> The research model combines seasonal anomalies, persistence, coverage, and agreement across physical families. A probability is not published until its coefficients and event definition pass blocked observational and CMIP hindcasts. Current feed: <code>{assessment?.datasetMode ?? "unavailable"}</code>.</div>}
        </div>
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
