
import { parseBCDate, formatBCDate } from '../../lib/dateUtils';

interface BCDateTimePickerProps {
  isoString?: string | null;
  onChange: (isoString: string) => void;
  label?: string;
  className?: string;
}

export default function BCDateTimePicker({
  isoString, onChange,
  label,
  className = ""
}: BCDateTimePickerProps) {
  const parsed = parseBCDate(isoString || "0000-01-01T12:00:00Z");
  const isBC = parsed.year.startsWith('-');
  const displayYear = isBC ? parsed.year.slice(1) : parsed.year;
  
  // Split into date part (YYYY-MM-DD) and time part (HH:mm) for stable cross-browser behavior
  const localDateTime = parsed.monthDayTime.replace('2000', displayYear.padStart(4, '0'));
  const localDate = localDateTime.split('T')[0];
  const localTime = localDateTime.split('T')[1]?.slice(0, 5) || '12:00';

  const handleToggle = () => {
    const newYear = isBC ? displayYear : '-' + displayYear;
    onChange(formatBCDate(newYear, localDateTime) || '');
  };

  const handleDateChange = (dateVal: string) => {
    const newVal = `${dateVal}T${localTime}`;
    const yearPart = dateVal.split('-')[0];
    const newYear = isBC ? '-' + yearPart : yearPart;
    onChange(formatBCDate(newYear, newVal) || '');
  };

  const handleTimeChange = (timeVal: string) => {
    const newVal = `${localDate}T${timeVal}`;
    const yearPart = localDate.split('-')[0];
    const newYear = isBC ? '-' + yearPart : yearPart;
    onChange(formatBCDate(newYear, newVal) || '');
  };

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg bg-[var(--color-page-bg)] border border-dashed ${className}`} style={{ borderColor: 'var(--color-border)' }}>
      {label && <label className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</label>}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={() => !isBC || handleToggle()}
            className={`px-3 py-1.5 text-xs font-medium border-none cursor-pointer transition-colors ${!isBC ? 'bg-[var(--color-primary)] text-white' : 'bg-transparent text-[var(--color-text-muted)]'}`}
          >
            AD
          </button>
          <button
            type="button"
            onClick={() => isBC || handleToggle()}
            className={`px-3 py-1.5 text-xs font-medium border-none cursor-pointer transition-colors ${isBC ? 'bg-[var(--color-primary)] text-white' : 'bg-transparent text-[var(--color-text-muted)]'}`}
          >
            BC
          </button>
        </div>
        <input
          type="date"
          value={localDate}
          onChange={e => handleDateChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg border outline-none text-sm bg-transparent"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        />
        <input
          type="time"
          value={localTime}
          onChange={e => handleTimeChange(e.target.value)}
          className="w-24 px-3 py-1.5 rounded-lg border outline-none text-sm bg-transparent"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        />
      </div>
    </div>
  );
}



