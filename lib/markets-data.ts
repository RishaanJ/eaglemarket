import { createInitialPool, type MarketPool } from "./amm";

/**
 * Market status controls whether trading is allowed.
 * LOCKED markets are visible and queryable but reject order placements.
 * OPEN markets accept trades through the AMM.
 * RESOLVED markets have settled and no longer accept trades.
 */
export type MarketStatus = "LOCKED" | "OPEN" | "RESOLVED";

/**
 * Market type indicates the category of prediction market.
 */
export type MarketType =
  | "binary"
  | "weather_high"
  | "weather_low"
  | "roster_over_under"
  | "game_moneyline";

/**
 * Extended market definition that supports the locked state and
 * additional metadata for weather and sports markets.
 */
export interface ExtendedMarket {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  type: MarketType;
  status: MarketStatus;
  pool: MarketPool;
  totalVolume: number;
  color: string;
  icon: string;
  closes: string;
  resolutionSource?: string;
  metadata?: Record<string, string | number>;
}

/**
 * Weather market generation for Fremont, CA.
 * Creates daily high/low temperature prediction markets.
 */
export function generateWeatherMarkets(dateStr: string): ExtendedMarket[] {
  const HIGH_BASELINE = 80;
  const LOW_BASELINE = 60;

  return [
    {
      id: `weather-high-${dateStr}`,
      title: `Fremont daily high above ${HIGH_BASELINE}F on ${dateStr}?`,
      description: `Resolves Yes if the official Fremont, CA high temperature reaches ${HIGH_BASELINE + 0.1}F or above. Based on official weather reporting at 11:59 PM PST.`,
      category: "Weather",
      type: "weather_high",
      status: "LOCKED",
      pool: createInitialPool(1000),
      totalVolume: 0,
      color: "#e8a838",
      icon: "Thermometer",
      closes: `Resolves ${dateStr} 11:59 PM PST`,
      resolutionSource: "Official Fremont, CA weather reporting",
      metadata: { baseline: HIGH_BASELINE, unit: "F" },
    },
    {
      id: `weather-low-${dateStr}`,
      title: `Fremont daily low above ${LOW_BASELINE}F on ${dateStr}?`,
      description: `Resolves Yes if the official Fremont, CA low temperature reaches ${LOW_BASELINE + 0.1}F or above. Based on official weather reporting at 11:59 PM PST.`,
      category: "Weather",
      type: "weather_low",
      status: "LOCKED",
      pool: createInitialPool(1000),
      totalVolume: 0,
      color: "#5a9bd5",
      icon: "Thermometer",
      closes: `Resolves ${dateStr} 11:59 PM PST`,
      resolutionSource: "Official Fremont, CA weather reporting",
      metadata: { baseline: LOW_BASELINE, unit: "F" },
    },
  ];
}

/**
 * Roster over/under market for a sport program.
 */
export function createRosterMarket(
  sport: string,
  threshold: number,
  color: string,
  icon: string
): ExtendedMarket {
  const sportSlug = sport.toLowerCase().replace(/\s+/g, "-");
  return {
    id: `roster-${sportSlug}`,
    title: `${sport}: Over/Under ${threshold} athletes on roster?`,
    description: `Resolves Yes if the official ${sport} roster at American High School lists more than ${threshold} athletes. Resolves No if ${threshold} or fewer.`,
    category: "Sports",
    subcategory: sport,
    type: "roster_over_under",
    status: "LOCKED",
    pool: createInitialPool(1000),
    totalVolume: 0,
    color,
    icon,
    closes: "Resolves at roster lock date",
    resolutionSource: "Official AHS athletics roster",
    metadata: { threshold, sport },
  };
}

/**
 * Game moneyline market for a specific matchup.
 */
export function createGameMarket(
  sport: string,
  opponent: string,
  date: string,
  isHome: boolean,
  color: string,
  icon: string
): ExtendedMarket {
  const sportSlug = sport.toLowerCase().replace(/\s+/g, "-");
  const opponentSlug = opponent.toLowerCase().replace(/\s+/g, "-");
  const locationPrefix = isHome ? "vs." : "@";
  return {
    id: `game-${sportSlug}-${opponentSlug}-${date.replace(/[\s,]+/g, "-").toLowerCase()}`,
    title: `${sport}: AHS ${locationPrefix} ${opponent} (${date})`,
    description: `Resolves Yes if American High School defeats ${opponent} on ${date}. 50/50 opening moneyline.`,
    category: "Sports",
    subcategory: sport,
    type: "game_moneyline",
    status: "LOCKED",
    pool: createInitialPool(1000),
    totalVolume: 0,
    color,
    icon,
    closes: `Resolves after game on ${date}`,
    resolutionSource: "Official game result",
    metadata: { opponent, date, home: isHome ? "yes" : "no", sport },
  };
}

// ---------------------------------------------------------------------------
// Fall 2025 Sports Market Data
// Schedule data sourced from MaxPreps, Athletic.net, SBLive Sports, and
// American High School Athletic Department records.
// American High School competes in the Mission Valley Athletic League (MVAL).
// ---------------------------------------------------------------------------

// Sport color palette
const SPORT_COLORS: Record<string, string> = {
  "Football": "#8b4513",
  "Girls Flag Football": "#c75b9b",
  "Cross Country": "#6b8e23",
  "Girls Volleyball": "#9370db",
  "Girls Tennis": "#e0a526",
  "Girls Golf": "#2e8b57",
  "Boys Water Polo": "#1e90ff",
  "Girls Water Polo": "#ff6b8a",
};

// Sport icon mapping (lucide icon names)
const SPORT_ICONS: Record<string, string> = {
  "Football": "Trophy",
  "Girls Flag Football": "Flag",
  "Cross Country": "Footprints",
  "Girls Volleyball": "Trophy",
  "Girls Tennis": "Trophy",
  "Girls Golf": "Trophy",
  "Boys Water Polo": "Waves",
  "Girls Water Polo": "Waves",
};

// Roster over/under thresholds based on typical CIF Division 2/3 public HS
// rosters for a school of American HS's size (~2,100 students).
const ROSTER_THRESHOLDS: Record<string, number> = {
  "Football": 41.5,
  "Girls Flag Football": 19.5,
  "Cross Country": 26.5,
  "Girls Volleyball": 13.5,
  "Girls Tennis": 14.5,
  "Girls Golf": 7.5,
  "Boys Water Polo": 14.5,
  "Girls Water Polo": 14.5,
};

interface GameEntry {
  opponent: string;
  date: string;
  home: boolean;
}

// ---------------------------------------------------------------------------
// Football - WACC / MVAL (verified schedule)
// ---------------------------------------------------------------------------
const FOOTBALL_SCHEDULE: GameEntry[] = [
  { opponent: "James Lick", date: "Aug 29", home: true },
  { opponent: "Kennedy", date: "Sep 5", home: false },
  { opponent: "Washington", date: "Sep 26", home: false },
  { opponent: "San Lorenzo", date: "Oct 17", home: false },
  { opponent: "Encinal", date: "Oct 24", home: true },
  { opponent: "Arroyo", date: "Nov 1", home: true },
  { opponent: "Mt. Eden", date: "Nov 8", home: true },
];

// ---------------------------------------------------------------------------
// Girls Flag Football - MVAL (7-on-7 format, double round-robin)
// ---------------------------------------------------------------------------
const GIRLS_FLAG_FOOTBALL_SCHEDULE: GameEntry[] = [
  { opponent: "Washington", date: "Aug 28", home: true },
  { opponent: "Kennedy", date: "Sep 4", home: false },
  { opponent: "Irvington", date: "Sep 11", home: true },
  { opponent: "Mission San Jose", date: "Sep 18", home: false },
  { opponent: "Moreau Catholic", date: "Sep 25", home: true },
  { opponent: "Newark Memorial", date: "Oct 2", home: false },
  { opponent: "Washington", date: "Oct 9", home: false },
  { opponent: "Kennedy", date: "Oct 14", home: true },
  { opponent: "Irvington", date: "Oct 16", home: false },
  { opponent: "Mission San Jose", date: "Oct 21", home: true },
  { opponent: "Moreau Catholic", date: "Oct 23", home: false },
  { opponent: "Newark Memorial", date: "Oct 28", home: true },
];

// ---------------------------------------------------------------------------
// Cross Country - MVAL (meets at Quarry Lakes Regional Rec Area)
// ---------------------------------------------------------------------------
const CROSS_COUNTRY_SCHEDULE: GameEntry[] = [
  { opponent: "MVAL League Opener (All MVAL Schools)", date: "Sep 3", home: false },
  { opponent: "MVAL Meet 1 (Quarry Lakes)", date: "Sep 10", home: false },
  { opponent: "MVAL Meet 2 (Quarry Lakes)", date: "Oct 1", home: false },
  { opponent: "MVAL Meet 3 (Quarry Lakes)", date: "Oct 15", home: false },
  { opponent: "MVAL Championships (Quarry Lakes)", date: "Nov 5", home: false },
  { opponent: "NCS Championships (Hayward HS)", date: "Nov 22", home: false },
];

// ---------------------------------------------------------------------------
// Girls Volleyball - MVAL (verified from MaxPreps)
// ---------------------------------------------------------------------------
const GIRLS_VOLLEYBALL_SCHEDULE: GameEntry[] = [
  { opponent: "Newark Memorial", date: "Sep 9", home: true },
  { opponent: "Irvington", date: "Sep 11", home: false },
  { opponent: "Mission San Jose", date: "Sep 16", home: true },
  { opponent: "Kennedy", date: "Sep 18", home: false },
  { opponent: "Moreau Catholic", date: "Sep 23", home: true },
  { opponent: "Irvington", date: "Oct 7", home: true },
  { opponent: "Mission San Jose", date: "Oct 9", home: false },
  { opponent: "Moreau Catholic", date: "Oct 16", home: false },
  { opponent: "Washington", date: "Oct 23", home: true },
];

// ---------------------------------------------------------------------------
// Girls Tennis - MVAL (dual match format: 4 Singles + 3 Doubles)
// ---------------------------------------------------------------------------
const GIRLS_TENNIS_SCHEDULE: GameEntry[] = [
  { opponent: "Washington", date: "Sep 3", home: true },
  { opponent: "Mission San Jose", date: "Sep 10", home: false },
  { opponent: "Irvington", date: "Sep 17", home: true },
  { opponent: "Kennedy", date: "Sep 24", home: false },
  { opponent: "Moreau Catholic", date: "Oct 1", home: true },
  { opponent: "Newark Memorial", date: "Oct 8", home: false },
  { opponent: "Washington", date: "Oct 15", home: false },
  { opponent: "Mission San Jose", date: "Oct 17", home: true },
  { opponent: "Irvington", date: "Oct 22", home: false },
  { opponent: "Kennedy", date: "Oct 24", home: true },
  { opponent: "Moreau Catholic", date: "Oct 29", home: false },
  { opponent: "Newark Memorial", date: "Oct 31", home: true },
];

// ---------------------------------------------------------------------------
// Girls Golf - MVAL (9-hole dual matches, top 5 scores count)
// ---------------------------------------------------------------------------
const GIRLS_GOLF_SCHEDULE: GameEntry[] = [
  { opponent: "Mission San Jose", date: "Sep 4", home: true },
  { opponent: "Washington", date: "Sep 11", home: false },
  { opponent: "Irvington", date: "Sep 18", home: true },
  { opponent: "Moreau Catholic", date: "Sep 25", home: false },
  { opponent: "Newark Memorial", date: "Oct 2", home: true },
  { opponent: "Kennedy", date: "Oct 9", home: false },
  { opponent: "MVAL League Tournament", date: "Oct 23", home: false },
];

// ---------------------------------------------------------------------------
// Boys Water Polo - MVAL (pool venues: Silliman / Fremont Aquatic Center)
// ---------------------------------------------------------------------------
const BOYS_WATER_POLO_SCHEDULE: GameEntry[] = [
  { opponent: "Washington", date: "Sep 3", home: true },
  { opponent: "Mission San Jose", date: "Sep 10", home: false },
  { opponent: "Irvington", date: "Sep 17", home: true },
  { opponent: "Moreau Catholic", date: "Sep 24", home: false },
  { opponent: "Newark Memorial", date: "Oct 1", home: true },
  { opponent: "Washington", date: "Oct 8", home: false },
  { opponent: "Mission San Jose", date: "Oct 15", home: true },
  { opponent: "Irvington", date: "Oct 22", home: false },
  { opponent: "Moreau Catholic", date: "Oct 29", home: true },
  { opponent: "Newark Memorial", date: "Nov 3", home: false },
];

// ---------------------------------------------------------------------------
// Girls Water Polo - MVAL (pool venues: Silliman / Fremont Aquatic Center)
// ---------------------------------------------------------------------------
const GIRLS_WATER_POLO_SCHEDULE: GameEntry[] = [
  { opponent: "Washington", date: "Sep 4", home: true },
  { opponent: "Mission San Jose", date: "Sep 11", home: false },
  { opponent: "Irvington", date: "Sep 18", home: true },
  { opponent: "Moreau Catholic", date: "Sep 25", home: false },
  { opponent: "Newark Memorial", date: "Oct 2", home: true },
  { opponent: "Washington", date: "Oct 9", home: false },
  { opponent: "Mission San Jose", date: "Oct 16", home: true },
  { opponent: "Irvington", date: "Oct 23", home: false },
  { opponent: "Moreau Catholic", date: "Oct 30", home: true },
  { opponent: "Newark Memorial", date: "Nov 4", home: false },
];

/**
 * Generates all roster over/under markets for fall sports.
 */
export function generateAllRosterMarkets(): ExtendedMarket[] {
  return Object.entries(ROSTER_THRESHOLDS).map(([sport, threshold]) =>
    createRosterMarket(
      sport,
      threshold,
      SPORT_COLORS[sport] || "#666666",
      SPORT_ICONS[sport] || "Trophy"
    )
  );
}

/**
 * Generates all game moneyline markets for a given sport and schedule.
 */
function generateGameMarkets(sport: string, schedule: GameEntry[]): ExtendedMarket[] {
  const color = SPORT_COLORS[sport] || "#666666";
  const icon = SPORT_ICONS[sport] || "Trophy";
  return schedule.map((game) =>
    createGameMarket(sport, game.opponent, game.date, game.home, color, icon)
  );
}

/**
 * Generates all fall sports game moneyline markets.
 */
export function generateAllGameMarkets(): ExtendedMarket[] {
  return [
    ...generateGameMarkets("Football", FOOTBALL_SCHEDULE),
    ...generateGameMarkets("Girls Flag Football", GIRLS_FLAG_FOOTBALL_SCHEDULE),
    ...generateGameMarkets("Cross Country", CROSS_COUNTRY_SCHEDULE),
    ...generateGameMarkets("Girls Volleyball", GIRLS_VOLLEYBALL_SCHEDULE),
    ...generateGameMarkets("Girls Tennis", GIRLS_TENNIS_SCHEDULE),
    ...generateGameMarkets("Girls Golf", GIRLS_GOLF_SCHEDULE),
    ...generateGameMarkets("Boys Water Polo", BOYS_WATER_POLO_SCHEDULE),
    ...generateGameMarkets("Girls Water Polo", GIRLS_WATER_POLO_SCHEDULE),
  ];
}

/**
 * Returns all fall markets: weather (today + tomorrow) + roster + game moneylines.
 * All initialized in LOCKED status.
 */
export function getAllFallMarkets(): ExtendedMarket[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  return [
    ...generateWeatherMarkets(fmt(today)),
    ...generateWeatherMarkets(fmt(tomorrow)),
    ...generateAllRosterMarkets(),
    ...generateAllGameMarkets(),
  ];
}
