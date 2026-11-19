/**
 * Nigerian States & Local Government Areas (LGAs)
 * Provides comprehensive territory metadata and geofencing helpers for Market Boost & Supplier Directory.
 */

export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT - Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

export type NigerianState = (typeof NIGERIAN_STATES)[number];

export const NIGERIA_STATE_LGAS: Record<string, string[]> = {
  Lagos: [
    "Agege",
    "Ajeromi-Ifelodun",
    "Alimosho",
    "Amuwo-Odofin",
    "Apapa",
    "Badagry",
    "Epe",
    "Eti-Osa (VI / Lekki / Ikoyi)",
    "Ibeju-Lekki",
    "Ifako-Ijaiye",
    "Ikeja",
    "Ikorodu",
    "Kosofe",
    "Lagos Island",
    "Lagos Mainland",
    "Mushin",
    "Ojo (Alaba)",
    "Oshodi-Isolo",
    "Shomolu",
    "Surulere",
  ],
  "FCT - Abuja": [
    "Abuja Municipal (AMAC / Central)",
    "Bwari",
    "Gwagwalada",
    "Kuje",
    "Kwali",
    "Abaji",
  ],
  Rivers: [
    "Port Harcourt",
    "Obio-Akpor",
    "Eleme",
    "Ikwerre",
    "Okrika",
    "Oyigbo",
    "Degema",
    "Bonny",
  ],
  Kano: [
    "Kano Municipal",
    "Dala",
    "Fagge",
    "Gwale",
    "Nassarawa",
    "Tarauni",
    "Kumbotso",
    "Ungogo",
  ],
  Oyo: [
    "Ibadan North",
    "Ibadan North-East",
    "Ibadan North-West",
    "Ibadan South-East",
    "Ibadan South-West",
    "Akinyele",
    "Egbeda",
    "Oluyole",
    "Ogbomosho North",
    "Ogbomosho South",
    "Oyo East",
    "Oyo West",
  ],
  Ogun: [
    "Abeokuta North",
    "Abeokuta South",
    "Ado-Odo/Ota",
    "Sagamu",
    "Ijebu Ode",
    "Obafemi Owode",
    "Ifo",
    "Ewekoro",
  ],
  Anambra: [
    "Onitsha North",
    "Onitsha South",
    "Awka North",
    "Awka South",
    "Nnewi North",
    "Nnewi South",
    "Idemili North",
    "Idemili South",
    "Aguata",
    "Ogbaru",
  ],
  Delta: [
    "Warri South",
    "Warri North",
    "Warri South West",
    "Oshimili South (Asaba)",
    "Oshimili North",
    "Uvwie",
    "Sapele",
    "Ughelli North",
    "Ughelli South",
  ],
  Edo: [
    "Oredo (Benin City)",
    "Ikpoba Okha",
    "Egor",
    "Uhunmwonde",
    "Esan West",
    "Esan Central",
  ],
  Kaduna: [
    "Kaduna North",
    "Kaduna South",
    "Chikun",
    "Igabi",
    "Zaria",
    "Sabon Gari",
  ],
  Enugu: [
    "Enugu North",
    "Enugu South",
    "Enugu East",
    "Nkanu West",
    "Nsukka",
    "Udi",
  ],
  Imo: [
    "Owerri Municipal",
    "Owerri North",
    "Owerri West",
    "Mbaitoli",
    "Orlu",
    "Okigwe",
  ],
  Abia: [
    "Aba North",
    "Aba South",
    "Umuahia North",
    "Umuahia South",
    "Osisioma",
  ],
  "Akwa Ibom": [
    "Uyo",
    "Eket",
    "Ikot Ekpene",
    "Oron",
    "Ibesikpo Asutan",
  ],
  Plateau: [
    "Jos North",
    "Jos South",
    "Jos East",
    "Barkin Ladi",
    "Bassa",
  ],
  Kwara: [
    "Ilorin West",
    "Ilorin East",
    "Ilorin South",
    "Offa",
    "Asa",
  ],
  Osun: [
    "Osogbo",
    "Olorunda",
    "Ife Central",
    "Ife East",
    "Ilesa East",
    "Ilesa West",
  ],
  Ondo: [
    "Akure South",
    "Akure North",
    "Ondo West",
    "Ondo East",
    "Owo",
  ],
  "Cross River": [
    "Calabar Municipal",
    "Calabar South",
    "Akamkpa",
    "Ikom",
    "Ogoja",
  ],
  Benue: [
    "Makurdi",
    "Gboko",
    "Otukpo",
    "Gwer East",
    "Gwer West",
  ],
};

/**
 * Returns the list of LGAs for a given Nigerian state.
 * If the state is not explicitly listed, returns a generic regional LGA list.
 */
export function getLgasForState(state: string): string[] {
  const trimmed = state.trim();
  const direct = NIGERIA_STATE_LGAS[trimmed];
  if (direct && direct.length > 0) return direct;

  // Case-insensitive lookup
  const matchKey = Object.keys(NIGERIA_STATE_LGAS).find(
    (k) => k.toLowerCase() === trimmed.toLowerCase()
  );
  if (matchKey && NIGERIA_STATE_LGAS[matchKey]) {
    return NIGERIA_STATE_LGAS[matchKey];
  }

  // Fallback defaults for remaining states
  return [
    `${trimmed} Municipal / Central`,
    `${trimmed} North`,
    `${trimmed} South`,
    `${trimmed} East`,
    `${trimmed} West`,
  ];
}

export interface TerritoryGeofenceTarget {
  state: string;
  lga?: string;
}

export interface TerritorySupplierGeofence {
  shippingScope: "LOCAL_STATE" | "SELECTED_STATES" | "NATIONWIDE" | string;
  baseState?: string;
  state?: string;
  coveredStates: string[];
  coveredLgas?: string[];
}

/**
 * Evaluates whether a supplier/vendor's wholesale catalog is deliverable
 * to a specific reseller's state and LGA.
 */
export function isTerritoryDeliverable(
  supplier: TerritorySupplierGeofence,
  target: TerritoryGeofenceTarget
): {
  deliverable: boolean;
  reason: string;
  scope: "NATIONWIDE" | "SELECTED_STATES" | "LOCAL_STATE";
} {
  const targetState = target.state.trim().toLowerCase();
  const targetLga = target.lga?.trim().toLowerCase();
  const scope = (supplier.shippingScope || "LOCAL_STATE") as "NATIONWIDE" | "SELECTED_STATES" | "LOCAL_STATE";

  // 1. Nationwide delivery covers all 36 states + FCT
  if (scope === "NATIONWIDE") {
    return {
      deliverable: true,
      reason: "Supplier offers nationwide dispatch to all 36 States + FCT.",
      scope: "NATIONWIDE",
    };
  }

  // 2. Determine allowed states
  const supplierBase = (supplier.baseState || supplier.state || "").trim().toLowerCase();
  const covered = (supplier.coveredStates || []).map((s) => s.trim().toLowerCase());

  let stateMatches = false;
  if (scope === "LOCAL_STATE") {
    stateMatches = supplierBase === targetState || (covered.length > 0 && covered.includes(targetState));
  } else {
    // SELECTED_STATES
    stateMatches = covered.includes(targetState) || supplierBase === targetState;
  }

  if (!stateMatches) {
    const allowed = (supplier.coveredStates && supplier.coveredStates.length > 0)
      ? supplier.coveredStates.join(", ")
      : supplier.baseState || supplier.state || "Base State";
    return {
      deliverable: false,
      reason: `Out of territory: Supplier only delivers to ${allowed}.`,
      scope,
    };
  }

  // 3. Evaluate LGA restrictions if supplier configured specific coveredLgas
  const restrictedLgas = (supplier.coveredLgas || []).map((l) => l.trim().toLowerCase());
  if (restrictedLgas.length > 0 && targetLga && targetLga !== "all" && targetLga !== "all lgas") {
    const lgaMatches = restrictedLgas.some(
      (l) => l === targetLga || targetLga.includes(l) || l.includes(targetLga)
    );
    if (!lgaMatches) {
      return {
        deliverable: false,
        reason: `State matches (${target.state}), but supplier only delivers to specific LGAs: ${supplier.coveredLgas!.join(", ")}.`,
        scope,
      };
    }
  }

  return {
    deliverable: true,
    reason: `In territory: Supplier delivers to ${target.state}${target.lga ? ` (${target.lga})` : ""}.`,
    scope,
  };
}
