import { useEffect, useId, useState } from 'react';

type ReportHelpTooltipProps = {
  label: string;
  description: string;
  children: React.ReactNode;
};

const SHOW_DELAY_MS = 700;

export function ReportHelpTooltip({ label, description, children }: ReportHelpTooltipProps) {
  const tooltipId = useId();
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(false);
  const showIcon = !['Visão em regime de caixa', 'Exportar CSV', 'Período'].includes(label);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }

    const timeout = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [active]);

  return (
    <span className="relative inline-flex max-w-full items-center gap-1">
      <span
        aria-describedby={visible ? tooltipId : undefined}
        aria-label={label}
        className="inline-flex max-w-full cursor-help items-center gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        onBlur={() => setActive(false)}
        onFocus={() => setActive(true)}
        onMouseEnter={() => setActive(true)}
        onMouseLeave={() => setActive(false)}
        tabIndex={0}
      >
        {children}
        {showIcon && <span aria-hidden="true" className="text-[10px] font-bold text-slate-400">?</span>}
      </span>
      {visible && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-lg"
        >
          {description}
        </span>
      )}
    </span>
  );
}
