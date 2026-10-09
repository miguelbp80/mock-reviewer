import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Preset = "today" | "week" | "month" | "custom";
export type DateRange = { start: Date; end: Date };

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

/* ── Date helpers (local dates, always at midnight) ───────────────────────── */

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date, b: Date) => a.getTime() === b.getTime();
const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Weeks start on Monday. */
const weekStart = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export const presetRange = (preset: Preset, today: Date, custom: DateRange | null): DateRange => {
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "week":
      return { start: weekStart(today), end: today };
    case "month":
      return { start: monthStart(today), end: today };
    case "custom":
      return custom ?? { start: today, end: today };
  }
};

/** Inclusive number of days in the range. */
export const rangeDays = (r: DateRange) => Math.round((r.end.getTime() - r.start.getTime()) / 86400000) + 1;

const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const full = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const long = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export const rangeLabel = (r: DateRange) =>
  sameDay(r.start, r.end)
    ? full.format(r.start)
    : r.start.getFullYear() === r.end.getFullYear()
      ? `${short.format(r.start)} to ${full.format(r.end)}`
      : `${full.format(r.start)} to ${full.format(r.end)}`;

/* ── Calendar ─────────────────────────────────────────────────────────────── */

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const RangeCalendar = ({
  today,
  initial,
  onPick,
  onClose,
}: {
  today: Date;
  initial: DateRange | null;
  onPick: (range: DateRange) => void;
  onClose: () => void;
}) => {
  const [view, setView] = useState(() => monthStart(initial?.end ?? today));
  const [start, setStart] = useState<Date | null>(null);
  const [hover, setHover] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the first usable day so keyboard users land inside the calendar.
    ref.current?.querySelector<HTMLButtonElement>("button[data-day]:not(:disabled)")?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest(".mkd-period")) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const first = view;
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(first.getFullYear(), first.getMonth(), i + 1)),
  ];
  const isCurrentMonth = sameDay(first, monthStart(today));

  const pick = (d: Date) => {
    if (!start) {
      setStart(d);
      return;
    }
    onPick(d < start ? { start: d, end: start } : { start, end: d });
  };

  // While picking the end date, preview the range under the pointer.
  const lo = start && (hover && hover < start ? hover : start);
  const hi = start && (hover && hover > start ? hover : start);

  return (
    <div ref={ref} role="dialog" aria-label="Choose a date range" className="mkd-cal">
      <div className="mkd-cal-head">
        <button
          type="button"
          className="mkd-icon-btn"
          aria-label="Previous month"
          onClick={() => setView(new Date(first.getFullYear(), first.getMonth() - 1, 1))}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <p className="mkd-cal-month" aria-live="polite">
          {monthName.format(first)}
        </p>
        <button
          type="button"
          className="mkd-icon-btn"
          aria-label="Next month"
          disabled={isCurrentMonth}
          onClick={() => setView(new Date(first.getFullYear(), first.getMonth() + 1, 1))}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="mkd-cal-grid" onMouseLeave={() => setHover(null)}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="mkd-cal-weekday" aria-hidden="true">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`blank-${i}`} />;
          const future = d > today;
          const isStart = start && sameDay(d, start);
          const inRange = lo && hi && d >= lo && d <= hi;
          return (
            <button
              key={d.getTime()}
              type="button"
              data-day
              className={`mkd-cal-day${inRange ? " is-range" : ""}${isStart ? " is-edge" : ""}${sameDay(d, today) ? " is-today" : ""}`}
              disabled={future}
              aria-label={`${long.format(d)}${isStart ? ", range start" : ""}`}
              aria-pressed={Boolean(isStart)}
              onMouseEnter={() => setHover(d)}
              onClick={() => pick(d)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <p className="mkd-cal-hint" aria-live="polite">
        {start ? `Start ${short.format(start)}. Now pick the end date.` : "Pick the start date, then the end date."}
      </p>
    </div>
  );
};

/* ── Period picker: presets plus a custom range ───────────────────────────── */

export const PeriodPicker = ({
  preset,
  custom,
  today,
  onChange,
}: {
  preset: Preset;
  custom: DateRange | null;
  today: Date;
  onChange: (preset: Preset, custom?: DateRange) => void;
}) => {
  const [open, setOpen] = useState(false);
  const customBtn = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    customBtn.current?.focus();
  };

  return (
    <div className="mkd-period">
      <div role="group" aria-label="Period" className="mkd-segment">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            ref={p.id === "custom" ? customBtn : undefined}
            type="button"
            className="mkd-segment-btn"
            aria-pressed={preset === p.id}
            aria-expanded={p.id === "custom" ? open : undefined}
            aria-haspopup={p.id === "custom" ? "dialog" : undefined}
            onClick={() => {
              if (p.id === "custom") {
                setOpen((v) => !v);
              } else {
                setOpen(false);
                onChange(p.id);
              }
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {open && (
        <RangeCalendar
          today={today}
          initial={custom}
          onClose={close}
          onPick={(range) => {
            onChange("custom", range);
            close();
          }}
        />
      )}
    </div>
  );
};
