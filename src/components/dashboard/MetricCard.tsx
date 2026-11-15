import React from 'react';

export interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  subtext: string;
  status?: 'nominal' | 'warning' | 'error' | 'unavailable';
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  status = 'nominal',
  icon,
  onClick,
}) => {
  const statusLabel = status.toUpperCase();

  const statusBadgeClass =
    status === 'error'
      ? 'bg-red-500/25 border-red-400/40 text-red-200'
      : status === 'warning'
        ? 'bg-amber-500/25 border-amber-400/40 text-amber-200'
        : status === 'unavailable'
          ? 'bg-white/10 border-white/15 text-[#FFF4E6]/60'
          : 'bg-emerald-500/25 border-emerald-400/40 text-emerald-200';

  const content = (
    <div className="p-4 sm:p-5 flex flex-col justify-between h-full gap-3 select-none">
      {/* Top Row: Icon + Title on left, Status on right */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="text-[#FFF4E6]/85 shrink-0">{icon}</span>}
          <span className="text-[13.5px] font-medium text-[#FFF4E6] tracking-wide truncate">
            {label}
          </span>
        </div>
        <span
          className={`text-[10px] font-mono-tabular font-bold tracking-wider px-2 py-0.5 rounded-[6px] border ${statusBadgeClass} shrink-0`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Middle: Big Bold Value & Unit */}
      <div className="flex items-baseline gap-2 my-0.5">
        <span className="text-[28px] sm:text-[32px] font-bold font-mono-tabular tracking-tight leading-none text-[#FFF4E6]">
          {value}
        </span>
        {unit && (
          <span className="text-[13px] font-mono-tabular text-[#FFF4E6]/80 font-medium">
            {unit}
          </span>
        )}
      </div>

      {/* Bottom Subtext */}
      <p className="text-[12px] text-[#FFF4E6]/75 leading-relaxed font-sans">
        {subtext}
      </p>
    </div>
  );

  const containerClasses =
    'glass-panel rounded-[18px] border border-white/25 bg-white/[0.12] backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.18)] transition-all duration-200 text-left';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${containerClasses} hover:bg-white/[0.20] hover:border-white/45 hover:-translate-y-0.5 cursor-pointer w-full`}
      >
        {content}
      </button>
    );
  }

  return <div className={containerClasses}>{content}</div>;
};
