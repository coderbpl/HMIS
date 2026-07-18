const P = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />,
  users: <path d="M9 11a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-7 2-7 5v2h14v-2c0-3-3-5-7-5zm8-2a3 3 0 10-2-5.6M17 13c3 0 5 1.8 5 4.5V19h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  stetho: <path d="M5 3v6a5 5 0 0010 0V3M8 3H5m10 0h-3m3.5 13.5a3.5 3.5 0 107 0V12m0 0a2 2 0 10.01 0M10 14v2.5a5.5 5.5 0 0011 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  bed: <path d="M3 7v12m0-5h18v5M3 12h18m-9-5h7a2 2 0 012 2v3M6 9.5A1.5 1.5 0 107.5 8 1.5 1.5 0 006 9.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  cal: <path d="M7 2v3m10-3v3M3 8h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  pulse: <path d="M3 12h4l2-6 4 12 2-6h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  pill: <path d="M10.5 3.5a5 5 0 017 7l-7 7a5 5 0 01-7-7zM7 7l7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  flask: <path d="M9 3h6M10 3v5l-5.5 9A2 2 0 006.2 20h11.6a2 2 0 001.7-3L14 8V3M8 14h8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  doc: <path d="M6 2h8l4 4v16H6zm8 0v4h4M9 12h6M9 16h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  rupee: <path d="M6 3h12M6 8h12M6 3c6 0 8 2 8 5s-2 5-8 5l8 8" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  bell: <path d="M12 22a2 2 0 002-2h-4a2 2 0 002 2zm6-6V11a6 6 0 10-12 0v5l-2 2v1h16v-1z" />,
  search: <path d="M11 4a7 7 0 105.2 11.7L21 20l-1.4 1.4-4.8-4.3A7 7 0 0011 4z" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  back: <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  check: <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  clip: <path d="M9 4h6a1 1 0 011 1v1h2a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h2V5a1 1 0 011-1zm0 9l2 2 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  history: <path d="M12 8v4l3 2m6-2a9 9 0 11-3-6.7M21 3v4h-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
  scan: <path d="M4 8V5a1 1 0 011-1h3m8 0h3a1 1 0 011 1v3m0 8v3a1 1 0 01-1 1h-3m-8 0H5a1 1 0 01-1-1v-3m0-4h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
  out: <path d="M9 4H5a1 1 0 00-1 1v14a1 1 0 001 1h4m4-4l4-4-4-4m4 4H9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  heart: <path d="M12 21S4 14.5 4 8.8A4.8 4.8 0 0112 5a4.8 4.8 0 018 3.8C20 14.5 12 21 12 21z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  box: <path d="M3 7l9-4 9 4v10l-9 4-9-4zm0 0l9 4 9-4m-9 4v10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  chart: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  cross: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  arrow: <path d="M5 12h14m-6-7l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  warn: <path d="M12 3l10 18H2zm0 7v4m0 3v.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
};

export default function Icon({ name, size = 20, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={style} aria-hidden="true">
      {P[name] || P.doc}
    </svg>
  );
}
