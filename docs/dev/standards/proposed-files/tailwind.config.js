/**
 * tailwind.config.js
 *
 * 规则：所有 color 值必须是 var(--...)。
 * 禁止直接写 hex。verify: grep -E "'#[0-9a-fA-F]{3,8}'" tailwind.config.js 应返回 0 行。
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // ── Colors: 全部 CSS 变量 ────────────────────────────────
      colors: {
        // Semantic backgrounds
        bg: {
          base:     'var(--bg-base)',
          subtle:   'var(--bg-subtle)',
          muted:    'var(--bg-muted)',
          elevated: 'var(--bg-elevated)',
          inverse:  'var(--bg-inverse)',
        },
        // Semantic foregrounds
        fg: {
          DEFAULT:   'var(--fg-primary)',
          primary:   'var(--fg-primary)',
          secondary: 'var(--fg-secondary)',
          tertiary:  'var(--fg-tertiary)',
          disabled:  'var(--fg-disabled)',
          inverse:   'var(--fg-inverse)',
        },
        // Borders — 覆盖 Tailwind 内置的 border
        border: {
          DEFAULT: 'var(--border-default)',
          subtle:  'var(--border-subtle)',
          strong:  'var(--border-strong)',
          focus:   'var(--border-focus)',
        },
        // Accents
        accent: {
          primary:   'var(--accent-primary)',
          brand:     'var(--accent-brand)',
          pink:      'var(--accent-pink)',
          success:   'var(--accent-success)',
          warning:   'var(--accent-warning)',
          danger:    'var(--accent-danger)',
          critical:  'var(--accent-critical)',
          info:      'var(--accent-info)',
          'success-bg': 'var(--accent-success-bg)',
          'warning-bg': 'var(--accent-warning-bg)',
          'danger-bg':  'var(--accent-danger-bg)',
          'info-bg':    'var(--accent-info-bg)',
        },
        // Severity (Monitor 组件专用)
        severity: {
          ok:        'var(--severity-ok)',
          warn:      'var(--severity-warn)',
          alert:     'var(--severity-alert)',
          critical:  'var(--severity-critical)',
          'no-data': 'var(--severity-no-data)',
          unknown:   'var(--severity-unknown)',
        },
        // Chart series（10 色，别再自己写颜色）
        chart: {
          1:  'var(--chart-1)',  2:  'var(--chart-2)',  3:  'var(--chart-3)',
          4:  'var(--chart-4)',  5:  'var(--chart-5)',  6:  'var(--chart-6)',
          7:  'var(--chart-7)',  8:  'var(--chart-8)',  9:  'var(--chart-9)',
          10: 'var(--chart-10)',
        },
        // Sidebar 组件 token
        sidebar: {
          bg:        'var(--sidebar-bg)',
          fg:        'var(--sidebar-fg)',
          'fg-muted': 'var(--sidebar-fg-muted)',
          'hover-bg': 'var(--sidebar-item-hover-bg)',
          'active-bg': 'var(--sidebar-item-active-bg)',
        },
        // Code block
        code: {
          bg:      'var(--code-bg)',
          fg:      'var(--code-fg)',
          border:  'var(--code-border)',
          keyword: 'var(--code-keyword)',
          string:  'var(--code-string)',
          func:    'var(--code-func)',
          comment: 'var(--code-comment)',
        },

        // ── Legacy 兼容层 ──────────────────────────────────
        // 迁移期间为不改动的现有组件保留旧名。
        // 每次接触一个用了 legacy 名的组件，就把它换成语义 token，然后从这里删。
        // 目标：这一块最终应清空。
        brand: {
          500: 'var(--color-purple-500)',
          600: 'var(--accent-brand)',
          700: 'var(--color-purple-700)',
        },
        status: {
          success: { DEFAULT: 'var(--accent-success)', soft: 'var(--accent-success-bg)' },
          warning: { DEFAULT: 'var(--accent-warning)', soft: 'var(--accent-warning-bg)' },
          danger:  { DEFAULT: 'var(--accent-danger)',  soft: 'var(--accent-danger-bg)'  },
          info:    { DEFAULT: 'var(--accent-info)',    soft: 'var(--accent-info-bg)'    },
        },
        surface: {
          DEFAULT: 'var(--bg-subtle)',
          card:    'var(--bg-elevated)',
        },
        ink: {
          DEFAULT:   'var(--fg-primary)',
          secondary: 'var(--fg-secondary)',
          muted:     'var(--fg-tertiary)',
        },
        edge: {
          DEFAULT: 'var(--border-default)',
          light:   'var(--border-subtle)',
          focus:   'var(--border-focus)',
        },
      },

      // ── Radius ────────────────────────────────────────────
      borderRadius: {
        none: 'var(--radius-none)',
        sm:   'var(--radius-sm)',
        md:   'var(--radius-md)',
        DEFAULT: 'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        full: 'var(--radius-full)',
      },

      // ── Shadow ────────────────────────────────────────────
      boxShadow: {
        none:     'var(--shadow-none)',
        sm:       'var(--shadow-sm)',
        DEFAULT:  'var(--shadow-md)',
        md:       'var(--shadow-md)',
        lg:       'var(--shadow-lg)',
        xl:       'var(--shadow-xl)',
        modal:    'var(--shadow-modal)',
        focus:    'var(--shadow-focus)',
        card:     'var(--shadow-sm)',
        elevated: 'var(--shadow-md)',
      },

      // ── Spacing (extend, 保留 Tailwind 默认阶梯) ─────────
      spacing: {
        sidebar:           'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
        topbar:            'var(--topbar-height)',
      },

      // ── Width (保留现有) ─────────────────────────────────
      width: {
        sidebar:           'var(--sidebar-width)',
        'sidebar-collapsed': 'var(--sidebar-width-collapsed)',
      },

      // ── 保留的其他 tokens（从现有 config 复制不动）──────
      fontFamily: {
        sans: ['Geist Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        h6: ['11px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.02em', textTransform: 'uppercase' }],
        h5: ['13px', { lineHeight: '20px', fontWeight: '600' }],
        h4: ['14px', { lineHeight: '22px', fontWeight: '600' }],
        h3: ['16px', { lineHeight: '24px', fontWeight: '600' }],
        h2: ['20px', { lineHeight: '28px', fontWeight: '600' }],
        h1: ['24px', { lineHeight: '32px', fontWeight: '700' }],
      },
      animation: {
        'fade-in':    'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up':   'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shimmer:      'shimmer 2s infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:   { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer:   { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
      },
      transitionTimingFunction: { spring: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      zIndex: { sidebar: '30', overlay: '40', panel: '50', modal: '60', toast: '70' },
      aspectRatio: { video: '16 / 9', square: '1 / 1' },
    },
  },
  plugins: [],
};
