/**
 * The work taxonomy. Worker onboarding picks a domain and the positions they
 * want; posting a job picks a position as jobs.skill. One list, so a worker's
 * interests and an employer's job actually line up.
 */
export const DOMAINS = [
  {
    key: "construction",
    label: "Construction",
    hint: "Mistri, helper, site work",
    icon: "HardHat",
    positions: ["Mason", "Carpenter", "Painter", "Plumber", "Electrician", "Welder", "Helper", "Tile fitter"],
  },
  {
    key: "driving",
    label: "Driving",
    hint: "Car, auto, truck, delivery",
    icon: "Car",
    positions: ["Car driver", "Auto driver", "Truck driver", "Delivery rider", "Loader driver"],
  },
  {
    key: "household",
    label: "Household",
    hint: "Cook, cleaning, care",
    icon: "Home",
    positions: ["Cook", "House cleaner", "Nanny", "Elder care", "Gardener", "Watchman"],
  },
  {
    key: "repair",
    label: "Repair",
    hint: "AC, appliance, mechanic",
    icon: "Wrench",
    positions: ["AC technician", "Appliance repair", "Mobile repair", "Bike mechanic", "Car mechanic"],
  },
  {
    key: "factory",
    label: "Factory",
    hint: "Machine, packing, loading",
    icon: "Factory",
    positions: ["Machine operator", "Packer", "Loader", "Quality checker", "Store helper"],
  },
  {
    key: "hospitality",
    label: "Hotel & Food",
    hint: "Kitchen, service, cleaning",
    icon: "UtensilsCrossed",
    positions: ["Waiter", "Kitchen helper", "Housekeeping", "Dishwasher", "Chef"],
  },
  {
    key: "farm",
    label: "Farm",
    hint: "Field and crop work",
    icon: "Sprout",
    positions: ["Field worker", "Harvesting", "Tractor operator", "Dairy work"],
  },
  {
    key: "security",
    label: "Security",
    hint: "Guard duty",
    icon: "ShieldCheck",
    positions: ["Security guard", "Night watchman", "Gatekeeper"],
  },
] as const;

export type DomainKey = (typeof DOMAINS)[number]["key"];

export const domainByKey = (key: string | null) =>
  DOMAINS.find((d) => d.key === key) ?? null;

/** Every position across every domain — the job-posting picker. */
export const ALL_POSITIONS = DOMAINS.flatMap((d) =>
  d.positions.map((p) => ({ position: p, domain: d.key, domainLabel: d.label })),
);

export const EXPERIENCE = ["Less than 1 year", "1 - 3 years", "3 - 5 years", "More than 5 years"] as const;
export const AVAILABILITY = ["Full time", "Part time", "Only weekends", "Daily wage"] as const;
