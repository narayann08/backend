/*
 * Every string on the landing page. Kept out of the section components so copy
 * revisions never touch layout, and so oxlint's react/only-export-components
 * rule stays satisfied.
 */

export const HERO = {
  eyebrow: 'Generation forecasting · 24–72h',
  title: 'Know what your plants will generate,',
  titleAccent: 'before the weather decides for you.',
  subtitle:
    'FluxCast turns weather and satellite data into 24–72 hour forecasts and clear grid decisions — so clean energy is used, not wasted.',
  primaryCta: 'Explore the live demo',
  secondaryCta: 'How it works',
  readout: [
    { id: 'horizon', label: 'Horizon', value: '72h' },
    { id: 'fleet', label: 'Fleet', value: '8 plants' },
    { id: 'sources', label: 'Sources', value: '2 feeds' },
  ],
};

export const PAIN_POINTS = {
  label: '01 / The problem',
  heading: 'Renewable growth has a forecasting problem.',
  lede: "As solar and wind scale up, so does the cost of not knowing what they'll produce next.",
  items: [
    {
      id: 'waste',
      title: 'Wasted clean energy',
      body: 'Unexpected over-generation is curtailed on the spot, because there is no time to react. Clean energy is generated, then thrown away.',
    },
    {
      id: 'backup',
      title: 'Expensive backup power',
      body: 'When forecasts fall short, operators fall back on costly, high-emission fossil generation to avoid shortfalls.',
    },
    {
      id: 'direction',
      title: 'Forecasts without direction',
      body: 'Most tools stop at predicting a number. They never say what to do about it — store, curtail, export, or wait.',
    },
  ],
};

export const FEATURES = {
  label: '02 / The product',
  heading: 'From raw data to a decision you can act on.',
  lede: 'Weather intelligence with a decision layer on top — not just a chart, a recommendation.',
  items: [
    {
      id: 'fusion',
      icon: 'Cloud',
      index: '01',
      title: 'Multi-source weather fusion',
      body: 'Open-Meteo, satellite and plant telemetry reconciled into one forecast per site, with conflicts between sources resolved automatically.',
    },
    {
      id: 'horizon',
      icon: 'TrendingUp',
      index: '02',
      title: 'Forecasts with confidence ranges',
      body: 'Every forecast carries an expected value and an honest uncertainty range — never a single misleadingly precise number.',
    },
    {
      id: 'recommendations',
      icon: 'CircleCheck',
      index: '03',
      title: 'Actionable recommendations',
      body: 'A specific recommended action — charge, discharge, curtail, export, or activate backup — against your storage, demand and cost constraints.',
    },
    {
      id: 'alerts',
      icon: 'BellRing',
      index: '04',
      title: 'Real-time risk alerts',
      body: 'Over-generation, shortfall and operational risk windows are flagged before they happen, not after.',
    },
  ],
};

export const HOW_IT_WORKS = {
  label: '03 / The loop',
  heading: 'Four steps, running continuously.',
  steps: [
    {
      id: 'connect',
      icon: 'Plug',
      title: 'Connect',
      body: 'Link your plant data and location. FluxCast starts pulling weather and satellite data automatically.',
    },
    {
      id: 'forecast',
      icon: 'TrendingUp',
      title: 'Forecast',
      body: 'A 24–72 hour generation forecast for each plant, with a clear confidence range.',
    },
    {
      id: 'decide',
      icon: 'CircleCheck',
      title: 'Decide',
      body: 'A recommended action based on your storage, demand and constraints.',
    },
    {
      id: 'act',
      icon: 'BellRing',
      title: 'Act',
      body: 'Risk windows surface in real time, so you act before they become costly.',
    },
  ],
};

export const USP = {
  label: '04 / Why FluxCast',
  heading: 'Not just a forecast — a forecasting partner.',
  items: [
    {
      id: 'located',
      icon: 'MapPin',
      graphic: 'forecast',
      title: 'Built around your plants',
      body: "Every forecast is specific to your plant's exact location and characteristics — not a generic regional estimate.",
    },
    {
      id: 'proactive',
      icon: 'BellRing',
      graphic: 'alert',
      title: 'Proactive, not reactive',
      body: 'FluxCast watches conditions continuously and raises risk before it costs you money. You never have to keep checking.',
    },
  ],
};

/*
 * Deliberately non-numeric except where the number is a real product fact.
 * Curtailment and backup reductions have no pilot data behind them yet, so
 * they are stated as directions rather than invented percentages.
 */
export const IMPACT = {
  label: '05 / Impact',
  heading: 'What FluxCast is built to change.',
  stats: [
    { id: 'horizon', value: '24–72', unit: 'hrs', label: 'Forecast horizon, per plant.' },
    { id: 'fleet', value: '08', unit: 'plants', label: 'Solar and wind sites in the live demo fleet.' },
    { id: 'curtailment', value: 'Less', unit: '', label: 'Clean energy curtailed and thrown away.' },
    { id: 'backup', value: 'Lower', unit: '', label: 'Reliance on costly fossil backup generation.' },
  ],
  disclaimer:
    'Directional goals based on industry benchmarks — to be validated during pilot deployments.',
};

export const DATA_SOURCES = {
  heading: 'Powered by',
  items: [
    { id: 'open-meteo', icon: 'CloudSun', label: 'Open-Meteo', note: 'Forecast + reanalysis' },
    { id: 'nasa-power', icon: 'Globe', label: 'NASA POWER', note: 'Satellite-derived irradiance' },
  ],
};

export const FINAL_CTA = {
  heading: "See your grid's next 72 hours",
  headingAccent: 'before they happen.',
  subheading: 'Walk through FluxCast with a live fleet of solar and wind plants.',
  cta: 'Explore the live demo',
};

export const FOOTER = {
  tagline: 'Generation forecasting and grid decisions for renewable operators.',
  columns: [
    {
      id: 'product',
      title: 'Product',
      links: [
        { label: 'The problem', href: '#problem' },
        { label: 'Features', href: '#features' },
        { label: 'How it works', href: '#how-it-works' },
        { label: 'Why FluxCast', href: '#why-fluxcast' },
      ],
    },
    {
      id: 'explore',
      title: 'Explore',
      links: [{ label: 'Live demo', to: '/auth' }],
    },
  ],
  attribution: 'Weather data via Open-Meteo and NASA POWER.',
};
