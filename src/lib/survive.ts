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
};

export type LivingFile = {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  cities: Record<string, CityCosts>;
};

export const CITY_ORDER = Object.keys(CITY_SLUGS) as CityId[];
const SLUG = CITY_SLUGS;

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
  car: "Car",
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

export function simulate(
  cityId: CityId,
  salary: number,
  family: FamilySize,
  cities: CityCosts[] = CITIES,
): Survival {
  const city = cityById(cities, cityId);
  const rent = city.rent[family - 1] ?? city.rent.at(-1) ?? 0;
  const food = city.foodPerPerson * family;
  const school = schoolPerChild(city) * kidsInFamily(family);
  const dating = family >= 3 ? Math.round(city.dating * 0.55) : city.dating;
  const weekend = Math.round(
    city.weekend * (family === 1 ? 1 : 0.75 + family * 0.15),
  );
  const leftover =
    salary - rent - food - school - city.commute - city.utilities;
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
      amount: city.car,
      mark: markCar(rent, food, school, city.car, salary),
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

function rupee(s: string): number {
  return Number(s.replace(/,/g, ""));
}

function pick(prices: Record<string, number>, key: string): number | undefined {
  const needle = key.toLowerCase();
  for (const [name, val] of Object.entries(prices)) {
    if (name.toLowerCase().includes(needle)) return val;
  }
}

function parseNumbeo(html: string): Record<string, number> {
  const prices: Record<string, number> = {};
  const row =
    /<td[^>]*>(.*?)<\/td>\s*<td[^>]*class="priceValue[^"]*"[^>]*>\s*<span class="first_currency">(?:&#x20b9;|₹)?\s*([0-9,.]+)/gi;
  for (const match of html.matchAll(row)) {
    const name = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    prices[name] = rupee(match[2]);
  }
  return prices;
}

function deriveCity(
  id: CityId,
  html: string,
): CityCosts {
  const prices = parseNumbeo(html);
  const meal = pick(prices, "Meal at an Inexpensive Restaurant") ?? 0;
  const meal2 = pick(prices, "Meal for Two at a Mid-Range Restaurant") ?? 0;
  const cinema = pick(prices, "Cinema Ticket") ?? 0;
  const pass = pick(prices, "Monthly Public Transport Pass") ?? 0;
  const gas = pick(prices, "Gasoline (1 Liter)") ?? 100;
  const utilities = pick(prices, "Basic Utilities") ?? 0;
  const internet = pick(prices, "Broadband Internet") ?? 0;
  const rent1c = pick(prices, "1 Bedroom Apartment in City Centre") ?? 0;
  const rent3c = pick(prices, "3 Bedroom Apartment in City Centre") ?? 0;
  const rent3o = pick(prices, "3 Bedroom Apartment Outside of City Centre") ?? 0;
  const milk = pick(prices, "Milk (Regular, 1 Liter)") ?? 0;
  const bread = pick(prices, "Fresh White Bread") ?? 0;
  const rice = pick(prices, "White Rice (1 kg)") ?? 0;
  const eggs = pick(prices, "Eggs (12") ?? 0;
  const chicken = pick(prices, "Chicken Fillets") ?? 0;
  const groceries = milk * 8 + bread * 8 + rice * 4 + eggs * 2 + chicken * 3;
  const dateNight = Math.round(meal2 + cinema * 2);
  const intlYear = pick(prices, "International Primary School") ?? 0;
  return {
    id,
    name: SLUG[id],
    url: `https://www.numbeo.com/cost-of-living/in/${SLUG[id]}`,
    rent: [
      Math.round(rent1c),
      Math.round(rent1c),
      Math.round(rent3o || rent3c),
      Math.round(rent3c || rent3o),
    ],
    foodPerPerson: Math.round(groceries + meal * 20),
    school: Math.round(intlYear ? (intlYear / 12) * 0.4 : rent1c * 0.22),
    car: Math.round(gas * 80 + 6000),
    commute: Math.round(pass),
    utilities: Math.round(utilities + internet),
    dating: dateNight,
    weekend: dateNight,
  };
}

export async function loadLiveCities(): Promise<{
  cities: CityCosts[];
  source: string;
  fetchedAt: string;
} | null> {
  try {
    const pages = await Promise.all(
      CITY_ORDER.map(async (id) => {
        const res = await fetch(`/live/numbeo/${SLUG[id]}`);
        if (!res.ok) throw new Error(String(res.status));
        return deriveCity(id, await res.text());
      }),
    );
    if (pages.some((c) => !c.rent[0] || !c.foodPerPerson)) return null;
    return {
      cities: pages,
      source: "Live Numbeo city prices",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function assertSurvivalExample(): void {
  const r = simulate("bangalore", 50_000, 1);
  if (r.lines.rent.mark !== "❌") throw new Error("Bangalore rent should fail at ₹50k");
  if (r.lines.food.mark === "❌") throw new Error("Bangalore food should not fail at ₹50k");
  if (r.lines.school.amount !== 0) throw new Error("solo pays no school");
  const family = simulate("bangalore", 80_000, 3);
  if (family.lines.school.amount <= 0) throw new Error("family of 3 needs school");
  const two = simulate("bangalore", 80_000, 4);
  if (two.lines.school.amount !== family.lines.school.amount * 2) {
    throw new Error("family of 4 is two children");
  }
}
