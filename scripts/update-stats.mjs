#!/usr/bin/env node
// Generates assets/stats.svg, assets/contributions.svg and assets/languages.svg
// from the GitHub API, styled with the Flowera design system.
//
// Public stat widgets only count public repositories; nearly all of this
// account's work is private, so they report close to zero. These cards are built
// from the authenticated API instead.
//
// Usage: GH_TOKEN=<token with repo scope> node scripts/update-stats.mjs

import { writeFile, mkdir, stat } from "node:fs/promises";
import { BRAND, FONT_STACK, esc, fmt, panel, sectionLabel } from "./brand.mjs";

const TOKEN = process.env.GH_TOKEN;
const USER = process.env.GH_USER || "ely669";

if (!TOKEN) {
  console.error("GH_TOKEN is required (needs the repo scope to see private repositories)");
  process.exit(1);
}

const graphql = async (query, variables = {}) => {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
};

// --- data --------------------------------------------------------------------

async function fetchRepos() {
  const repos = [];
  let cursor = null;
  let createdAt = null;
  do {
    const data = await graphql(
      `query($user: String!, $cursor: String) {
        user(login: $user) {
          createdAt
          repositories(ownerAffiliations: OWNER, isFork: false, first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
              name isPrivate stargazerCount
              defaultBranchRef { name }
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges { size node { name } }
              }
            }
          }
        }
      }`,
      { user: USER, cursor }
    );
    createdAt = data.user.createdAt;
    const page = data.user.repositories;
    repos.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (cursor);
  return { repos, createdAt };
}

// Day-by-day contributions across every year the account has existed.
async function fetchCalendar(createdAt) {
  const startYear = new Date(createdAt).getUTCFullYear();
  const thisYear = new Date().getUTCFullYear();
  const days = new Map();
  let privateCount = 0;

  for (let year = startYear; year <= thisYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = year === thisYear ? new Date().toISOString() : `${year}-12-31T23:59:59Z`;
    const data = await graphql(
      `query($user: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $user) {
          contributionsCollection(from: $from, to: $to) {
            restrictedContributionsCount
            contributionCalendar {
              totalContributions
              weeks { contributionDays { date contributionCount } }
            }
          }
        }
      }`,
      { user: USER, from, to }
    );
    const c = data.user.contributionsCollection;
    privateCount += c.restrictedContributionsCount;
    for (const week of c.contributionCalendar.weeks) {
      for (const day of week.contributionDays) {
        days.set(day.date, day.contributionCount);
      }
    }
  }
  return { days, privateCount };
}

// One request per repo: asking for a single commit per page makes the "last"
// page number in the Link header the commit count.
async function countCommits(repos) {
  let commits = 0;
  for (const repo of repos) {
    if (!repo.defaultBranchRef) continue;
    const res = await fetch(
      `https://api.github.com/repos/${USER}/${repo.name}/commits?author=${USER}&per_page=1`,
      { headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) continue;
    const link = res.headers.get("link");
    const match = link && link.match(/[?&]page=(\d+)>; rel="last"/);
    if (match) {
      commits += Number(match[1]);
    } else {
      const body = await res.json();
      commits += Array.isArray(body) ? body.length : 0;
    }
  }
  return commits;
}

function streaks(days) {
  const dates = [...days.keys()].sort();
  let longest = 0;
  let run = 0;
  for (const date of dates) {
    if (days.get(date) > 0) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 0;
    }
  }
  // Current streak: walk back from today, tolerating a still-empty today.
  let current = 0;
  const cursor = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  if ((days.get(iso(cursor)) || 0) === 0) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while ((days.get(iso(cursor)) || 0) > 0) {
    current += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return { current, longest };
}

// --- cards -------------------------------------------------------------------

function statsSvg(s) {
  const width = 1000;
  const height = 230;
  const tiles = [
    [fmt(s.contributions), "contributions"],
    [fmt(s.commits), "commits authored"],
    [fmt(s.repos), "repositories"],
    [`${s.privateShare}%`, "private codebases"],
    [fmt(s.currentStreak), "day current streak"],
    [fmt(s.longestStreak), "day longest streak"],
  ];
  const padX = 44;
  const colW = (width - padX * 2) / 3;
  const inner = [
    sectionLabel(padX, 46, "ACTIVITY — PUBLIC AND PRIVATE WORK"),
    `  <text x="${width - padX}" y="46" font-family="${FONT_STACK}" font-size="10.5" fill="${BRAND.gray}" text-anchor="end">${s.years} YEARS ON GITHUB · UPDATED ${new Date().toISOString().slice(0, 10)}</text>`,
    `  <line x1="${padX}" y1="64" x2="${width - padX}" y2="64" stroke="${BRAND.onDark}" stroke-opacity="0.07"/>`,
  ];
  tiles.forEach(([value, label], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = padX + col * colW;
    const y = 122 + row * 72;
    const accent = i === 0 ? BRAND.violetBright : BRAND.onDark;
    inner.push(
      `  <text x="${x}" y="${y}" font-family="${FONT_STACK}" font-size="38" font-weight="700" fill="${accent}">${value}</text>`,
      `  <text x="${x}" y="${y + 21}" font-family="${FONT_STACK}" font-size="12.5" fill="${BRAND.gray}">${esc(label)}</text>`
    );
  });
  return panel(width, height, inner.join("\n"), { label: "GitHub activity" });
}

function contributionsSvg(days, totalLastYear) {
  const width = 1000;
  const cell = 11;
  const gap = 3;
  const padX = 44;
  const top = 86;

  // Last 53 weeks, Sunday-aligned like GitHub's own calendar.
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 364);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const iso = (d) => d.toISOString().slice(0, 10);

  // Thresholds from the quartiles of active days: a single 300-commit day would
  // otherwise push every ordinary day into the lowest bucket.
  const active = [...days.values()].filter((c) => c > 0).sort((a, b) => a - b);
  const q = (p) => active[Math.floor((active.length - 1) * p)] || 1;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  const level = (count) => {
    if (!count) return { fill: BRAND.onDark, opacity: 0.06 };
    if (count > q3) return { fill: BRAND.violetBright, opacity: 1 };
    if (count > q2) return { fill: BRAND.violet, opacity: 0.95 };
    if (count > q1) return { fill: BRAND.violet, opacity: 0.6 };
    return { fill: BRAND.lavender, opacity: 0.38 };
  };

  const cells = [];
  const monthLabels = [];
  let seenMonth = -1;
  const cursor = new Date(start);
  for (let week = 0; week < 53; week++) {
    for (let day = 0; day < 7; day++) {
      if (cursor > end) break;
      const date = iso(cursor);
      const { fill, opacity } = level(days.get(date) || 0);
      const x = padX + week * (cell + gap);
      const y = top + day * (cell + gap);
      cells.push(
        `  <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${fill}" fill-opacity="${opacity}"><title>${date}: ${days.get(date) || 0}</title></rect>`
      );
      if (day === 0 && cursor.getUTCMonth() !== seenMonth) {
        seenMonth = cursor.getUTCMonth();
        const name = cursor.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
        monthLabels.push(
          `  <text x="${x}" y="${top - 12}" font-family="${FONT_STACK}" font-size="10.5" fill="${BRAND.gray}">${name}</text>`
        );
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const height = top + 7 * (cell + gap) + 46;
  const legendX = width - padX - 108;
  const legend = [0.06, 0.38, 0.6, 0.95, 1]
    .map((o, i) => {
      const fill = i === 0 ? BRAND.onDark : i === 1 ? BRAND.lavender : i === 4 ? BRAND.violetBright : BRAND.violet;
      return `  <rect x="${legendX + i * 16}" y="${height - 32}" width="${cell}" height="${cell}" rx="2.5" fill="${fill}" fill-opacity="${o}"/>`;
    })
    .join("\n");

  const inner = [
    sectionLabel(padX, 46, "CONTRIBUTIONS — LAST 12 MONTHS"),
    `  <text x="${width - padX}" y="46" font-family="${FONT_STACK}" font-size="10.5" fill="${BRAND.gray}" text-anchor="end">${fmt(totalLastYear)} IN THE LAST YEAR</text>`,
    `  <line x1="${padX}" y1="64" x2="${width - padX}" y2="64" stroke="${BRAND.onDark}" stroke-opacity="0.07"/>`,
    ...monthLabels,
    ...cells,
    `  <text x="${legendX - 8}" y="${height - 22}" font-family="${FONT_STACK}" font-size="10.5" fill="${BRAND.gray}" text-anchor="end">less</text>`,
    legend,
    `  <text x="${legendX + 5 * 16 + 4}" y="${height - 22}" font-family="${FONT_STACK}" font-size="10.5" fill="${BRAND.gray}">more</text>`,
  ];
  return panel(width, height, inner.join("\n"), { label: "Contribution calendar" });
}

function languagesSvg(languages, repoCount) {
  const width = 1000;
  const padX = 44;
  const barW = width - padX * 2;
  const total = languages.reduce((sum, l) => sum + l.count, 0);
  // Violet ramp, strongest first — monochrome base, brand accent for emphasis.
  const ramp = [
    BRAND.violetBright,
    BRAND.violet,
    "#8b5cf6",
    "#a78bfa",
    BRAND.lavender,
    "#d6c6f5",
    "#ffffff",
    "#d9d9d9",
    "#9e9e9e",
    BRAND.gray,
  ];

  let offset = 0;
  const bar = languages
    .map((lang, i) => {
      const w = (lang.count / total) * barW;
      const rect = `  <rect x="${(padX + offset).toFixed(1)}" y="86" width="${Math.max(w - 2, 1).toFixed(1)}" height="12" rx="6" fill="${ramp[i] || BRAND.gray}"/>`;
      offset += w;
      return rect;
    })
    .join("\n");

  const perRow = Math.ceil(languages.length / 2);
  const legend = languages
    .map((lang, i) => {
      const col = Math.floor(i / perRow);
      const row = i % perRow;
      const x = padX + col * (barW / 2);
      const y = 134 + row * 24;
      const pct = ((lang.count / total) * 100).toFixed(1);
      return `  <circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${ramp[i] || BRAND.gray}"/>
  <text x="${x + 19}" y="${y}" font-family="${FONT_STACK}" font-size="13" fill="${BRAND.onDark}" fill-opacity="0.92">${esc(lang.name)}</text>
  <text x="${x + barW / 2 - 24}" y="${y}" font-family="${FONT_STACK}" font-size="13" fill="${BRAND.gray}" text-anchor="end">${pct}% · ${lang.count} repos</text>`;
    })
    .join("\n");

  const height = 134 + perRow * 24 + 18;
  const inner = [
    sectionLabel(padX, 46, "LANGUAGES BY REPOSITORY — PRIVATE INCLUDED"),
    `  <text x="${width - padX}" y="46" font-family="${FONT_STACK}" font-size="10.5" fill="${BRAND.gray}" text-anchor="end">${total} OF ${repoCount} REPOSITORIES CLASSIFIED</text>`,
    `  <line x1="${padX}" y1="64" x2="${width - padX}" y2="64" stroke="${BRAND.onDark}" stroke-opacity="0.07"/>`,
    bar,
    legend,
  ];
  return panel(width, height, inner.join("\n"), { label: "Languages by repository" });
}

// --- main --------------------------------------------------------------------

const { repos, createdAt } = await fetchRepos();

// Second line of defence: a token without the repo scope still answers every
// query, it just cannot see private repositories — which would silently rewrite
// the cards with a fraction of the real numbers.
if (!repos.some((r) => r.isPrivate)) {
  console.error(
    `Refusing to write: no private repository is visible (${repos.length} repos total).\n` +
      "GH_TOKEN needs the 'repo' scope; the default Actions token is not enough."
  );
  process.exit(1);
}
const { days, privateCount } = await fetchCalendar(createdAt);
const commits = await countCommits(repos);
const { current: currentStreak, longest: longestStreak } = streaks(days);

const contributions = [...days.values()].reduce((a, b) => a + b, 0);
const yearAgo = new Date();
yearAgo.setUTCDate(yearAgo.getUTCDate() - 365);
const lastYear = [...days.entries()]
  .filter(([date]) => new Date(date) >= yearAgo)
  .reduce((sum, [, count]) => sum + count, 0);

const byLanguage = new Map();
for (const repo of repos) {
  const top = repo.languages.edges[0];
  if (!top) continue;
  const entry = byLanguage.get(top.node.name) || { name: top.node.name, count: 0 };
  entry.count += 1;
  byLanguage.set(top.node.name, entry);
}
const languages = [...byLanguage.values()].sort((a, b) => b.count - a.count).slice(0, 10);

const stats = {
  contributions,
  commits,
  repos: repos.length,
  privateShare: Math.round((repos.filter((r) => r.isPrivate).length / repos.length) * 100),
  years: new Date().getUTCFullYear() - new Date(createdAt).getUTCFullYear(),
  currentStreak,
  longestStreak,
};

await mkdir("assets", { recursive: true });
await writeFile("assets/stats.svg", statsSvg(stats));
await writeFile("assets/contributions.svg", contributionsSvg(days, lastYear));
await writeFile("assets/languages.svg", languagesSvg(languages, repos.length));

console.log(
  `contributions=${stats.contributions} (last year ${lastYear}, ${privateCount} private) ` +
    `commits=${stats.commits} repos=${stats.repos} private=${stats.privateShare}% ` +
    `streak=${stats.currentStreak}/${stats.longestStreak}`
);
console.log(languages.map((l) => `${l.name}:${l.count}`).join(" "));
for (const f of ["assets/stats.svg", "assets/contributions.svg", "assets/languages.svg"]) {
  console.log(`  ${f} — ${((await stat(f)).size / 1024).toFixed(1)} KB`);
}
