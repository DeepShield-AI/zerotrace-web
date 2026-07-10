export default {
  stories: 'src/**/*.stories.{ts,tsx,js,jsx,mdx}',
  addons: {
    theme: {
      enabled: true,
      defaultState: 'dark',
    },
    width: {
      enabled: true,
      options: {
        xsmall: 375,
        small: 640,
        medium: 1024,
        large: 1440,
        xlarge: 1920,
      },
      defaultState: 1440,
    },
    rtl: { enabled: false },
    a11y: { enabled: true },
  },
  outDir: 'build',
};
