/** Domain age maths and labels (pure; shared by the SERP badges and tests). */

/** Whole years and remaining months between a YYYY-MM-DD date and `now` (UTC). */
export function computeAge(creationDate, now = new Date()) {
  const created = new Date(`${creationDate}T00:00:00Z`);
  if (Number.isNaN(created.getTime())) return null;
  let months =
    (now.getUTCFullYear() - created.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - created.getUTCMonth());
  if (now.getUTCDate() < created.getUTCDate()) months -= 1;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months: months % 12 };
}

/** Compact badge label: "12y", "8m", "<1m". */
export function formatAgeShort(age) {
  if (!age) return 'N/A';
  if (age.years > 0) return `${age.years}y`;
  if (age.months > 0) return `${age.months}m`;
  return '<1m';
}

/** Long form for tooltips: "8 years, 7 months". */
export function formatAgeLong(age) {
  if (!age) return 'Unavailable';
  const parts = [];
  if (age.years) parts.push(`${age.years} ${age.years === 1 ? 'year' : 'years'}`);
  if (age.months) parts.push(`${age.months} ${age.months === 1 ? 'month' : 'months'}`);
  return parts.length ? parts.join(', ') : 'Less than a month';
}
