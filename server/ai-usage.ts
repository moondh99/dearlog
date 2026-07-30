import { prisma } from './db';

export type InternalAiEndpoint =
  | 'publication_editorial_plan'
  | 'publication_writing_draft'
  | 'publication_manifest'
  | 'cover_design'
  | 'photo_analysis';

export type InternalAiUsageContext = {
  userId: string;
  role: string;
};

type UsageOutcome = 'success' | 'provider_error' | 'timeout' | 'fallback';

type ChatCompletionClient = {
  chat: {
    completions: {
      create: (input: unknown, options?: unknown) => Promise<unknown>;
    };
  };
};

function estimateChatCompletionUnits(input: Record<string, unknown>) {
  const messageChars = Array.isArray(input.messages)
    ? input.messages.reduce((total, message) => total + JSON.stringify(message).length, 0)
    : 0;
  const outputLimit = Number(input.max_completion_tokens ?? input.max_tokens);
  const requestedOutput = Number.isFinite(outputLimit) ? outputLimit * 4 : 0;
  return Math.ceil((messageChars + requestedOutput) / 4);
}

function providerTelemetry(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { providerStatus: undefined, providerCode: undefined, message: String(error ?? 'unknown error') };
  }
  const record = error as Record<string, unknown>;
  const providerStatus = typeof record.status === 'number'
    ? record.status
    : typeof record.statusCode === 'number'
      ? record.statusCode
      : undefined;
  const providerCode = typeof record.code === 'string'
    ? record.code
    : typeof record.type === 'string'
      ? record.type
      : undefined;
  const message = typeof record.message === 'string' ? record.message : JSON.stringify(record).slice(0, 500);
  return { providerStatus, providerCode, message };
}

export async function recordInternalAiUsage(input: {
  context?: InternalAiUsageContext;
  endpoint: InternalAiEndpoint;
  model?: string;
  outcome: UsageOutcome;
  statusCode: number;
  estimatedUnits?: number;
  latencyMs?: number;
  providerStatus?: number;
  providerCode?: string;
  errorMessage?: string;
}) {
  if (!input.context) return;

  try {
    await prisma.aiProxyAuditLog.create({
      data: {
        userId: input.context.userId,
        role: input.context.role,
        endpoint: input.endpoint,
        model: input.model,
        outcome: input.outcome,
        statusCode: input.statusCode,
        estimatedUnits: input.estimatedUnits ?? 0,
        latencyMs: input.latencyMs ?? 0,
        providerStatus: input.providerStatus,
        providerCode: input.providerCode,
        errorMessage: input.errorMessage?.slice(0, 500),
      },
    });
  } catch (error) {
    console.warn('Internal AI usage logging failed:', error);
  }
}

export async function createChatCompletionWithUsage<TResponse = unknown>(input: {
  client: ChatCompletionClient;
  endpoint: InternalAiEndpoint;
  providerInput: Record<string, unknown>;
  context?: InternalAiUsageContext;
  timeoutMs?: number;
}): Promise<TResponse> {
  const startedAt = Date.now();
  const model = typeof input.providerInput.model === 'string' ? input.providerInput.model : undefined;
  const estimatedUnits = estimateChatCompletionUnits(input.providerInput);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timedOut = false;
  const timeoutMs = Number.isFinite(input.timeoutMs) && input.timeoutMs! > 0 ? input.timeoutMs! : undefined;
  const timeout = timeoutMs && controller
    ? setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs)
    : null;

  try {
    const response = await input.client.chat.completions.create(
      input.providerInput as any,
      controller ? { signal: controller.signal } as any : undefined,
    );
    await recordInternalAiUsage({
      context: input.context,
      endpoint: input.endpoint,
      model,
      outcome: 'success',
      statusCode: 200,
      estimatedUnits,
      latencyMs: Date.now() - startedAt,
    });
    return response as TResponse;
  } catch (error) {
    const telemetry = providerTelemetry(error);
    const isTimeout = timedOut || telemetry.providerCode === 'AbortError' || telemetry.message.includes('aborted');
    await recordInternalAiUsage({
      context: input.context,
      endpoint: input.endpoint,
      model,
      outcome: isTimeout ? 'timeout' : 'provider_error',
      statusCode: isTimeout ? 408 : telemetry.providerStatus ?? 502,
      estimatedUnits,
      latencyMs: Date.now() - startedAt,
      providerStatus: telemetry.providerStatus,
      providerCode: telemetry.providerCode,
      errorMessage: telemetry.message,
    });
    throw Object.assign(error instanceof Error ? error : new Error(telemetry.message), {
      statusCode: isTimeout ? 408 : telemetry.providerStatus ?? 502,
      providerCode: telemetry.providerCode,
    });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
