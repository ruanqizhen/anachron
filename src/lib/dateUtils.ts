export function formatBCDate(year: string, monthDayTime: string): string | undefined {
  if (!year || !monthDayTime) return undefined;
  const isBC = year.startsWith('-');
  const absoluteYear = isBC ? year.slice(1) : year;
  const paddedYear = absoluteYear.padStart(4, '0');
  const parts = monthDayTime.split('T');
  if (parts.length < 2) return undefined;
  
  const dateParts = parts[0].split('-');
  const monthDay = dateParts.length > 2 ? `${dateParts[1]}-${dateParts[2]}` : dateParts.join('-');
  const time = parts[1].slice(0, 5);

  if (!isBC) {
    // For AD dates, convert the local components to a proper UTC ISO string
    const localDate = new Date(`${paddedYear}-${monthDay}T${time}`);
    if (!isNaN(localDate.getTime())) {
      return localDate.toISOString();
    }
  }

  return `${paddedYear}-${monthDay} ${time}:00${isBC ? ' BC' : ''}`;
}

export function parseBCDate(isoString: string | null | undefined): { year: string, monthDayTime: string } {
  if (!isoString) {
    const now = new Date();
    const year = now.getFullYear().toString();
    // Use a stable local format YYYY-MM-DDTHH:mm
    const monthDayTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return { year, monthDayTime };
  }

  const isBC = isoString.includes(' BC') || isoString.startsWith('-');
  
  // For modern AD dates that are proper ISO strings, convert to local components
  if (!isBC && isoString.includes('T') && (isoString.endsWith('Z') || isoString.includes('+'))) {
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear().toString();
      const monthDayTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      return { year, monthDayTime };
    }
  }

  let yearStr: string;
  let rest: string;
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
  } catch {
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
