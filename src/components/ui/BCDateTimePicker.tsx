interface BCDateTimePickerProps {
  isoString: string;
  onChange: (val: string) => void;
  label?: string;
  className?: string;
}

export default function BCDateTimePicker({
  isoString, onChange,
  label = "发布时间",
  className = ""
}: BCDateTimePickerProps) {
  const parsed = parseBCDate(isoString);
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

export function formatBCDate(year: string, monthDayTime: string): string | undefined {
  if (!year || !monthDayTime) return undefined;
  const isBC = year.startsWith('-');
  const absoluteYear = isBC ? year.slice(1) : year;
  const paddedYear = absoluteYear.padStart(4, '0');
  const parts = monthDayTime.split('T');
  if (parts.length < 2) return undefined;
  const dateParts = parts[0].split('-');
  const monthDay = dateParts.length > 2 ? `${dateParts[1]}-${dateParts[2]}` : dateParts.join('-');
  // Ensure time is only HH:mm
  const time = parts[1].slice(0, 5);
  return `${paddedYear}-${monthDay} ${time}:00${isBC ? ' BC' : ''}`;
}

export function parseBCDate(isoString: string | null | undefined): { year: string, monthDayTime: string } {
  if (!isoString) {
    const now = new Date();
    const year = now.getFullYear().toString();
    const monthDayTime = now.toLocaleString('sv-SE').replace(' ', 'T').slice(0, 16);
    return { year, monthDayTime };
  }
  let yearStr = '';
  let rest = '';
  if (isoString.startsWith('-')) {
    const secondHyphenIndex = isoString.indexOf('-', 1);
    yearStr = (parseInt(isoString.slice(0, secondHyphenIndex), 10)).toString();
    rest = isoString.slice(secondHyphenIndex);
  } else if (isoString.includes(' BC')) {
    const firstHyphenIndex = isoString.indexOf('-');
    yearStr = '-' + parseInt(isoString.slice(0, firstHyphenIndex), 10).toString();
    rest = isoString.slice(firstHyphenIndex).replace(' BC', '');
  } else {
    const firstHyphenIndex = isoString.indexOf('-');
    if (firstHyphenIndex === -1) return { year: isoString, monthDayTime: '2000-01-01T12:00' };
    yearStr = (parseInt(isoString.slice(0, firstHyphenIndex), 10)).toString();
    rest = isoString.slice(firstHyphenIndex);
  }
  const normalizedRest = rest.replace(' ', 'T');
  // Datetime-local strictly needs YYYY-MM-DDTHH:mm (16 chars including year)
  // Our "rest" starts with hyphen, so it's -MM-DDTHH:mm (12 chars)
  const monthDayTime = "2000" + normalizedRest.slice(0, 12);
  return { year: yearStr, monthDayTime };
}

/**
 * Robustly formats a date string (possibly BC) for display
 */
export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  
  // 1. Clean and normalize the string
  const cleanStr = dateStr.toString().replace(/\.\d+/, '').trim();
  const isBC = cleanStr.includes(' BC') || cleanStr.startsWith('-');
  
  // 2. Handle Non-BC Dates (Modern Era)
  if (!isBC) {
    // Replace space with T for cross-browser reliability
    const normalized = cleanStr.replace(' ', 'T');
    const date = new Date(normalized);
    
    if (!isNaN(date.getTime())) {
      const diff = Date.now() - date.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return '刚刚';
      if (mins < 60) return `${mins} 分钟前`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} 小时前`;
      const days = Math.floor(hours / 24);
      if (days < 30) return `${days} 天前`;
      return date.toLocaleDateString('zh-CN');
    }
    
    // If it's still Invalid Date after normalization, don't return "Invalid Date"
    return cleanStr === 'Invalid Date' ? '' : cleanStr;
  }

  // 3. Handle BC Dates
  try {
    let yearStr = '';
    let rest = '';
    
    if (cleanStr.startsWith('-')) {
      // ISO format: -000031-05-07...
      const secondHyphenIndex = cleanStr.indexOf('-', 1);
      if (secondHyphenIndex === -1) return cleanStr;
      yearStr = Math.abs(parseInt(cleanStr.slice(0, secondHyphenIndex), 10)).toString();
      rest = cleanStr.slice(secondHyphenIndex);
    } else {
      // Postgres format: 0031-05-07 ... BC
      const firstHyphenIndex = cleanStr.indexOf('-');
      if (firstHyphenIndex === -1) return cleanStr;
      yearStr = parseInt(cleanStr.slice(0, firstHyphenIndex), 10).toString();
      rest = cleanStr.slice(firstHyphenIndex).replace(' BC', '');
    }

    // Extract month and day from rest (starts with -MM-DD...)
    const dateParts = rest.split(/T| /)[0].split('-');
    const month = parseInt(dateParts[1] || '1', 10);
    const day = parseInt(dateParts[2] || '1', 10);
    
    return `BC ${yearStr}/${month}/${day}`;
  } catch (e) {
    return cleanStr;
  }
}

/**
 * Returns a precise, fully spelled-out date for tooltip use.
 * e.g. "2026年5月9日 16:30"  or  "公元前 202年3月15日"
 */
export function formatFullDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleanStr = dateStr.toString().replace(/\.\d+/, '').trim();
  const isBC = cleanStr.includes(' BC') || cleanStr.startsWith('-');

  if (!isBC) {
    const normalized = cleanStr.replace(' ', 'T');
    const date = new Date(normalized);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    }
    return cleanStr;
  }

  try {
    let yearStr = '';
    let rest = '';
    if (cleanStr.startsWith('-')) {
      const idx = cleanStr.indexOf('-', 1);
      if (idx === -1) return cleanStr;
      yearStr = Math.abs(parseInt(cleanStr.slice(0, idx), 10)).toString();
      rest = cleanStr.slice(idx);
    } else {
      const idx = cleanStr.indexOf('-');
      if (idx === -1) return cleanStr;
      yearStr = parseInt(cleanStr.slice(0, idx), 10).toString();
      rest = cleanStr.slice(idx).replace(' BC', '');
    }
    const parts = rest.split(/T| /)[0].split('-');
    const month = parseInt(parts[1] || '1', 10);
    const day = parseInt(parts[2] || '1', 10);
    return `公元前 ${yearStr}年${month}月${day}日`;
  } catch {
    return cleanStr;
  }
}

