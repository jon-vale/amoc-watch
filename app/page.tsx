"use client";

import { useEffect, useMemo, useState } from "react";

const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const signals = [
  { name: "Overturning", value: "14.8 Sv", state: "Within range", tone: "stable", spark: "12,25 25,22 38,27 51,18 64,21 77,16 90,20 103,13" },
  { name: "Density structure", value: "−0.18 σθ", state: "Persistent anomaly", tone: "warn", spark: "12,15 25,17 38,14 51,19 64,21 77,25 90,28 103,31" },
  { name: "Deep convection", value: "−12%", state: "Unusual", tone: "watch", spark: "12,16 25,12 38,18 51,21 64,18 77,26 90,24 103,29" },
  { name: "Freshwater pressure", value: "+1.3σ", state: "Unusual", tone: "watch", spark: "12,30 25,27 38,29 51,20 64,23 77,18 90,14 103,11" },
];

const layerCopy: Record<string, { title: string; body: string; label: string }> = {
  circulation: { title: "A planetary heat engine", body: "Warm, salty water travels north near the surface. As it cools and grows denser, it sinks and returns south through the deep Atlantic.", label: "Circulation estimate" },
  freshwater: { title: "Freshwater changes the balance", body: "Melt, precipitation, runoff, and Arctic export can reduce surface density—making deep-water formation more difficult.", label: "Freshwater anomaly" },
  evidence: { title: "Many signals, one system", body: "Floats, moorings, satellites, and ocean reanalyses each reveal part of the circulation. The model looks for persistent, coherent change.", label: "Observation coverage" },
};

const sources = [
  { name: "OSNAP", type: "Direct", cadence: "Research release", role: "Subpolar overturning & transport", color: "coral" },
  { name: "Argo", type: "Observed", cadence: "Near real time", role: "Temperature & salinity profiles", color: "cyan" },
  { name: "Copernicus", type: "Modeled", cadence: "Monthly", role: "Three-dimensional ocean state", color: "lime" },
  { name: "ERA5", type: "Modeled", cadence: "Monthly", role: "Heat, wind & freshwater forcing", color: "lime" },
  { name: "NSIDC", type: "Observed", cadence: "Daily", role: "Arctic sea-ice concentration", color: "cyan" },
  { name: "GRACE-FO", type: "Observed", cadence: "Monthly", role: "Greenland ice-mass change", color: "cyan" },
];

export default function Home() {
  const [layer, setLayer] = useState("circulation");
  const [month, setMonth] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("All");
  const [assessment, setAssessment] = useState<{ regime: string; evidence: number; transitionRisk: number; confidence: number; modelVersion: string; datasetMode: string } | null>(null);
  const copy = layerCopy[layer];
  const date = useMemo(() => `${months[month]} 2026`, [month]);

  useEffect(() => {
    let active = true;
    fetch("/api/assessment").then((response) => response.json()).then((payload) => {
      if (active) setAssessment(payload.assessment);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function togglePlayback() {
    setPlaying((current) => {
      if (!current) {
        let next = month;
        const timer = window.setInterval(() => {
          next = (next + 1) % 12;
          setMonth(next);
          if (next === 11) {
            window.clearInterval(timer);
            setPlaying(false);
          }
        }, 550);
      }
      return !current;
    });
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="AMOC Watch home"><span className="brand-mark" /> AMOC WATCH</a>
        <nav aria-label="Main navigation">
          <a href="#observe">Observe</a><a href="#evidence">Evidence</a><a href="#learn">Learn</a><a href="#sources">Sources</a>
        </nav>
        <div className="update"><span className="pulse" /> MODEL VIEW · JUN 2026</div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">North Atlantic observatory · Prototype</p>
          <h1>The circulation shaping our climate is <em>under threat.</em></h1>
          <p className="lede">AMOC Watch follows the signals beneath the surface—tracking whether natural variability is becoming structural change.</p>
          <a className="text-link" href="#observe">Explore the latest evidence <span>↓</span></a>
        </div>

        <div className={`map map-${layer}`} role="img" aria-label={`Stylized map of the subpolar North Atlantic showing ${copy.label.toLowerCase()}`}>
          <div className="map-grid" />
          <div className="land canada"><span>CANADA</span></div>
          <div className="land greenland"><span>GREENLAND</span></div>
          <div className="land iceland"><span>ICELAND</span></div>
          <div className="land europe"><span>EUROPE</span></div>
          <div className="ocean-label labrador">LABRADOR<br />SEA</div>
          <div className="ocean-label irminger">IRMINGER<br />SEA</div>
          <div className="ocean-label nordic">NORDIC<br />SEAS</div>
          <div className="current warm c1"/><div className="current warm c2"/><div className="current cold c3"/><div className="current cold c4"/>
          <div className="observation o1"><i/><span>OSNAP WEST</span></div>
          <div className="observation o2"><i/><span>OSNAP EAST</span></div>
          <div className="freshwater f1"/><div className="freshwater f2"/><div className="freshwater f3"/>
          <div className="map-caption">
            <span className="caption-index">01 / 03</span>
            <h2>{copy.title}</h2>
            <p>{copy.body}</p>
          </div>
          <div className="map-key"><span><i className="key-warm"/> Surface flow</span><span><i className="key-cold"/> Deep return</span></div>
        </div>

        <div className="layer-tabs" aria-label="Map layers">
          {Object.keys(layerCopy).map((item, i) => <button key={item} onClick={() => setLayer(item)} className={layer === item ? "active" : ""}><b>0{i + 1}</b>{item}</button>)}
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
          <div><p className="eyebrow">Observed state</p><h2>What the system is showing</h2></div>
          <p>There is no single AMOC number. We follow several physical signals and ask whether they are moving together.</p>
        </div>

        <div className="timeline-card">
          <div className="timeline-top"><div><span className="small-label">ENVIRONMENTAL STATE</span><strong>{date}</strong></div><div className="provisional"><i/> PROVISIONAL MODEL ESTIMATE</div></div>
          <div className="timeline-controls">
            <button className="play" onClick={togglePlayback} aria-label={playing ? "Pause timeline" : "Play timeline"}>{playing ? "Ⅱ" : "▶"}</button>
            <input aria-label="Choose month" type="range" min="0" max="11" value={month} onChange={(e) => setMonth(Number(e.target.value))}/>
          </div>
          <div className="months">{months.map((m, i) => <button key={m} className={month === i ? "active" : ""} onClick={() => setMonth(i)}>{m}</button>)}</div>
        </div>

        <div className="signal-grid" id="evidence">
          {signals.map((signal, index) => (
            <article className="signal" key={signal.name}>
              <div className="signal-top"><span>0{index + 1}</span><span className={`state ${signal.tone}`}>{signal.state}</span></div>
              <h3>{signal.name}</h3><strong>{signal.value}</strong>
              <svg viewBox="0 0 115 40" aria-hidden="true"><polyline points={signal.spark}/><line x1="5" y1="32" x2="110" y2="32"/></svg>
              <p>{index === 0 ? "Direct arrays + reanalyses" : index === 1 ? "Argo + EN4 profiles" : index === 2 ? "Mixed-layer depth proxy" : "Salinity + surface forcing"}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="risk" id="about">
        <div className="risk-copy"><p className="eyebrow">Transition risk</p><h2>Change is not the same as collapse.</h2><p>Our model asks a narrower question: does the current configuration still resemble recent variability, or is it becoming a different and persistent state?</p><button onClick={() => setExpanded(!expanded)}>{expanded ? "Hide model framing" : "How the assessment works"} <span>{expanded ? "−" : "+"}</span></button></div>
        <div className="risk-panel">
          <div className="risk-header"><span>REGIME EVIDENCE</span><span>MONTHLY MODEL · v{assessment?.modelVersion ?? "0.1.0"}</span></div>
          <div className="risk-scale"><div className="scale-fill" style={{ right: `${100 - (assessment?.evidence ?? .66) * 100}%` }}/><i className="scale-marker" style={{ left: `calc(${(assessment?.evidence ?? .66) * 100}% - 11px)` }}/></div>
          <div className="scale-labels"><span>Recent range</span><span>Unusual</span><span>Persistent</span><span>Possible shift</span></div>
          <div className="risk-result"><span>Current assessment</span><strong>{assessment?.regime ?? "Persistent anomaly"}</strong></div>
          <div className="model-numbers"><span><b>{Math.round((assessment?.evidence ?? .66) * 100)}%</b> evidence index</span><span><b>{Math.round((assessment?.transitionRisk ?? .28) * 100)}%</b> 5-year diagnostic</span><span><b>{Math.round((assessment?.confidence ?? .72) * 100)}%</b> model confidence</span></div>
          <p className="risk-note">Several related signals remain outside their recent range. Evidence is not sufficient to infer a regime transition.</p>
          {expanded && <div className="method"><b>Evidence, not an alarm.</b> The prototype combines density structure, convection, freshwater pressure, spatial fingerprints, and transport estimates. Direct observations validate the model as new releases become available. Current feed: <code>{assessment?.datasetMode ?? "illustrative-fixture"}</code>.</div>}
        </div>
      </section>

      <section className="sources" id="sources">
        <div className="section-heading sources-heading">
          <div><p className="eyebrow">Evidence ledger</p><h2>Trace every signal</h2></div>
          <p>The operational map will combine fast environmental fields with slower direct observations. Each source keeps its identity, date, and scientific role.</p>
        </div>
        <div className="source-filters" aria-label="Filter sources">
          {["All", "Direct", "Observed", "Modeled"].map((filter) => <button key={filter} onClick={() => setSourceFilter(filter)} className={sourceFilter === filter ? "active" : ""}>{filter}</button>)}
        </div>
        <div className="source-list">
          {sources.filter((source) => sourceFilter === "All" || source.type === sourceFilter).map((source, index) => (
            <article className="source-row" key={source.name}>
              <span className="source-index">{String(index + 1).padStart(2, "0")}</span><i className={source.color}/><h3>{source.name}</h3><p>{source.role}</p><span className="source-type">{source.type}</span><span className="cadence">{source.cadence}</span>
            </article>
          ))}
        </div>
        <div className="knowledge-state"><span>ENVIRONMENTAL STATE</span><b>The ocean month being displayed</b><span>KNOWLEDGE STATE</span><b>What was actually known at that time</b><p>Keeping these dates separate allows honest historical reconstruction without hindsight leakage.</p></div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark"/> AMOC WATCH</a><p>A calm view of a changing ocean.</p><span>Prototype · Data shown are illustrative · Method v0.1</span></footer>
    </main>
  );
}
