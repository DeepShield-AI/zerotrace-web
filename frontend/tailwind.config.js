/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontSize: { h6:['11px',{lineHeight:'16px',fontWeight:'600',letterSpacing:'0.02em',textTransform:'uppercase'}], h5:['13px',{lineHeight:'20px',fontWeight:'600'}], h4:['14px',{lineHeight:'22px',fontWeight:'600'}], h3:['16px',{lineHeight:'24px',fontWeight:'600'}], h2:['20px',{lineHeight:'28px',fontWeight:'600'}], h1:['24px',{lineHeight:'32px',fontWeight:'700'}] },
      fontFamily: {
        sans: ['Geist Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: { 50:'#f5f0ff',100:'#ede5ff',200:'#dccfff',300:'#c4a8ff',400:'#a87fff',500:'#8b5cf6',600:'#632CA6',700:'#4c1d8a',800:'#39176b',900:'#28104e' },
        status: {
          success:{ DEFAULT:'#2DB88D',soft:'#E8F5E9',contrast:'#fff' },
          warning:{ DEFAULT:'#E2903C',soft:'#FFF8F3',contrast:'#fff' },
          danger:{ DEFAULT:'#E65C5C',soft:'#FFEBEE',contrast:'#fff' },
          info:{ DEFAULT:'#4799EB',soft:'#E3F2FD',contrast:'#fff' },
        },
        chart:{ blue:'#4799EB',purple:'#632CA6',green:'#2DB88D',orange:'#E2903C',red:'#E65C5C',teal:'#008597',axis:'#ADB5BD',grid:'#F1F3F5' },
        code:{ bg:'#1A1D24',text:'#C8CDD0',border:'#2D313A',keyword:'#FF79C6',string:'#F1FA8C',func:'#50FA7B',comment:'#6272A4' },
        sidebar:{ bg:'#292E39',text:'#EEEFEE',muted:'#BABDBB',hover:'#333845',active:'#3C4151' },
        surface:{ DEFAULT:'#F9FAFB',card:'#FFFFFF',hover:'#F8F9FA',selected:'#F3F0FA',zebra:'#FAFBFC' },
        ink:{ DEFAULT:'#1C2B34',secondary:'#506E81',muted:'#8B9BB4',placeholder:'#ADB5BD' },
        edge:{ DEFAULT:'#D1D9E0',light:'#E9ECEF',lighter:'#F1F3F5',focus:'#632CA6' },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shimmer: 'shimmer 2s infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%':{opacity:'0'}, '100%':{opacity:'1'} },
        slideUp: { '0%':{opacity:'0',transform:'translateY(12px)'}, '100%':{opacity:'1',transform:'translateY(0)'} },
        shimmer: { '0%':{transform:'translateX(-100%)'}, '100%':{transform:'translateX(100%)'} },
        pulseSoft: { '0%,100%':{opacity:'1'}, '50%':{opacity:'0.7'} },
      },
      transitionTimingFunction: { spring: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      boxShadow: {
        none: 'none',
        sm:   '0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        md:   '0 4px 12px -4px rgba(0,0,0,0.08)',
        lg:   '0 8px 24px -8px rgba(0,0,0,0.10)',
        xl:   '0 16px 40px -12px rgba(0,0,0,0.12)',
        modal:'0 20px 60px -15px rgba(0,0,0,0.15)',
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)',
        elevated: '0 4px 16px -8px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
      },
      // Sidebar
      width: { sidebar: '160px' },
      // Z-index layers (Druids: sidebar→overlay→panel→modal→toast)
      zIndex: { sidebar: '30', overlay: '40', panel: '50', modal: '60', toast: '70' },
      // Aspect ratios
      aspectRatio: { video: '16 / 9', square: '1 / 1' },
    },
  },
  plugins: [],
}
