// Draws the last 60 days of contributions as an animated area chart (dark + light SVG).
const fs = require('fs');
const user = process.env.GH_USER, token = process.env.GITHUB_TOKEN, out = process.argv[2] || 'dist';
const DAYS = 60;

async function main() {
  const to = new Date(), from = new Date(to - 90 * 864e5);
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($u:String!,$f:DateTime!,$t:DateTime!){user(login:$u){contributionsCollection(from:$f,to:$t){contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`,
      variables: { u: user, f: from.toISOString(), t: to.toISOString() },
    }),
  });
  const json = await res.json();
  const weeks = json.data.user.contributionsCollection.contributionCalendar.weeks;
  const days = weeks.flatMap(w => w.contributionDays).filter(d => new Date(d.date) <= to).slice(-DAYS);
  const total = days.reduce((s, d) => s + d.contributionCount, 0);

  const W = 900, H = 220, L = 44, R = 20, T = 44, B = 36, iw = W - L - R, ih = H - T - B;
  const max = Math.max(4, ...days.map(d => d.contributionCount));
  const x = i => L + (i / (days.length - 1)) * iw, y = v => T + ih - (v / max) * ih;
  const pts = days.map((d, i) => [x(i), y(d.contributionCount)]);
  const line = pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`).join('');
  const area = `${line}L${x(days.length - 1)} ${T + ih}L${L} ${T + ih}Z`;
  const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

  const themes = {
    dark: { bg: '#0d1117', text: '#e6edf3', sub: '#8b949e', grid: '#21262d', a: '#22d3ee', b: '#a78bfa' },
    light: { bg: '#ffffff', text: '#1f2328', sub: '#656d76', grid: '#eaeef2', a: '#0891b2', b: '#7c3aed' },
  };
  fs.mkdirSync(out, { recursive: true });
  for (const [name, c] of Object.entries(themes)) {
    const grid = [0, 0.5, 1].map(f => { const gy = T + ih - f * ih; return `<line x1="${L}" x2="${W - R}" y1="${gy}" y2="${gy}" stroke="${c.grid}"/><text x="${L - 8}" y="${gy + 4}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${c.sub}">${Math.round(f * max)}</text>`; }).join('');
    const dots = pts.map(([a, b], i) => days[i].contributionCount ? `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="3" fill="${c.bg}" stroke="${c.a}" stroke-width="2" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="${(2 + i / days.length * 2).toFixed(2)}s" dur="0.3s" fill="freeze"/></circle>` : '').join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${total} contributions in the last ${DAYS} days">
<defs><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-color="${c.a}"/><stop offset="1" stop-color="${c.b}"/></linearGradient>
<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.b}" stop-opacity="0.35"/><stop offset="1" stop-color="${c.b}" stop-opacity="0"/></linearGradient></defs>
<text x="${L}" y="24" font-family="${MONO}" font-size="14" font-weight="700" fill="${c.text}">${total} contributions</text>
<text x="${W - R}" y="24" text-anchor="end" font-family="${MONO}" font-size="12" fill="${c.sub}">last ${DAYS} days</text>
${grid}
<path d="${area}" fill="url(#f)" opacity="0"><animate attributeName="opacity" from="0" to="1" begin="1.2s" dur="1.5s" fill="freeze"/></path>
<path d="${line}" fill="none" stroke="url(#s)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"><animate attributeName="stroke-dashoffset" from="1" to="0" dur="2.5s" fill="freeze"/></path>
${dots}
<text x="${L}" y="${H - 10}" font-family="${MONO}" font-size="11" fill="${c.sub}">${fmt(days[0].date)}</text>
<text x="${W - R}" y="${H - 10}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${c.sub}">${fmt(days[days.length - 1].date)}</text>
</svg>`;
    fs.writeFileSync(`${out}/activity-${name}.svg`, svg);
  }
  console.log(`wrote activity graphs: ${total} contributions`);
}
main().catch(e => { console.error(e); process.exit(1); });
