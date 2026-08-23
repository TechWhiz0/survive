import { ArrowUpRightIcon, StarFourIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useMemo, useState } from "react";
import {
  ReceiptPrinter,
  type ReceiptPrinterStage,
} from "@/components/ReceiptPrinter";
import snapshot from "@/data/living.json";
import {
  CITIES,
  type CityCosts,
  type CityId,
  type FamilySize,
  type LineKey,
  type Tone,
  lineTone,
  loadGeminiLived,
  rupees,
  rupeesRange,
  simulate,
  type LivedCosts,
  type Survival,
  toneCopy,
} from "@/lib/survive";

const FAMILY: { value: FamilySize; label: string }[] = [
  { value: 1, label: "Solo" },
  { value: 2, label: "Couple" },
  { value: 3, label: "Family of 3" },
  { value: 4, label: "Family of 4+" },
];

const LINE_ORDER: LineKey[] = [
  "rent",
  "food",
  "school",
  "car",
  "savings",
  "dating",
  "weekend",
];

function visibleLines(result: Survival): LineKey[] {
  return LINE_ORDER.filter((key) => key !== "school" || result.family >= 3);
}

function usePrinter(run: number) {
  const [stage, setStage] = useState<ReceiptPrinterStage>("processing");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setStage("complete");
      return;
    }
    setStage("processing");
    const print = window.setTimeout(() => setStage("printing"), 700);
    const done = window.setTimeout(() => setStage("complete"), 700 + 1800);
    return () => {
      window.clearTimeout(print);
      window.clearTimeout(done);
    };
  }, [run]);

  return stage;
}

function shareOfSalary(amount: number, salary: number): number {
  if (salary <= 0) return 0;
  return Math.min(1, Math.max(0, amount / salary));
}

function barFill(tone: Tone): string {
  if (tone === "hold") return "#e8e0d4";
  if (tone === "tight") return "#c4784a";
  if (tone === "break") return "#c45c4a";
  return "transparent";
}

function LedgerBar({
  label,
  amount,
  low,
  high,
  salary,
  tone,
}: {
  label: string;
  amount: number;
  low: number;
  high: number;
  salary: number;
  tone: Tone;
}) {
  const width = shareOfSalary(Math.max(high, amount, 0), salary);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] tracking-[0.16em] text-[#c4b7a4]">
          {label.toUpperCase()}
        </span>
        <span className="font-serif text-lg leading-none text-[#f4efe8]">
          {rupeesRange(low, high)}
        </span>
      </div>
      <div
        aria-label={`${label} ${Math.round(width * 100)} percent of salary, ${toneCopy(tone)}`}
        className="mt-2 h-[5px] bg-[#2a2724]"
      >
        <div
          className="h-full"
          style={{
            width: `${Math.round(width * 100)}%`,
            background:
              tone === "void"
                ? "repeating-linear-gradient(90deg, #c4784a 0 4px, transparent 4px 8px)"
                : barFill(tone),
          }}
        />
      </div>
      <p className="mt-1 text-[10px] tracking-[0.18em] text-[#d2cbc2]">
        {toneCopy(tone)} · {Math.round(width * 100)}%
      </p>
    </div>
  );
}

function PressureMeter({ value, survives }: { value: number; survives: boolean }) {
  const pct = Math.min(1, Math.max(0, value));
  const r = 38;
  const c = 2 * Math.PI * r;
  return (
    <svg aria-hidden="true" className="h-28 w-28" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        fill="none"
        r={r}
        stroke="#2a2724"
        strokeWidth="6"
      />
      <circle
        cx="50"
        cy="50"
        fill="none"
        r={r}
        stroke={survives ? "#e8e0d4" : "#c4784a"}
        strokeDasharray={`${c * pct} ${c}`}
        strokeWidth="6"
        transform="rotate(-90 50 50)"
      />
      <text
        fill="#f4efe8"
        fontFamily="Cormorant Garamond, serif"
        fontSize="22"
        textAnchor="middle"
        x="50"
        y="54"
      >
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}

function ReceiptBody({ result }: { result: Survival }) {
  return (
    <div className="relative z-10 text-[13px] leading-6 text-[#1c1916]">
      <p className="text-center text-[11px] tracking-[0.28em] text-[#4a453f]">
        SURVIVEBRO
      </p>
      <p className="mt-4 text-center font-serif text-4xl leading-none text-[#1c1916]">
        {result.city.name}
      </p>
      <p className="mt-2 text-center text-[#4a453f]">
        {rupees(result.salary)} / month
      </p>
      <p className="text-center text-[#4a453f]">
        Household: {result.family === 4 ? "4+" : result.family}
      </p>
      <div className="my-5 border-t border-dashed border-[#b7aea3]" />
      {visibleLines(result).map((key) => {
        const line = result.lines[key];
        const tone = lineTone(line.mark);
        const width = shareOfSalary(Math.max(line.amount, 0), result.salary);
        return (
          <div className="mb-2" key={key}>
            <div className="flex items-baseline justify-between gap-3">
              <span>{line.label}</span>
              <span className="text-[#4a453f]">
                {rupeesRange(line.low, line.high)} · {toneCopy(tone)}
              </span>
            </div>
            <div className="mt-1 h-[2px] bg-[#d8d0c3]">
              <div
                className="h-full bg-[#1c1916]"
                style={{ width: `${Math.round(width * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
      <div className="my-3 border-t border-dashed border-[#b7aea3]" />
      <p className="flex justify-between text-[#1c1916]">
        <span>
          Left after rent + food + transit
          {result.family >= 3 ? " + education" : ""}
        </span>
        <span>
          {rupeesRange(result.lines.savings.low, result.lines.savings.high)}
        </span>
      </p>
      <p className="mt-4 text-center font-serif text-2xl leading-none text-[#1c1916]">
        {result.survives ? "YOU SURVIVE" : "YOU DO NOT SURVIVE"}
      </p>
      <p className="mt-3 text-center text-[11px] leading-4 text-[#4a453f]">
        {result.survives
          ? "Ranges are typical monthly spend, not one listing."
          : "This salary cannot cover what the city actually asks."}
        {result.family >= 3 ? " Education is mid private, per child." : ""}
      </p>
    </div>
  );
}

function pickPeers(cities: CityCosts[], selected: CityId, count = 3): CityId[] {
  const rest = cities.filter((c) => c.id !== selected).map((c) => c.id);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return rest.slice(0, count);
}

function CityChart({
  row,
  featured,
}: {
  row: Survival;
  featured?: boolean;
}) {
  const pressure = shareOfSalary(
    row.lines.rent.high +
      row.lines.food.high +
      row.lines.school.high +
      row.lines.car.high,
    row.salary,
  );
  return (
    <article
      className={`h-full px-8 py-10 ${
        featured
          ? "border border-cream bg-[#14110e]"
          : "border border-[#3d3833] bg-[#0b0b0b]"
      }`}
    >
      <p className="text-[11px] tracking-[0.22em] text-[#d2cbc2]">
        {featured ? "SELECTED · " : ""}
        {row.city.name.toUpperCase()}
      </p>
      <div className="mt-6 flex items-center gap-4">
        <PressureMeter survives={row.survives} value={pressure} />
        <div>
          <p className="font-serif text-3xl leading-none">
            {Math.round(pressure * 100)}%
          </p>
          <p className="mt-2 text-[11px] tracking-[0.16em] text-[#c4b7a4]">
            {row.family >= 3
              ? "RENT + FOOD + EDUCATION + TRANSIT"
              : "RENT + FOOD + TRANSIT"}
          </p>
        </div>
      </div>
      <div className="mt-8 space-y-5">
        {visibleLines(row).map((key) => {
          const line = row.lines[key];
          return (
            <LedgerBar
              amount={line.amount}
              high={line.high}
              key={key}
              label={line.label}
              low={line.low}
              salary={row.salary}
              tone={lineTone(line.mark)}
            />
          );
        })}
      </div>
      <p
        className={`mt-8 border-t pt-5 text-[11px] tracking-[0.2em] ${
          row.survives
            ? "border-[#e8e0d4] text-[#e8e0d4]"
            : "border-[#c4784a] text-[#c4784a]"
        }`}
      >
        {row.survives ? "SURVIVES" : "DOES NOT HOLD"}
      </p>
    </article>
  );
}

const chip =
  "min-h-12 cursor-pointer px-5 text-sm tracking-[0.12em] transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream";

export function App() {
  const [source, setSource] = useState(snapshot.source);
  const [fetchedAt] = useState(snapshot.fetchedAt);
  const [city, setCity] = useState<CityId>("bangalore");
  const [salary, setSalary] = useState(50_000);
  const [family, setFamily] = useState<FamilySize>(1);
  const [peers, setPeers] = useState<CityId[]>([]);
  const [lived, setLived] = useState<Partial<Record<CityId, LivedCosts>>>({});
  const [run, setRun] = useState(0);
  const stage = usePrinter(run);

  useEffect(() => {
    setPeers(pickPeers(CITIES, city));
  }, [city]);

  useEffect(() => {
    let on = true;
    const band = Math.round(salary / 10_000) * 10_000;
    const t = window.setTimeout(() => {
      loadGeminiLived(band, family, CITIES).then((next) => {
        if (on && next) {
          setLived(next);
          setSource("Typical spend for this salary · Gemini-adjusted");
        }
      });
    }, 600);
    return () => {
      on = false;
      window.clearTimeout(t);
    };
  }, [salary, family]);

  const result = useMemo(
    () => simulate(city, salary, family, CITIES, lived[city]),
    [city, salary, family, lived],
  );
  const compared = useMemo(() => {
    const ids = [city, ...peers.filter((id) => id !== city)].slice(0, 4);
    return ids.map((id) => simulate(id, salary, family, CITIES, lived[id]));
  }, [city, peers, salary, family, lived]);

  function printReceipt() {
    setRun((n) => n + 1);
  }

  const fetchedLabel = fetchedAt.slice(0, 10);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050505] text-[#f4efe8]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[8%] right-[-8%] h-[640px] w-[640px] rounded-full bg-[radial-gradient(circle,rgba(196,120,74,0.28)_0%,rgba(5,5,5,0)_68%)] blur-2xl"
      />

      <header className="mx-auto flex max-w-[90rem] items-center justify-between gap-4 px-8 py-7">
        <div className="flex items-center gap-2 text-sm font-medium tracking-[0.22em]">
          <StarFourIcon size={16} weight="fill" />
          SURVIVEBRO
        </div>
        <p className="hidden text-xs tracking-[0.22em] text-[#d2cbc2] md:block">
          CITY SURVIVAL INTELLIGENCE
        </p>
        <a
          className="inline-flex min-h-12 cursor-pointer items-center gap-2 bg-cream px-5 text-xs font-medium tracking-[0.18em] text-cream-ink transition-colors duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
          href="#compare"
        >
          CITY LEDGER
          <ArrowUpRightIcon size={16} />
        </a>
      </header>

      <main className="mx-auto grid max-w-[90rem] items-start gap-16 px-8 pt-8 pb-28 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,28rem)]">
        <section>
          <p className="text-xs tracking-[0.28em] text-[#d2cbc2]">
            COST OF LIVING · INDIA · REAL SPEND
          </p>
          <h1 className="mt-6 max-w-4xl font-serif text-[clamp(3.4rem,8vw,7.2rem)] leading-[0.92] font-medium">
            Can you survive in this Indian city?
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#d2cbc2]">
            Pick a city, a monthly salary, and a household. We print what a
            person on that salary would actually pay - shared rent, home food,
            metro or bike, school for kids. Not city-centre listings.
          </p>
          <p className="mt-4 text-sm text-[#c4b7a4]">
            {source} · {fetchedLabel} ·{" "}
            <a
              className="underline decoration-[#c4b7a4]/50 underline-offset-4 hover:text-cream"
              href="https://www.numbeo.com/cost-of-living/"
              rel="noreferrer"
              target="_blank"
            >
              numbeo.com
            </a>
          </p>

          <form
            className="mt-12 space-y-10"
            onSubmit={(event) => {
              event.preventDefault();
              printReceipt();
            }}
          >
            <div>
              <label
                className="text-xs tracking-[0.22em] text-[#d2cbc2]"
                htmlFor="city"
              >
                CITY
              </label>
              <select
                className="city-select mt-4 min-h-14 w-full max-w-md cursor-pointer appearance-none border border-[#5c564e] bg-[#111] px-5 text-base text-[#faf6ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
                id="city"
                onChange={(event) => setCity(event.target.value as CityId)}
                value={city}
              >
                {CITIES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="flex items-center justify-between text-xs tracking-[0.22em] text-[#d2cbc2]"
                htmlFor="salary"
              >
                MONTHLY SALARY
                <span className="font-serif text-4xl tracking-normal text-[#f4efe8]">
                  {rupees(salary)}
                </span>
              </label>
              <input
                className="mt-5 w-full"
                id="salary"
                max={300000}
                min={25000}
                onChange={(event) => setSalary(Number(event.target.value))}
                step={5000}
                type="range"
                value={salary}
              />
            </div>

            <fieldset>
              <legend className="text-xs tracking-[0.22em] text-[#d2cbc2]">
                FAMILY SIZE
              </legend>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {FAMILY.map((option) => {
                  const active = option.value === family;
                  return (
                    <button
                      className={`${chip} ${
                        active
                          ? "bg-cream text-cream-ink"
                          : "border border-[#5c564e] text-[#f4efe8] hover:border-cream"
                      }`}
                      key={option.value}
                      onClick={() => setFamily(option.value)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button
              className="inline-flex min-h-14 cursor-pointer items-center gap-2 bg-cream px-8 text-sm font-medium tracking-[0.2em] text-cream-ink transition-colors duration-200 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream"
              type="submit"
            >
              PRINT THE RECEIPT
              <ArrowUpRightIcon size={18} />
            </button>
          </form>
        </section>

        <ReceiptPrinter.Root
          aria-label="City survival receipt"
          className="mx-auto w-full max-w-[28rem]"
          stage={stage}
        >
          <ReceiptPrinter.Machine>
            <ReceiptPrinter.Header>
              <span className="text-sm font-semibold tracking-[0.22em] text-[#161412]">
                SURVIVEBRO
              </span>
              <span className="text-sm font-semibold tracking-[0.22em] text-[#161412]">
                {result.city.name.toUpperCase()}
              </span>
            </ReceiptPrinter.Header>
            <ReceiptPrinter.Screen>
              <ReceiptPrinter.Status />
            </ReceiptPrinter.Screen>
          </ReceiptPrinter.Machine>
          <ReceiptPrinter.Output>
            <ReceiptPrinter.Paper>
              <ReceiptBody result={result} />
            </ReceiptPrinter.Paper>
          </ReceiptPrinter.Output>
        </ReceiptPrinter.Root>
      </main>

      <section className="mx-auto max-w-[90rem] px-8 pb-28" id="compare">
        <div className="mb-10 border-t border-[#3d3833] pt-12">
          <p className="text-xs tracking-[0.22em] text-[#d2cbc2]">
            YOUR CITY + 3 RANDOM
          </p>
          <h2 className="mt-4 max-w-4xl font-serif text-5xl font-medium leading-tight">
            {rupees(salary)} in {result.city.name} vs three others
          </h2>
          <p className="mt-4 text-xs tracking-[0.16em] text-[#c4b7a4]">
            Bars are share of salary. Holds · Tight · Breaks · Gone
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {compared.map((row) => (
            <CityChart
              featured={row.city.id === city}
              key={row.city.id}
              row={row}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
