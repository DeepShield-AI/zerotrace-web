// Datadog-aligned design tokens — extracted from captured CSS
// See docs/datadog-apm-deep-analysis.md and sidebar_exact_css.json

export const tokens = {
  // Sidebar
  sidebar: {
    bg: 'rgb(41, 46, 57)',
    text: 'rgba(255, 255, 255, 0.76)',
    textMuted: 'rgb(186, 189, 187)',
    width: 160,
    topBarH: 36,
  },
  // Main content area
  content: {
    bg: 'rgb(249, 250, 251)',
    text: 'rgba(28, 43, 52, 0.98)',
    textSecondary: 'rgba(28, 43, 52, 0.66)',
    textMuted: 'rgba(28, 43, 52, 0.4)',
  },
  // Brand
  brand: {
    primary: '#632CA6',
    success: '#2DB88D',
    warning: '#E2903C',
    error: '#E65C5C',
    info: '#4799EB',
  },
  // Typography
  typo: {
    font: 'NotoSans, "Lucida Grande", "Lucida Sans Unicode", sans-serif',
    size: { xs: 10, sm: 11, md: 13, lg: 16, xl: 20, xxl: 24 },
    weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  },
  // Borders
  border: {
    light: 'rgb(233, 236, 239)',
    normal: 'rgb(222, 226, 230)',
    focus: '#632CA6',
  },
  // Search
  search: {
    bg: 'rgba(255, 255, 255, 0.08)',
    text: 'rgba(255, 255, 255, 0.82)',
    radius: 4,
  },
  // Spacing
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 },
} as const;
