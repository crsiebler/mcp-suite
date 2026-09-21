import { experimental_evaluate as evaluate } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { parseInput } from "./input.js";
import { projectResult, type EvaluationOutput } from "./output.js";
import { boundedFetch, type Fetch } from "./fetch.js";
import { JevError } from "./errors.js";

export class JevService {
  private readonly active = new Set<AbortController>();
  private stopped = false;
  constructor(
    private readonly config: { apiKey: string; timeoutMs: number },
    private readonly fetch: Fetch = globalThis.fetch
  ) {}
  shutdown(): void {
    this.stopped = true;
    for (const controller of this.active)
      controller.abort(new JevError("SHUTDOWN"));
  }
  async evaluate(
    value: unknown,
    cancellation?: AbortSignal
  ): Promise<EvaluationOutput> {
    if (this.stopped) throw new JevError("SHUTDOWN");
    const input = parseInput(value);
    if (cancellation?.aborted) throw new JevError("CANCELLED");
    if (this.active.size >= 2) throw new JevError("OVERLOADED");
    const controller = new AbortController();
    this.active.add(controller);
    const cancel = () => controller.abort(new JevError("CANCELLED"));
    cancellation?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(
      () => controller.abort(new JevError("TIMEOUT")),
      this.config.timeoutMs
    );
    let transportFailure: JevError | undefined;
    const fetch = boundedFetch(this.fetch, controller.signal);
    const gateway = createGateway({
      apiKey: this.config.apiKey,
      fetch: async (url, init) => {
        try {
          return await fetch(url, init);
        } catch (error) {
          transportFailure =
            error instanceof JevError
              ? error
              : new JevError("PROVIDER_UNAVAILABLE");
          throw transportFailure;
        }
      },
    });
    const model = gateway.evaluationModel("typesafe-ai/jev");
    let warning = false;
    const safeModel = {
      specificationVersion: model.specificationVersion,
      provider: model.provider,
      modelId: model.modelId,
      supportedQuestionTypes: model.supportedQuestionTypes,
      doEvaluate: async (options: Parameters<typeof model.doEvaluate>[0]) => {
        const result = await model.doEvaluate(options);
        if (result.warnings.length) {
          warning = true;
          throw new JevError("PROVIDER_WARNING");
        }
        return result;
      },
    };
    let abortListener: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      abortListener = () => reject(controller.signal.reason);
      controller.signal.addEventListener("abort", abortListener, {
        once: true,
      });
    });
    try {
      const result = await Promise.race([
        evaluate({
          model: safeModel,
          ...input,
          maxRetries: 0,
          abortSignal: controller.signal,
          providerOptions: {
            gateway: {
              only: ["typesafe-ai"],
              zeroDataRetention: true,
              disallowPromptTraining: true,
            },
          },
        }),
        aborted,
      ]);
      return projectResult(result, input);
    } catch (error) {
      if (controller.signal.aborted) throw controller.signal.reason;
      if (transportFailure) throw transportFailure;
      if (warning) throw new JevError("PROVIDER_WARNING");
      if (error instanceof JevError) throw error;
      throw new JevError("INVALID_RESPONSE");
    } finally {
      clearTimeout(timer);
      cancellation?.removeEventListener("abort", cancel);
      if (abortListener)
        controller.signal.removeEventListener("abort", abortListener);
      this.active.delete(controller);
    }
  }
}
