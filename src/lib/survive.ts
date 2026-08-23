import snapshot from "@/data/living.json";

export const CITY_SLUGS = {
  mumbai: "Mumbai",
  delhi: "Delhi",
  bangalore: "Bangalore",
  hyderabad: "Hyderabad",
  pune: "Pune",
  chennai: "Chennai",
  kolkata: "Kolkata",
  ahmedabad: "Ahmedabad",
  gurgaon: "Gurgaon",
  noida: "Noida",
  jaipur: "Jaipur",
  chandigarh: "Chandigarh",
  kochi: "Kochi",
  lucknow: "Lucknow",
  indore: "Indore",
  bhopal: "Bhopal",
  nagpur: "Nagpur",
  coimbatore: "Coimbatore",
  goa: "Goa",
  surat: "Surat",
} as const;

export type CityId = keyof typeof CITY_SLUGS;

export type FamilySize = 1 | 2 | 3 | 4;
export type Mark = "✅" | "⚠️" | "❌" | "💀" | "☠️";
export type LineKey =
  | "rent"
  | "food"
  | "school"
  | "car"
  | "savings"
  | "dating"
  | "weekend";

export type CityCosts = {
  id: CityId;
  name: string;
  url?: string;
  rent: number[];
  foodPerPerson: number;
  school?: number;
  car: number;
  commute: number;
  utilities: number;
  dating: number;
  weekend: number;
  raw?: { rent1Outside?: number };
};

export type LivedCosts = {
  rent: number;
  food: number;
  transport: number;
  utilities: number;
  school: number;
  dating: number;
  weekend: number;
};

export type LivingFile = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  cities: Record<string, CityCosts>;
};

export const CITY_ORDER = Object.keys(CITY_SLUGS) as CityId[];

export type Tone = "hold" | "tight" | "break" | "void";

export function lineTone(mark: Mark): Tone {
  if (mark === "✅") return "hold";
  if (mark === "⚠️") return "tight";
  if (mark === "❌") return "break";
  return "void";
}

export function toneCopy(tone: Tone): string {
  if (tone === "hold") return "Holds";
  if (tone === "tight") return "Tight";
  if (tone === "break") return "Breaks";
  return "Gone";
}

export const LINE_LABELS: Record<LineKey, string> = {
  rent: "Rent",
  food: "Food",
  school: "Education",
  car: "Transport",
  savings: "Savings",
  dating: "Dating",
  weekend: "Weekend plans",
};

export function kidsInFamily(family: FamilySize): number {
  return family >= 3 ? family - 2 : 0;
}

/** Mid CBSE private / child / month. Not Numbeo international. */
function schoolPerChild(city: CityCosts): number {
  if (city.school) return city.school;
  // ponytail: rent+food blend until a live city fee lands on CityCosts.school
  return Math.round(city.foodPerPerson * 0.5 + (city.rent[0] ?? 0) * 0.1);
}

export function citiesFromLiving(data: LivingFile): CityCosts[] {
  return CITY_ORDER.flatMap((id) => {
    const city = data.cities[id];
    return city ? [city as CityCosts] : [];
  });
}

export const CITIES = citiesFromLiving(snapshot as unknown as LivingFile);

function cityById(cities: CityCosts[], id: CityId): CityCosts {
  const city = cities.find((c) => c.id === id);
  if (!city) throw new Error(`Unknown city: ${id}`);
  return city;
}

function markRent(rent: number, salary: number): Mark {
  const share = rent / salary;
  if (share > 0.4) return "❌";
  if (share > 0.3) return "⚠️";
  return "✅";
}

function markFood(food: number, salary: number): Mark {
  const share = food / salary;
  if (share > 0.35) return "❌";
  if (share > 0.22) return "⚠️";
  return "✅";
}

function markCar(
  rent: number,
  food: number,
  school: number,
  car: number,
  salary: number,
): Mark {
  if (rent + food + school + car > salary) return "❌";
  if (salary - rent - food - school - car < salary * 0.1) return "⚠️";
  return "✅";
}

function markSchool(school: number, salary: number): Mark {
  if (school <= 0) return "✅";
  const share = school / salary;
  if (share > 0.25) return "❌";
  if (share > 0.15) return "⚠️";
  return "✅";
}

function markSavings(left: number, salary: number): Mark {
  const share = left / salary;
  if (share < 0.08) return "💀";
  if (share < 0.18) return "⚠️";
  return "✅";
}

function markDating(left: number, dating: number): Mark {
  if (left < dating * 0.4) return "❌";
  if (left < dating) return "⚠️";
  return "✅";
}

function markWeekend(leftAfterDating: number, weekend: number): Mark {
  if (leftAfterDating <= 0) return "☠️";
  if (leftAfterDating < weekend) return "⚠️";
  return "✅";
}

export type Line = {
  key: LineKey;
  label: string;
  amount: number;
  low: number;
  high: number;
  mark: Mark;
};

export type Survival = {
  city: CityCosts;
  salary: number;
  family: FamilySize;
  lines: Record<LineKey, Line>;
  leftover: number;
  survives: boolean;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.round(Math.min(hi, Math.max(lo, n)));
}

function nice(n: number): number {
  const step = Math.abs(n) >= 20_000 ? 1000 : 500;
  return Math.round(n / step) * step;
}

function span(mid: number, spread = 0.22): { low: number; high: number } {
  if (mid <= 0) return { low: 0, high: 0 };
  return {
    low: nice(mid * (1 - spread)),
    high: nice(Math.max(mid * (1 + spread), mid + 500)),
  };
}

function cityRentBand(
  city: CityCosts,
  salary: number,
  family: FamilySize,
): { low: number; high: number } {
  const outside = city.raw?.rent1Outside ?? city.rent[0] * 0.58;
  const centre = city.rent[0] ?? outside;
  const familyAsk = city.rent[family - 1] ?? city.rent.at(-1) ?? centre;
  if (family >= 3) {
    const low = nice(familyAsk * 0.4);
    return { low, high: nice(Math.max(familyAsk * 0.75, low + 5000)) };
  }
  const low = nice(outside * 0.55);
  const high = nice(
    salary >= 150_000 ? centre : Math.max(outside * 1.1, low + 5000),
  );
  return { low, high };
}

function lineOf(
  key: LineKey,
  amount: number,
  mark: Mark,
  low = amount,
  high = amount,
): Line {
  return { key, label: LINE_LABELS[key], amount, low, high, mark };
}

function bandFor(salary: number, family: FamilySize): "economy" | "mid" | "ok" {
  const per = salary / family;
  if (salary <= 55_000 || per < 30_000) return "economy";
  if (salary <= 120_000 || per < 60_000) return "mid";
  return "ok";
}

/** What a household on this salary would actually spend — not city-centre listings. */
export function humanize(
  city: CityCosts,
  salary: number,
  family: FamilySize,
): LivedCosts {
  const band = bandFor(salary, family);
  const outside = city.raw?.rent1Outside ?? city.rent[0] * 0.58;
  const centre = city.rent[0] ?? outside;
  const familyAsk = city.rent[family - 1] ?? city.rent.at(-1) ?? centre;
  let ask = outside;
  if (family === 1) {
    ask = band === "economy" ? outside * 0.52 : band === "mid" ? outside * 0.85 : centre;
  } else if (family === 2) {
    ask = band === "economy" ? outside * 0.75 : band === "mid" ? outside : centre * 1.05;
  } else {
    ask = band === "ok" ? familyAsk * 0.7 : familyAsk * 0.5;
  }
  const rent = clamp(ask, salary * 0.12, salary * (family >= 3 ? 0.32 : 0.3));
  const foodMul = band === "economy" ? 0.62 : band === "mid" ? 0.78 : 0.92;
  const food = clamp(
    city.foodPerPerson * foodMul * family,
    3500 * family,
    salary * 0.28,
  );
  const transport =
    band === "ok" && salary >= 150_000
      ? clamp(city.commute + 8000, 5000, 14_000)
      : band === "mid"
        ? clamp(city.commute + 2200, 2500, 5500)
        : clamp(Math.max(city.commute, 1800), 1500, 3500);
  const utilities = clamp(
    city.utilities * (family === 1 ? 0.7 : 0.9),
    1500,
    6000,
  );
  const school = clamp(
    schoolPerChild(city) * kidsInFamily(family),
    0,
    salary * 0.18,
  );
  const pay = salary / 50_000;
  const datingMul =
    family >= 3 ? 0.4 : band === "economy" ? 0.55 : band === "mid" ? 0.85 : 1.15;
  const dating = Math.round(city.dating * pay * datingMul);
  const weekend = Math.round(
    city.weekend * pay * (family === 1 ? 0.7 : 0.5 + family * 0.08),
  );
  return { rent, food, transport, utilities, school, dating, weekend };
}

export function clampLived(
  lived: LivedCosts,
  salary: number,
  family: FamilySize,
): LivedCosts {
  return {
    rent: Math.max(0, Math.round(lived.rent)),
    food: clamp(lived.food, 3500 * family, salary * 0.28),
    transport: clamp(
      lived.transport,
      1500,
      salary < 100_000 ? 5500 : 14_000,
    ),
    utilities: clamp(lived.utilities, 1500, 6000),
    school: kidsInFamily(family)
      ? clamp(lived.school, 2500 * kidsInFamily(family), salary * 0.18)
      : 0,
    dating: clamp(lived.dating, salary * 0.02, salary * 0.07),
    weekend: clamp(lived.weekend, salary * 0.02, salary * 0.07),
  };
}

export function simulate(
  cityId: CityId,
  salary: number,
  family: FamilySize,
  cities: CityCosts[] = CITIES,
  overlay?: Partial<LivedCosts>,
): Survival {
  const city = cityById(cities, cityId);
  const base = humanize(city, salary, family);
  const ai = { ...overlay };
  delete ai.dating;
  delete ai.weekend;
  const lived = clampLived({ ...base, ...ai }, salary, family);
  const { food, transport, utilities, school, dating, weekend } = lived;
  const rent = cityRentBand(city, salary, family);
  const foods = span(food);
  const transit = span(transport, 0.2);
  const bills = span(utilities, 0.15);
  const edu = span(school, 0.18);
  const dates = span(dating, 0.2);
  const weekends = span(weekend, 0.2);
  const mustHigh =
    rent.high + foods.high + edu.high + transit.high + bills.high;
  const mustLow = rent.low + foods.low + edu.low + transit.low + bills.low;
  const leftover = salary - mustHigh;
  const leftoverBest = salary - mustLow;
  const afterDating = leftover - Math.min(dates.high, Math.max(leftover, 0));

  const lines: Record<LineKey, Line> = {
    rent: lineOf("rent", nice((rent.low + rent.high) / 2), markRent(rent.high, salary), rent.low, rent.high),
    food: lineOf("food", food, markFood(foods.high, salary), foods.low, foods.high),
    school: lineOf("school", school, markSchool(edu.high, salary), edu.low, edu.high),
    car: lineOf("car", transport, markCar(rent.high, foods.high, edu.high, transit.high, salary), transit.low, transit.high),
    savings: lineOf("savings", leftover, markSavings(leftover, salary), leftover, leftoverBest),
    dating: lineOf("dating", dating, markDating(leftover, dates.high), dates.low, dates.high),
    weekend: lineOf("weekend", weekend, markWeekend(afterDating, weekends.high), weekends.low, weekends.high),
  };

  const survives =
    lines.rent.mark !== "❌" &&
    lines.food.mark !== "❌" &&
    lines.school.mark !== "❌" &&
    lines.savings.mark !== "💀";

  return { city, salary, family, lines, leftover, survives };
}

export function rupees(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;
}

export function rupeesRange(low: number, high: number): string {
  if (low === high) return rupees(low);
  return `${rupees(low)} – ${rupees(high)}`;
}

export async function loadGeminiLived(
  salary: number,
  family: FamilySize,
  cities: CityCosts[],
): Promise<Partial<Record<CityId, LivedCosts>> | null> {
  try {
    const res = await fetch("/live/humanize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        salary,
        family,
        cities: cities.map((c) => ({
          id: c.id,
          name: c.name,
          marketRent: c.rent[0],
          outside: c.raw?.rent1Outside ?? Math.round(c.rent[0] * 0.58),
          foodPerPerson: c.foodPerPerson,
          commute: c.commute,
          utilities: c.utilities,
        })),
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Record<CityId, LivedCosts>>;
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

export function assertSurvivalExample(): void {
  const broke = simulate("bangalore", 25_000, 1);
  if (broke.survives) throw new Error("25k Bangalore cannot survive");
  const r = simulate("bangalore", 50_000, 1);
  if (r.lines.car.high > 6_000) {
    throw new Error("50k transport is metro/bike, not a car");
  }
  if (r.lines.school.amount !== 0) throw new Error("solo pays no school");
  const gur = simulate("gurgaon", 50_000, 1);
  if (gur.lines.rent.low < 9_000 || gur.lines.rent.high < 18_000) {
    throw new Error("50k Gurgaon rent should land near 10–20k");
  }
  const family = simulate("bangalore", 80_000, 3);
  if (family.lines.school.amount <= 0) throw new Error("family of 3 needs school");
  const richer = simulate("bangalore", 150_000, 1);
  if (richer.lines.dating.amount <= r.lines.dating.amount) {
    throw new Error("dating must rise with salary");
  }
  if (richer.lines.weekend.amount <= r.lines.weekend.amount) {
    throw new Error("weekend must rise with salary");
  }
}
