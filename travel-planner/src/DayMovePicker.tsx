import { useState } from "react";

type Props = {
  label: string;
  caption: string;
  current: string | null;
  dates: string[];
  disabled?: boolean;
  onChoose: (date: string) => Promise<boolean>;
};

/** A visible mouse, touch and keyboard alternative to the OS-native select popup. */
export function DayMovePicker({ label, caption, current, dates, disabled, onChoose }: Props) {
  const [open, setOpen] = useState(false);
  return <div className="day-move-picker">
    <span>{caption}</span>
    <button type="button" className="day-move-trigger" aria-label={label}
      aria-expanded={open} disabled={disabled} onClick={() => setOpen((value) => !value)}>
      {current ?? "選擇日期"} <span aria-hidden="true">▾</span>
    </button>
    {open && <div className="day-move-options" role="group" aria-label={`${label}日期`}>
      {dates.map((date) => <button type="button" key={date}
        aria-label={`${label} ${date}`} aria-current={date === current ? "date" : undefined}
        onClick={async () => { if (await onChoose(date)) setOpen(false); }}>
        {date}{date === current ? " · 目前" : ""}
      </button>)}
    </div>}
  </div>;
}
