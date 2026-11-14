import { TimeInput } from "@/components/controls";
import { shiftMiddle, shiftMinutes, type DayRule } from "@/lib/day-rules";

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hm = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
export const time12 = (t: string) => {
  const h = Number(t.slice(0, 2));
  return `${((h + 11) % 12) + 1}:${t.slice(3)} ${h >= 12 ? "pm" : "am"}`;
};

export const SCHEDULE_HELP =
  "Weekly off: paid day off for monthly staff. Grace in: minutes after the start time that still count as on time; a later first scan is tagged Late. Grace out: minutes before the end time someone may leave; an earlier last scan is tagged Left early. Both are tags only (full pay). Half day: punched in after the middle of that day's shift, or punched out before it. Any scan = full day: for short days like Sunday.";

/**
 * The per-weekday schedule table used by Settings (business hours) and the shift editor.
 * Field names: off_i, open_i, close_i, grace_i, graceout_i, any_i (read by readDayRulesForm).
 */
export function WeekSchedule({ rules, weeklyOff }: { rules: DayRule[]; weeklyOff: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-cards">
        <thead>
          <tr>
            <th>Day</th>
            <th>Weekly off</th>
            <th>Starts</th>
            <th>Ends</th>
            <th>Grace in (min)</th>
            <th>Grace out (min)</th>
            <th>Half day if in after / out before</th>
            <th>Any scan = full day</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r, i) => (
            <tr key={i}>
              <td className="card-title font-medium">{DAYS[i]}</td>
              <td data-label="Weekly off">
                <input type="checkbox" name={`off_${i}`} defaultChecked={weeklyOff.includes(i)} className="h-5 w-5" aria-label={`${DAYS[i]} weekly off`} />
              </td>
              <td data-label="Starts"><TimeInput name={`open_${i}`} defaultValue={r.open} className="w-36" /></td>
              <td data-label="Ends"><TimeInput name={`close_${i}`} defaultValue={r.close} className="w-36" /></td>
              <td data-label="Grace in (min)">
                <input type="number" name={`grace_${i}`} step="5" min={0} max={240} defaultValue={r.graceMins} className="input !w-24" aria-label={`Grace in minutes on ${DAYS[i]}`} />
              </td>
              <td data-label="Grace out (min)">
                <input type="number" name={`graceout_${i}`} step="5" min={0} max={240} defaultValue={r.graceOutMins} className="input !w-24" aria-label={`Grace out minutes on ${DAYS[i]}`} />
              </td>
              <td data-label="Half day if in after / out before" className="muted tabular-nums">
                {r.anyScanFullDay ? "Never (any scan = full day)" : `${time12(shiftMiddle(r))} (middle of ${hm(shiftMinutes(r))})`}
              </td>
              <td data-label="Any scan = full day">
                <input type="checkbox" name={`any_${i}`} defaultChecked={r.anyScanFullDay} className="h-5 w-5" aria-label={`${DAYS[i]} any scan counts as full day`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** "Mon–Sat 9:00 am – 6:00 pm" style one-line summary of a schedule. */
export function scheduleSummary(rules: DayRule[], weeklyOff: number[]) {
  const work = rules.map((r, i) => ({ r, i })).filter(({ i }) => !weeklyOff.includes(i));
  if (work.length === 0) return "No working days";
  const first = work.find(({ i }) => i === 1)?.r ?? work[0].r;
  const same = work.every(({ r }) => r.open === first.open && r.close === first.close);
  const off = weeklyOff.map((d) => DAYS[d].slice(0, 3)).join(", ");
  const times = same ? `${time12(first.open)} to ${time12(first.close)}` : "times differ by day";
  const grace = first.graceMins || first.graceOutMins ? ` · grace ${first.graceMins}m in / ${first.graceOutMins}m out` : "";
  return `${times}${grace}${off ? ` · off ${off}` : ""}`;
}
