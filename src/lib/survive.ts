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
  const dating = family >= 3
    ? Math.round(city.dating * 0.4)
    : band === "economy"
      ? Math.round(city.dating * 0.55)
      : city.dating;
  const weekend = Math.round(
    city.weekend * (family === 1 ? 0.7 : 0.55 + family * 0.08),
  );
  return { rent, food, transport, utilities, school, dating, weekend };
}

export function clampLived(
  lived: LivedCosts,
  salary: number,
  family: FamilySize,
): LivedCosts {
  return {
    rent: clamp(lived.rent, salary * 0.12, salary * 0.32),
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
    dating: clamp(lived.dating, 400, salary * 0.08),
    weekend: clamp(lived.weekend, 400, salary * 0.08),
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
  const lived = clampLived(
    { ...humanize(city, salary, family), ...overlay },
    salary,
    family,
  );
  const { rent, food, transport, utilities, school, dating, weekend } = lived;
  const leftover = salary - rent - food - school - transport - utilities;
  const afterDating = leftover - Math.min(dating, Math.max(leftover, 0));

  const lines: Record<LineKey, Line> = {
    rent: {
      key: "rent",
      label: LINE_LABELS.rent,
      amount: rent,
      mark: markRent(rent, salary),
    },
    food: {
      key: "food",
      label: LINE_LABELS.food,
      amount: food,
      mark: markFood(food, salary),
    },
    school: {
      key: "school",
      label: LINE_LABELS.school,
      amount: school,
      mark: markSchool(school, salary),
    },
    car: {
      key: "car",
      label: LINE_LABELS.car,
      amount: transport,
      mark: markCar(rent, food, school, transport, salary),
    },
    savings: {
      key: "savings",
      label: LINE_LABELS.savings,
      amount: leftover,
      mark: markSavings(leftover, salary),
    },
    dating: {
      key: "dating",
      label: LINE_LABELS.dating,
      amount: dating,
      mark: markDating(leftover, dating),
    },
    weekend: {
      key: "weekend",
      label: LINE_LABELS.weekend,
      amount: weekend,
      mark: markWeekend(afterDating, weekend),
    },
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
  const r = simulate("bangalore", 50_000, 1);
  if (r.lines.rent.amount > 13_000) {
    throw new Error("50k Bangalore rent must be share/PG, not centre 1BHK");
  }
  if (r.lines.car.amount > 5_500) {
    throw new Error("50k transport is metro/bike, not a car");
  }
  if (r.lines.food.mark === "❌") throw new Error("Bangalore food should not fail at ₹50k");
  if (r.lines.school.amount !== 0) throw new Error("solo pays no school");
  const family = simulate("bangalore", 80_000, 3);
  if (family.lines.school.amount <= 0) throw new Error("family of 3 needs school");
}
