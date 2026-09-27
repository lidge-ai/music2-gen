import { Music2Error } from "../shared/index.ts";
import { boomBap } from "./cards/boom_bap.ts";
import { drillNy } from "./cards/drill_ny.ts";
import { drillUk } from "./cards/drill_uk.ts";
import { house } from "./cards/house.ts";
import { lofiHiphop } from "./cards/lofi_hiphop.ts";
import { techno } from "./cards/techno.ts";
import { trap } from "./cards/trap.ts";
import type { RecipeCard } from "./recipe.schema.ts";

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

const CARDS = freezeDeep([boomBap, drillNy, drillUk, house, lofiHiphop, techno, trap]
  .map((card) => structuredClone(card)).sort((a, b) => a.id.localeCompare(b.id)));
const REGISTRY: ReadonlyMap<string, RecipeCard> = new Map(CARDS.map((card) => [card.id, card]));

export function listRecipes(): RecipeCard[] {
  return CARDS.map((card) => structuredClone(card));
}

export function getRecipe(id: string): RecipeCard {
  const card = REGISTRY.get(id);
  if (!card) throw new Music2Error("E_NOT_FOUND", `unknown recipe: ${id}`, { fix: "choose an id from music2 recipes" });
  return structuredClone(card);
}
