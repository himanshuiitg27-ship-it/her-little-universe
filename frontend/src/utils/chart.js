// Fixed mid-tone pastels read well on both the light and dark themes.
export const COLORS = {
  blush: '#f78aae',
  lavender: '#a287ec',
  sage: '#7aad82',
  butter: '#f3c969',
  grid: 'rgba(160,140,170,0.22)',
  tick: '#9c8aa2',
}
export const PIE_COLORS = [COLORS.blush, COLORS.lavender, COLORS.sage, COLORS.butter, '#8fc5e8', '#f4a97f']
export const tickProps = { fill: COLORS.tick, fontSize: 12, fontWeight: 600 }
export const tooltipStyle = {
  contentStyle: { background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 16, boxShadow: '0 8px 24px rgba(120,70,100,.12)', color: 'rgb(var(--ink))', fontWeight: 600, fontSize: 13 },
  cursor: { fill: 'rgba(247,138,174,0.1)' },
}
