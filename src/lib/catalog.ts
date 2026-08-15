import products from '../data/products.json';
import { Product } from '../types';

const catalog = products as unknown as Product[];

export type SortOption = 'price_asc' | 'price_desc' | 'newest';

export type ProductSearchFilters = {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  capacity?: string;
  color?: string;
  ram?: string;
  nameContains?: string;
  sortBy?: SortOption;
  limit?: number;
};

const MAX_LIMIT = 12;
const DEFAULT_LIMIT = 6;

// The dataset spells the same value inconsistently ("space gray" vs
// "space-gray", "rosegold" vs "rose gold", "128GB" vs "128 gb"), and an LLM
// will phrase it differently again. Comparing on a squashed form makes all
// of those equivalent.
function squash(value: string): string {
  return value.toLowerCase().replace(/[\s-]+/g, '');
}

/**
 * Pure catalogue search. Kept free of any OpenAI types so the filtering
 * logic can be exercised on its own, without a model in the loop.
 */
export function searchProducts(filters: ProductSearchFilters): Product[] {
  const {
    category,
    minPrice,
    maxPrice,
    capacity,
    color,
    ram,
    nameContains,
    sortBy,
    limit,
  } = filters;

  let results = catalog.filter(product => {
    if (category && squash(product.category) !== squash(category)) {
      return false;
    }

    if (typeof minPrice === 'number' && product.price < minPrice) {
      return false;
    }

    if (typeof maxPrice === 'number' && product.price > maxPrice) {
      return false;
    }

    if (capacity && squash(product.capacity) !== squash(capacity)) {
      return false;
    }

    if (color && squash(product.color) !== squash(color)) {
      return false;
    }

    if (ram && squash(product.ram) !== squash(ram)) {
      return false;
    }

    if (
      nameContains &&
      !squash(product.name).includes(squash(nameContains))
    ) {
      return false;
    }

    return true;
  });

  switch (sortBy) {
    case 'price_asc':
      results = [...results].sort((a, b) => a.price - b.price);
      break;
    case 'price_desc':
      results = [...results].sort((a, b) => b.price - a.price);
      break;
    case 'newest':
      results = [...results].sort((a, b) => b.year - a.year);
      break;
    default:
      break;
  }

  // Clamped so a model asking for "all of them" can't dump 194 products
  // into the context window (or the UI).
  const safeLimit = Math.min(
    Math.max(limit ?? DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  return results.slice(0, safeLimit);
}

/**
 * Distinct values the model can filter on, injected into the system prompt
 * so it uses real catalogue values instead of inventing plausible ones.
 */
export function getCatalogFacets() {
  const distinct = (pick: (p: Product) => string) =>
    Array.from(new Set(catalog.map(pick))).sort();

  const prices = catalog.map(p => p.price);

  return {
    categories: distinct(p => p.category),
    capacities: distinct(p => p.capacity),
    colors: distinct(p => p.color),
    ramOptions: distinct(p => p.ram),
    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
    totalProducts: catalog.length,
  };
}
