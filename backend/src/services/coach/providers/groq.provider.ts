import Groq from 'groq-sdk';
import { env } from '../../../config/env';
import { AppError } from '../../../middleware/errorHandler';
import type { CoachProvider, CoachProviderRequest, CoachProviderResponse } from '../types';

export class GroqCoachProvider implements CoachProvider {
  name = 'groq';

  async complete(request: CoachProviderRequest): Promise<CoachProviderResponse> {
    if (!env.groqApiKey) {
      throw new AppError(503, 'LLM provider is not configured');
    }

    const client = new Groq({ apiKey: env.groqApiKey });
    const completion = await client.chat.completions.create({
      model: env.groqModel,
      max_tokens: request.maxOutputTokens,
      temperature: 0.3,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }, request.signal ? { signal: request.signal } : undefined);

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      throw new AppError(502, 'LLM provider returned an empty response');
    }

    return {
      answer,
      provider: this.name,
      model: completion.model ?? env.groqModel,
      estimatedOutputTokens: completion.usage?.completion_tokens ?? Math.ceil(answer.length / 4),
    };
  }
}
