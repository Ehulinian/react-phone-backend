import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { getCatalogFacets, searchProducts } from './catalog';
import type { ProductSearchFilters } from './catalog';
import { Product } from '../types';

// Configurable so the deployment can switch models without a code change.
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// A tool call can legitimately need a follow-up (e.g. the first search
// returns nothing and the model retries with looser filters), but an
// unbounded loop would burn tokens on a malfunctioning model.
const MAX_TOOL_ROUNDS = 3;

export type AssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantReply = {
  message: string;
  products: Product[];
};

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  client ??= new OpenAI({ apiKey });

  return client;
}

const searchProductsTool: ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'search_products',
    description:
      'Search the store catalogue. Call this whenever the user asks about ' +
      'products, prices, specs or availability. Never invent products — ' +
      'only describe what this tool returns.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['phones', 'tablets', 'accessories'],
          description: 'Product category',
        },
        minPrice: { type: 'number', description: 'Minimum price in USD' },
        maxPrice: { type: 'number', description: 'Maximum price in USD' },
        capacity: {
          type: 'string',
          description: 'Storage capacity exactly as listed, e.g. "128GB"',
        },
        color: { type: 'string', description: 'Colour, e.g. "midnight"' },
        ram: { type: 'string', description: 'RAM, e.g. "4GB"' },
        nameContains: {
          type: 'string',
          description:
            'Substring of the product name, e.g. "iPhone 14" or "iPad Air"',
        },
        sortBy: {
          type: 'string',
          enum: ['price_asc', 'price_desc', 'newest'],
          description: 'Result ordering',
        },
        limit: {
          type: 'number',
          description: 'How many products to return (1-12, default 6)',
        },
      },
      additionalProperties: false,
    },
  },
};

function buildSystemPrompt(): string {
  const facets = getCatalogFacets();

  return [
    'You are a shopping assistant for an online electronics store.',
    'Answer only using products returned by the search_products tool.',
    'If a search returns nothing, say so plainly and suggest loosening a',
    'filter — never make up a product, price or spec.',
    'Keep replies short: two or three sentences. The products themselves',
    'are rendered as cards in the UI, so do not list them as markdown or',
    'repeat every spec — just summarise what you found.',
    '',
    `The catalogue has ${facets.totalProducts} products.`,
    `Categories: ${facets.categories.join(', ')}.`,
    `Prices range from $${facets.priceRange.min} to $${facets.priceRange.max}.`,
    `Capacities: ${facets.capacities.join(', ')}.`,
    `RAM options: ${facets.ramOptions.join(', ')}.`,
    `Colours: ${facets.colors.join(', ')}.`,
  ].join('\n');
}

/**
 * Runs one assistant turn: the model decides whether to search, we execute
 * the search locally, then feed the results back so it can summarise them.
 * Returns both the prose reply and the matched products, so the client can
 * render real product cards rather than a wall of text.
 */
export async function runAssistant(
  history: AssistantMessage[],
): Promise<AssistantReply> {
  const openai = getClient();

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.map(m => ({ role: m.role, content: m.content })),
  ];

  const collected: Product[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: [searchProductsTool],
    });

    const choice = completion.choices[0]?.message;

    if (!choice) {
      throw new Error('OpenAI returned no message');
    }

    const toolCalls = choice.tool_calls;

    if (!toolCalls || toolCalls.length === 0) {
      return {
        message: choice.content ?? '',
        products: dedupeById(collected),
      };
    }

    messages.push(choice);

    for (const call of toolCalls) {
      if (call.type !== 'function') {
        continue;
      }

      const found = runSearchTool(call.function.arguments);

      collected.push(...found);

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(
          found.map(p => ({
            name: p.name,
            price: p.price,
            fullPrice: p.fullPrice,
            capacity: p.capacity,
            color: p.color,
            ram: p.ram,
            screen: p.screen,
            year: p.year,
          })),
        ),
      });
    }
  }

  // Ran out of rounds while the model was still calling tools. Better to
  // return what was found than to loop forever or throw.
  return {
    message:
      collected.length > 0
        ? 'Here is what I found in the catalogue.'
        : 'Sorry, I could not find anything matching that.',
    products: dedupeById(collected),
  };
}

function runSearchTool(rawArguments: string): Product[] {
  let filters: ProductSearchFilters;

  try {
    filters = JSON.parse(rawArguments) as ProductSearchFilters;
  } catch {
    // A malformed tool call shouldn't take the request down; an empty
    // result lets the model recover on the next round.
    return [];
  }

  return searchProducts(filters);
}

function dedupeById(items: Product[]): Product[] {
  const seen = new Set<Product['id']>();

  return items.filter(item => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);

    return true;
  });
}
