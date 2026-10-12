export type CoachRole = 'system' | 'user' | 'assistant';

export interface CoachChatMessage {
  role: CoachRole;
  content: string;
}

export interface CoachProviderRequest {
  messages: CoachChatMessage[];
  maxOutputTokens: number;
  /** Fires at the deadline; providers should abort the remote call when it does. */
  signal?: AbortSignal;
}

export interface CoachProviderResponse {
  answer: string;
  provider: string;
  model: string;
  estimatedOutputTokens: number;
}

export interface CoachProvider {
  name: string;
  complete(request: CoachProviderRequest): Promise<CoachProviderResponse>;
}

export interface CoachSafetyResult {
  withinScope: boolean;
  escalatedToProfessional: boolean;
  flags: string[];
  directAnswer?: string;
}

export interface CoachResponse {
  conversationId: string;
  answer: string;
  provider: string;
  model: string;
  cached: boolean;
  /** True when this response is the stored result of an earlier request with the same Idempotency-Key. */
  idempotentReplay?: boolean;
  safety: CoachSafetyResult;
  usage: {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalTokens: number;
    remainingWindowRequests: number;
    /** ISO instant at which the fixed quota window resets. */
    windowResetsAt: string;
  };
}
