import React from 'react';

// ==========================================
// 1. Arc Gauge (Pressure / Parameter circular gauge)
// ==========================================
interface ArcGaugeProps {
  value: string | number;
  unit?: string;
  minLabel?: string;
  maxLabel?: string;
  percent?: number; // 0 to 100
  size?: number;
}

export const ArcGauge: React.FC<ArcGaugeProps> = ({
  value,
  unit = '',
  minLabel = 'Low',
  maxLabel = 'High',
  percent = 65,
  size = 140,
}) => {
  const strokeWidth = 3;
  const radius = 50;
  const center = 60;
  // Arc from 140 deg to 400 deg (span of 260 deg)
  const startAngle = 140;
  const endAngle = 400;
  const totalAngle = endAngle - startAngle;

  const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleInRadians),
      y: cy + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (cx: number, cy: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(cx, cy, r, endA);
    const end = polarToCartesian(cx, cy, r, startA);
    const largeArcFlag = endA - startA <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  const bgPath = describeArc(center, center, radius, startAngle, endAngle);
  const activeAngle = startAngle + (Math.max(0, Math.min(100, percent)) / 100) * totalAngle;
  const activePath = describeArc(center, center, radius, startAngle, activeAngle);
  const markerPos = polarToCartesian(center, center, radius, activeAngle);

  return (
    <div className="flex flex-col items-center justify-center relative select-none" style={{ width: size }}>
      <svg viewBox="0 0 120 105" className="w-full overflow-visible">
        {/* Background Arc Track */}
        <path
          d={bgPath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.22)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Active Value Arc */}
        <path
          d={activePath}
          fill="none"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth={strokeWidth + 0.5}
          strokeLinecap="round"
        />

        {/* Small Marker Dot */}
        <circle
          cx={markerPos.x}
          cy={markerPos.y}
          r={4}
          fill="#FFF4E6"
          stroke="rgba(240, 148, 47, 0.8)"
          strokeWidth={1.5}
          className="filter drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]"
        />

        {/* Center Big Bold Value */}
        <text
          x={center}
          y={center + 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="font-bold fill-[#FFF4E6]"
          style={{ fontSize: '20px', letterSpacing: '-0.02em', fontFamily: 'var(--font-sans)' }}
        >
          {value}
          {unit && (
            <tspan dx="3" style={{ fontSize: '11px', fontWeight: 500, fill: 'rgba(255, 244, 230, 0.8)' }}>
              {unit}
            </tspan>
          )}
        </text>
      </svg>

      {/* Min & Max Labels underneath */}
      <div className="w-full flex items-center justify-between px-3 -mt-2 text-[10px] tracking-wider uppercase text-[#FFF4E6]/65 font-medium">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
};

// ==========================================
// 2. Curved Arc Graphic (Sunrise / Sunset / Solar elevation)
// ==========================================
interface CurvedArcGraphicProps {
  startLabel?: string;
  endLabel?: string;
  percent?: number; // 0 to 100
  size?: number;
}

export const CurvedArcGraphic: React.FC<CurvedArcGraphicProps> = ({
  startLabel = '05:18',
  endLabel = '17:25',
  percent = 62,
}) => {
  // Bell-curve arc from (10, 65) up to (60, 20) down to (110, 65)
  // Let's compute marker coordinates along a cubic Bezier curve
  const t = Math.max(0, Math.min(100, percent)) / 100;
  // Curve control points: P0=(15, 65), P1=(45, 15), P2=(75, 15), P3=(105, 65)
  const p0 = { x: 15, y: 65 };
  const p1 = { x: 45, y: 15 };
  const p2 = { x: 75, y: 15 };
  const p3 = { x: 105, y: 65 };

  const cx = 3 * (p1.x - p0.x);
  const bx = 3 * (p2.x - p1.x) - cx;
  const ax = p3.x - p0.x - cx - bx;

  const cy = 3 * (p1.y - p0.y);
  const by = 3 * (p2.y - p1.y) - cy;
  const ay = p3.y - p0.y - cy - by;

  const markerX = ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p0.x;
  const markerY = ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p0.y;

  return (
    <div className="flex flex-col items-center justify-center w-full select-none">
      <svg viewBox="0 0 120 75" className="w-full h-auto overflow-visible">
        {/* Horizon Baseline */}
        <line
          x1="10"
          y1="65"
          x2="110"
          y2="65"
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
          strokeDasharray="2 2"
        />

        {/* Bell-Curve Arc */}
        <path
          d={`M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`}
          fill="none"
          stroke="rgba(255, 255, 255, 0.75)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Glowing Sun / Marker Dot */}
        <circle
          cx={markerX}
          cy={markerY}
          r={7}
          fill="none"
          stroke="rgba(255, 255, 255, 0.45)"
          strokeWidth="1.5"
          className="filter drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
        />
        <circle
          cx={markerX}
          cy={markerY}
          r={4}
          fill="#FFF4E6"
          stroke="rgba(240, 148, 47, 0.9)"
          strokeWidth="1.5"
        />
      </svg>

      {/* Start / End Labels */}
      <div className="w-full flex items-center justify-between px-3 text-[11px] font-mono-tabular text-[#FFF4E6]/75 font-medium mt-1">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
};

// ==========================================
// 3. Smooth Line Chart (Thin white line chart with vertical marker)
// ==========================================
interface ChartPoint {
  label: string;
  value: number;
}

interface SmoothLineChartProps {
  data: ChartPoint[];
  markerIndex?: number;
  height?: number;
}

export const SmoothLineChart: React.FC<SmoothLineChartProps> = ({
  data,
  markerIndex = 3,
  height = 55,
}) => {
  if (!data || data.length === 0) return null;

  const minVal = Math.min(...data.map((d) => d.value));
  const maxVal = Math.max(...data.map((d) => d.value));
  const range = maxVal - minVal || 1;

  const svgWidth = 260;
  const svgHeight = height;
  const paddingX = 12;
  const paddingY = 8;

  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (svgWidth - paddingX * 2);
    const y = svgHeight - paddingY - ((d.value - minVal) / range) * (svgHeight - paddingY * 2);
    return { x, y, label: d.label, value: d.value };
  });

  // Construct smooth bezier path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const pCurrent = points[i];
    const pNext = points[i + 1];
    const cpX = (pCurrent.x + pNext.x) / 2;
    pathD += ` C ${cpX} ${pCurrent.y}, ${cpX} ${pNext.y}, ${pNext.x} ${pNext.y}`;
  }

  const activePt = points[Math.min(points.length - 1, Math.max(0, markerIndex))];

  return (
    <div className="w-full flex flex-col items-center select-none">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto overflow-visible">
        {/* Baseline guide line */}
        <line
          x1={paddingX}
          y1={svgHeight - paddingY}
          x2={svgWidth - paddingX}
          y2={svgHeight - paddingY}
          stroke="rgba(255, 255, 255, 0.2)"
          strokeWidth="1"
        />

        {/* Vertical Marker Line */}
        {activePt && (
          <line
            x1={activePt.x}
            y1={0}
            x2={activePt.x}
            y2={svgHeight - paddingY}
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        )}

        {/* Smooth White Line */}
        <path
          d={pathD}
          fill="none"
          stroke="#FFF4E6"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="filter drop-shadow-[0_0_3px_rgba(255,255,255,0.4)]"
        />

        {/* Active Marker Dot */}
        {activePt && (
          <circle
            cx={activePt.x}
            cy={activePt.y}
            r={3.5}
            fill="#FFF4E6"
            stroke="rgba(240, 148, 47, 0.9)"
            strokeWidth="1.5"
          />
        )}
      </svg>

      {/* Axis Labels */}
      <div className="w-full flex items-center justify-between px-2 pt-1 text-[10px] font-mono-tabular text-[#FFF4E6]/65 font-medium">
        {points.map((p, idx) => (
          <span key={idx} className={idx === markerIndex ? 'text-[#FFF4E6] font-bold' : ''}>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 4. Horizontal Progress / Slider Track
// ==========================================
interface HorizontalProgressTrackProps {
  percent: number; // 0 to 100
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftLabel?: string;
  rightLabel?: string;
  subtext?: string;
  caption?: string;
}

export const HorizontalProgressTrack: React.FC<HorizontalProgressTrackProps> = ({
  percent,
  leftIcon,
  rightIcon,
  leftLabel,
  rightLabel,
  subtext,
  caption,
}) => {
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className="w-full space-y-2 select-none">
      <div className="flex items-center gap-2.5">
        {leftIcon && <div className="shrink-0 text-[#FFF4E6]">{leftIcon}</div>}
        {leftLabel && <span className="text-[11px] text-[#FFF4E6]/80 font-medium shrink-0">{leftLabel}</span>}

        {/* The Track with Knob */}
        <div className="relative flex-1 h-3 flex items-center">
          {/* Background track line */}
          <div className="w-full h-[2px] bg-white/25 rounded-full" />
          {/* Active filled track */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-white/80 rounded-full"
            style={{ width: `${clamped}%` }}
          />
          {/* Small bright knob */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#FFF4E6] border border-white/80 shadow-[0_0_6px_rgba(255,255,255,0.7)] cursor-pointer -ml-1.5 transition-all"
            style={{ left: `${clamped}%` }}
          />
        </div>

        {rightIcon && <div className="shrink-0 text-[#FFF4E6]">{rightIcon}</div>}
        {rightLabel && <span className="text-[11px] text-[#FFF4E6]/80 font-medium shrink-0">{rightLabel}</span>}
      </div>

      {caption && (
        <p className="text-[11.5px] text-[#FFF4E6]/75 leading-relaxed font-sans">
          {caption}
        </p>
      )}

      {subtext && (
        <div className="text-[10.5px] font-mono-tabular text-[#FFF4E6]/60 pt-0.5">
          {subtext}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. Sol / Waypoint Tile Row
// ==========================================
export interface TileItem {
  id: string;
  topValue: string | number;
  label: string;
  badge?: string;
}

interface TileRowProps {
  items: TileItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export const TileRow: React.FC<TileRowProps> = ({ items, activeId, onSelect }) => {
  return (
    <div className="w-full flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 select-none">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`tile-item flex-1 min-w-[58px] sm:min-w-[64px] transition-all cursor-pointer ${
              isActive ? 'tile-item-active' : ''
            }`}
          >
            <span className={`text-[15px] sm:text-[17px] font-bold font-mono-tabular leading-tight ${isActive ? 'text-[#FFF4E6]' : 'text-[#FFF4E6]/90'}`}>
              {item.topValue}
            </span>
            <span className="text-[9.5px] font-semibold tracking-widest uppercase text-[#FFF4E6]/75 mt-0.5">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// ==========================================
// 6. Floating Mars Sphere with Atmospheric Rim & Drop Shadow
// ==========================================
interface FloatingMarsSphereProps {
  size?: number;
  label?: string;
  subLabel?: string;
  onClick?: () => void;
}

export const FloatingMarsSphere: React.FC<FloatingMarsSphereProps> = ({
  size = 180,
  label,
  subLabel,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`flex flex-col items-center justify-center select-none group ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* 3D/2D Sphere with soft atmospheric rim glow */}
      <div
        className="relative rounded-full transition-transform duration-300 group-hover:scale-105"
        style={{
          width: size,
          height: size,
          boxShadow: '0 0 32px rgba(255, 175, 95, 0.35), inset -8px -8px 24px rgba(0, 0, 0, 0.6), inset 4px 4px 12px rgba(255, 230, 180, 0.4)',
        }}
      >
        <div
          className="w-full h-full rounded-full overflow-hidden animate-rotate-mars bg-cover bg-center"
          style={{
            backgroundImage: "url('/mars-planet-disk.png')",
          }}
        />

        {/* Reticle targeting crosshair if labeled */}
        {label && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 border border-white/50 rounded-sm flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          </div>
        )}
      </div>

      {/* Elliptical Shadow Underneath */}
      <div
        className="planet-shadow mt-3 rounded-full"
        style={{
          width: Math.round(size * 0.72),
          height: 14,
        }}
      />

      {label && (
        <div className="text-center mt-2">
          <div className="text-[13px] font-bold text-[#FFF4E6] tracking-wider uppercase">
            {label}
          </div>
          {subLabel && (
            <div className="text-[11px] font-mono-tabular text-[#FFF4E6]/75">
              {subLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
