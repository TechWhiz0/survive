#!/usr/bin/env python3
"""Refresh Numbeo city prices into src/data/living.json and public/data/living.json."""
from pathlib import Path
import datetime
import json
import re
import time
import urllib.error
import urllib.request
from html import unescape

ROOT = Path(__file__).resolve().parents[1]
CITIES = {
    "mumbai": "Mumbai",
    "delhi": "Delhi",
    "bangalore": "Bangalore",
    "hyderabad": "Hyderabad",
    "pune": "Pune",
    "chennai": "Chennai",
    "kolkata": "Kolkata",
    "ahmedabad": "Ahmedabad",
    "gurgaon": "Gurgaon",
    "noida": "Noida",
    "jaipur": "Jaipur",
    "chandigarh": "Chandigarh",
    "kochi": "Kochi",
    "lucknow": "Lucknow",
    "indore": "Indore",
    "bhopal": "Bhopal",
    "nagpur": "Nagpur",
    "coimbatore": "Coimbatore",
    "goa": "Goa",
    "surat": "Surat",
}
PRICE_RE = re.compile(
    r"<td[^>]*>(.*?)</td>\s*<td[^>]*class=\"priceValue[^\"]*\"[^>]*>\s*<span class=\"first_currency\">(?:&#x20b9;|₹)?\s*([0-9,.]+)",
    re.I | re.S,
)


def rupee(s: str) -> float:
    return float(s.replace(",", ""))


def text(s: str) -> str:
    return unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def pick(prices: dict[str, float], key: str) -> float:
    k = key.lower()
    for name, val in prices.items():
        if k in name.lower():
            return val
    return 0.0


def fetch(slug: str) -> dict[str, float]:
    url = f"https://www.numbeo.com/cost-of-living/in/{slug}"
    req = urllib.request.Request(url, headers={"User-Agent": "SurviveIndia/1.0"})
    html = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "ignore")
    if "Access Restricted" in html or "Too Many Requests" in html:
        raise RuntimeError(f"rate limited: {slug}")
    return {text(raw): rupee(val) for raw, val in PRICE_RE.findall(html)}


def main() -> None:
    existing_path = ROOT / "src/data/living.json"
    existing = json.loads(existing_path.read_text()) if existing_path.exists() else {"cities": {}}
    out = {
        "source": "Numbeo crowdsourced city prices",
        "sourceUrl": "https://www.numbeo.com/cost-of-living/",
        "fetchedAt": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cities": dict(existing.get("cities", {})),
    }
    for cid, slug in CITIES.items():
        try:
            p = fetch(slug)
            meal, meal2, cinema = pick(p, "Meal at an Inexpensive Restaurant"), pick(p, "Meal for Two at a Mid-Range Restaurant"), pick(p, "Cinema Ticket")
            rent1, rent3c, rent3o = pick(p, "1 Bedroom Apartment in City Centre"), pick(p, "3 Bedroom Apartment in City Centre"), pick(p, "3 Bedroom Apartment Outside of City Centre")
            if not rent1:
                raise RuntimeError(f"no rent for {slug}")
            groceries = pick(p, "Milk (Regular, 1 Liter)") * 8 + pick(p, "Fresh White Bread") * 8 + pick(p, "White Rice (1 kg)") * 4 + pick(p, "Eggs (12") * 2 + pick(p, "Chicken Fillets") * 3
            date_night = round(meal2 + cinema * 2)
            out["cities"][cid] = {
                "id": cid,
                "name": slug,
                "url": f"https://www.numbeo.com/cost-of-living/in/{slug}",
                "rent": [round(rent1), round(rent1), round(rent3o or rent3c), round(rent3c or rent3o)],
                "foodPerPerson": round(groceries + meal * 20),
                "car": round(pick(p, "Gasoline (1 Liter)") * 80 + 6000),
                "commute": round(pick(p, "Monthly Public Transport Pass")),
                "utilities": round(pick(p, "Basic Utilities") + pick(p, "Broadband Internet")),
                "dating": date_night,
                "weekend": date_night,
            }
            print("ok", cid, out["cities"][cid]["rent"][0], out["cities"][cid]["foodPerPerson"])
        except Exception as err:
            print("skip", cid, err)
        time.sleep(2)
    payload = json.dumps(out, indent=2)
    for dest in (ROOT / "src/data/living.json", ROOT / "public/data/living.json"):
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(payload)
        print("wrote", dest)


if __name__ == "__main__":
    main()
