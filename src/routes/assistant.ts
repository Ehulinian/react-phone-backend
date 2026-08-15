import { Router } from 'express';
import { runAssistant } from '../lib/assistant';
import type { AssistantMessage } from '../lib/assistant';

export const assistantRouter = Router();

const MAX_HISTORY = 12;
const MAX_MESSAGE_LENGTH = 500;

function parseHistory(value: unknown): AssistantMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const messages: AssistantMessage[] = [];

  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      return null;
    }

    const { role, content } = item as Record<string, unknown>;

    if (role !== 'user' && role !== 'assistant') {
      return null;
    }

    if (typeof content !== 'string' || content.trim().length === 0) {
      return null;
    }

    messages.push({ role, content: content.slice(0, MAX_MESSAGE_LENGTH) });
  }

  // Only the tail is sent to the model — keeps token cost bounded no matter
  // how long the client-side conversation gets.
  return messages.slice(-MAX_HISTORY);
}

assistantRouter.post('/assistant', async (req, res) => {
  const messages = parseHistory(req.body?.messages);

  if (!messages) {
    return res.status(400).json({
      error: 'Body must be { messages: [{ role: "user"|"assistant", content: string }] }',
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res
      .status(500)
      .json({ error: 'Assistant is not configured on the server' });
  }

  try {
    const reply = await runAssistant(messages);

    return res.json(reply);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Assistant request failed', error);

    return res.status(502).json({ error: 'Assistant is unavailable' });
  }
});
