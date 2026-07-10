import { chartColors } from '../../lib/tokens';
import type { MetricPoint } from './types';
import type { ChartSeries } from './utils';

export type ActiveModifier = {
  category: string;
  fn: string;
  params?: Record<string, string>;
};

// Use chartColors offset so overlays don't collide with main series colors
const OVERLAY_OFFSET = 4;
let colorIdx = 0;

function nextOverlayColor(): string {
  return chartColors[(OVERLAY_OFFSET + (colorIdx++ % (chartColors.length - OVERLAY_OFFSET))) % chartColors.length];
}

/** Reset the overlay color counter — call at the start of each chart computation */
export function resetOverlayColors(): void {
  colorIdx = 0;
}

export function applyModifier(points: MetricPoint[], modifier: ActiveModifier, baseName: string): ChartSeries[] {
  if (!points.length) return [];
  const { fn, params } = modifier;

  switch (modifier.category) {
    case 'algorithms':
      return algorithmSeries(points, fn, params, baseName);
    case 'regression':
      return regressionSeries(points, fn, params, baseName);
    default: {
      const c = nextOverlayColor();
      switch (modifier.category) {
        case 'arithmetic':
          return [{ name: `${fn}(${baseName})`, data: arithmetic(points, fn, params), color: c, style: 'dashed' }];
        case 'smoothing':
          return [{ name: `${fn}(${baseName})`, data: smoothFn(points, fn, params), color: c, style: 'dashed' }];
        case 'rate':
          return [{ name: `${fn}(${baseName})`, data: rateFn(points, fn), color: c, style: 'dashed' }];
        case 'timeshift':
          return [{ name: `${fn}(${baseName})`, data: timeshiftFn(points, params), color: c, style: 'dashed' }];
        case 'exclusion':
          return [{ name: `${fn}(${baseName})`, data: exclusionFn(points, fn, params), color: c, style: 'dashed' }];
        case 'count':
          return [{ name: `${fn}(${baseName})`, data: countFn(points, fn), color: c, style: 'dashed' }];
        case 'interpolation':
          return [{ name: `${fn}(${baseName})`, data: interpolationFn(points, fn), color: c, style: 'dashed' }];
        default:
          return [];
      }
    }
  }
}

function algorithmSeries(pts: MetricPoint[], fn: string, p: Record<string, string> | undefined, baseName: string): ChartSeries[] {
  const mean = pts.reduce((s, x) => s + x.value, 0) / pts.length;
  const std = Math.sqrt(pts.reduce((s, x) => s + Math.pow(x.value - mean, 2), 0) / pts.length);
  const sens = p?.Sensitivity === 'High' ? 0.8 : p?.Sensitivity === 'Low' ? 2.5 : 1.5;
  const c = nextOverlayColor();

  if (fn.includes('Change')) {
    let last = pts[0]?.value || 0;
    const markers = pts.map((x, i) => {
      if (i === 0) return { ...x, value: 0 };
      const changed = Math.abs(x.value - last) > Math.abs(last) * 0.15;
      if (changed) last = x.value;
      return { ...x, value: changed ? x.value : 0 };
    });
    return [{ name: `Change(${baseName})`, data: markers, color: c, style: 'scatter' }];
  }

  if (fn.includes('Seasonal')) {
    const w = 10;
    const seasonal = pts.map((x, i) => {
      const s = Math.max(0, i - w), e = Math.min(pts.length - 1, i + w);
      const avg = pts.slice(s, e + 1).reduce((a, y) => a + y.value, 0) / (e - s + 1);
      return { ...x, value: Math.round((x.value - avg) * 100) / 100 };
    });
    return [{ name: `Seasonal(${baseName})`, data: seasonal, color: c, style: 'dashed' }];
  }

  const upper = pts.map(x => ({ ...x, value: mean + sens * std }));
  const lower = pts.map(x => ({ ...x, value: Math.max(0, mean - sens * std) }));
  const markers = pts.map(x => ({ ...x, value: Math.abs(x.value - mean) > sens * std ? x.value : 0 }));
  return [
    { name: `${fn} band`, data: upper, bandLower: lower, color: c, style: 'band', bandColor: c },
    { name: `${fn}(${baseName})`, data: markers, color: c, style: 'scatter' },
  ];
}

function regressionSeries(pts: MetricPoint[], fn: string, p: Record<string, string> | undefined, baseName: string): ChartSeries[] {
  const c = nextOverlayColor();

  if (fn.includes('Linear') || fn.includes('Polynomial')) {
    return [{ name: `${fn}(${baseName})`, data: linearTrend(pts), color: c, style: 'dashed' }];
  }

  if (fn.includes('Forecast')) {
    const h: Record<string, number> = { '1 hour': 60, '6 hours': 360, '1 day': 1440, '1 week': 10080 };
    const n = Math.min(h[p?.Horizon || '1 hour'] || 60, 30);
    const last = pts[pts.length - 1]?.value || 0;
    const trend = pts.length > 1 ? (pts[pts.length - 1].value - pts[0].value) / pts.length : 0;
    const std = Math.sqrt(pts.reduce((s, x) => s + Math.pow(x.value - (pts[0].value + trend * pts.indexOf(x)), 2), 0) / pts.length);
    const fc = Array.from({ length: n }, (_, i) => ({
      ts: new Date(new Date(pts[pts.length - 1].ts).getTime() + (i + 1) * 60000).toISOString(),
      value: Math.round((last + trend * (i + 1)) * 100) / 100,
    }));
    const upperFc = fc.map(x => ({ ...x, value: x.value + std * 1.5 }));
    const lowerFc = fc.map(x => ({ ...x, value: Math.max(0, x.value - std * 1.5) }));
    return [
      { name: `Forecast(${baseName})`, data: [...pts, ...fc], color: c, style: 'dashed' },
      { name: 'Confidence band', data: upperFc, bandLower: lowerFc, color: c, style: 'band', bandColor: c },
    ];
  }

  return [];
}

function arithmetic(pts: MetricPoint[], fn: string, p?: Record<string, string>): MetricPoint[] {
  if (fn === 'Absolute value') return pts.map(x => ({ ...x, value: Math.abs(x.value) }));
  if (fn === 'Log 2') return pts.map(x => ({ ...x, value: x.value > 0 ? Math.log2(x.value) : 0 }));
  if (fn === 'Log 10') return pts.map(x => ({ ...x, value: x.value > 0 ? Math.log10(x.value) : 0 }));
  if (fn === 'Cumulative sum') { let s = 0; return pts.map(x => { s += x.value; return { ...x, value: s }; }); }
  if (fn === 'Power') { const e = parseFloat(p?.Exponent || '2'); return pts.map(x => ({ ...x, value: Math.pow(x.value, e) })); }
  if (fn === 'Integral') { let sum = 0; return pts.map((x, i) => { if (i > 0) sum += x.value * ((new Date(x.ts).getTime() - new Date(pts[i-1].ts).getTime())/1000); return { ...x, value: sum }; }); }
  return pts;
}
function interpolationFn(pts: MetricPoint[], _fn: string): MetricPoint[] {
  return pts.map((p, i) => (i === 0 || p.value !== 0) ? p : { ...p, value: pts[i-1]?.value || 0 });
}
function timeshiftFn(pts: MetricPoint[], p?: Record<string, string>): MetricPoint[] {
  const ms: Record<string, number> = { '1 hour': 3600000, '1 day': 86400000, '1 week': 604800000, '1 month': 2592000000 };
  return pts.map(x => ({ ...x, ts: new Date(new Date(x.ts).getTime() + (ms[p?.Offset||'1 hour']||3600000)).toISOString() }));
}
function rateFn(pts: MetricPoint[], fn: string): MetricPoint[] {
  const d: Record<string, number> = { 'Per second': 1, 'Per minute': 60, 'Per hour': 3600, 'Per day': 86400 };
  const div = d[fn] || 1;
  return pts.map((x, i) => {
    if (i === 0) return { ...x, value: 0 };
    const dt = (new Date(x.ts).getTime() - new Date(pts[i-1].ts).getTime()) / 1000;
    return { ...x, value: dt > 0 ? ((x.value - pts[i-1].value) / dt) * div : 0 };
  });
}
function smoothFn(pts: MetricPoint[], fn: string, p?: Record<string, string>): MetricPoint[] {
  if (fn.includes('Moving')) {
    const w: Record<string, number> = { '1 min': 1, '5 min': 5, '15 min': 15, '1 hour': 60, 'Auto': 10 };
    const n = w[p?.Window||'5 min'] || 5;
    return pts.map((_, i) => { const s = pts.slice(Math.max(0,i-n+1),i+1); return { ...pts[i], value: Math.round(s.reduce((a,x)=>a+x.value,0)/s.length*100)/100 }; });
  }
  if (fn.includes('Exponential')) {
    const alpha = parseFloat(p?.Alpha||'0.3'); let ema = pts[0]?.value||0;
    return pts.map((x,i) => { if(i===0){ema=x.value;return {...x,value:Math.round(ema*100)/100};} ema=alpha*x.value+(1-alpha)*ema; return {...x,value:Math.round(ema*100)/100}; });
  }
  return pts.map((x,i) => { if(i===0||i===pts.length-1)return x; return {...x,value:Math.round((pts[i-1].value*.25+x.value*.5+pts[i+1].value*.25)*100)/100}; });
}
function countFn(pts: MetricPoint[], fn: string): MetricPoint[] {
  if (fn.includes('zero')) { let c=0; return pts.map((x,i)=>{if(i>0&&((pts[i-1].value>0)!==(x.value>0)))c++;return{...x,value:c}}); }
  if (fn.includes('anomalies')) { const m=pts.reduce((s,x)=>s+x.value,0)/pts.length,std=Math.sqrt(pts.reduce((s,x)=>s+Math.pow(x.value-m,2),0)/pts.length); return pts.map(x=>({...x,value:Math.abs(x.value-m)>1.5*std?x.value:0})); }
  let c=0; return pts.map(x=>{c++;return{...x,value:c}});
}
function exclusionFn(pts: MetricPoint[], fn: string, p?: Record<string, string>): MetricPoint[] {
  if (fn.includes('null')) return pts.filter(x=>x.value!=null&&!isNaN(x.value));
  if (fn.includes('outliers')) { const v=pts.map(x=>x.value).sort((a,b)=>a-b); const q1=v[Math.floor(v.length*.25)],q3=v[Math.floor(v.length*.75)],iqr=q3-q1; return pts.filter(x=>x.value>=q1-1.5*iqr&&x.value<=q3+1.5*iqr); }
  if (fn.includes('below')) { const t=parseFloat(p?.Threshold||'0'); return pts.filter(x=>x.value>=t); }
  if (fn.includes('above')) { const t=parseFloat(p?.Threshold||'80'); return pts.filter(x=>x.value<=t); }
  return pts;
}
function linearTrend(pts: MetricPoint[]): MetricPoint[] {
  const n=pts.length; let sx=0,sy=0,sxy=0,sx2=0;
  pts.forEach((x,i)=>{sx+=i;sy+=x.value;sxy+=i*x.value;sx2+=i*i;});
  const slope=(n*sxy-sx*sy)/(n*sx2-sx*sx),intercept=(sy-slope*sx)/n;
  return pts.map((x,i)=>({...x,value:Math.round((slope*i+intercept)*100)/100}));
}
