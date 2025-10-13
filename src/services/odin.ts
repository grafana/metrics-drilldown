/**
 * Odin Feature Flag Client
 *
 * A TypeScript client for evaluating feature flags from the Odin app.
 * Supports both polling and real-time updates via Server-Sent Events (SSE).
 *
 * Installation:
 *   No dependencies required! Just copy this file to your project.
 *
 * Usage:
 *   import { OdinClient } from './odin-client';
 *
 *   const client = new OdinClient({
 *     endpoint: 'http://grafana.k3d.localhost:9999/api/plugins/odin-app/resources/gofeatureflag',
 *     context: {
 *       targetingKey: 'user-123',
 *       userType: 'vip',
 *     },
 *   });
 *
 *   // Get flag value
 *   const isEnabled = await client.getBooleanFlag('new-feature', false, 'my-experiment');
 *
 *   // Get all flags for an experiment
 *   const allFlags = await client.getAllFlags('my-experiment');
 *
 *   // Listen for real-time updates
 *   client.onFlagChange((flags) => {
 *     console.log('Flags updated:', flags);
 *   });
 *
 *   // Start real-time updates (experimentKey required for connection)
 *   client.connect('my-experiment');
 */

import { getFaro } from 'shared/logger/faro/faro';

type EvaluationContextValue = string | number | boolean;

/**
 * Evaluation context for flag evaluation
 */
export interface EvaluationContext {
  /** Unique identifier for the user/entity being evaluated */
  targetingKey: string;
  /** Additional custom attributes for targeting rules */
  [key: string]: EvaluationContextValue;
}

/**
 * OFREP flag evaluation response
 */
export interface FlagEvaluation<T = unknown> {
  /** The flag key that was evaluated */
  key: string;
  /** The evaluated value */
  value: T;
  /** Reason for the evaluation result */
  reason: string;
  /** The variant that was selected */
  variant?: string;
  /** Additional metadata about the evaluation */
  metadata?: Record<string, unknown>;
}

/**
 * Bulk flag evaluation response
 */
export interface BulkFlagEvaluation {
  /** Map of flag keys to their evaluations */
  flags: FlagEvaluation[];
}

/**
 * Flag change event from SSE stream
 */
export interface FlagChangeEvent {
  /** The experiment that changed */
  experimentKey: string;
  /** The updated flag values */
  flags: Record<string, unknown>;
  /** When the change occurred */
  timestamp: string;
}

/**
 * Configuration options for OdinClient
 */
export interface OdinClientConfig {
  /** Base URL for the Odin plugin (e.g., 'http://localhost:9999/api/plugins/odin-app/resources/gofeatureflag') */
  endpoint: string;
  /** Evaluation context (user attributes for targeting, experimentKey not required) */
  context: EvaluationContext;
  /**
   * Grafana service account token for authentication.
   * Required when accessing from external applications.
   * Create one at: Grafana -> Administration -> Users and access -> Service accounts
   * See: https://grafana.com/docs/grafana/latest/administration/service-accounts/
   * Format: "Bearer <your-token>" or just "<your-token>"
   */
  apiToken?: string;
  /** Optional timeout for API requests in milliseconds (default: 5000) */
  timeout?: number;
  /** Whether to enable real-time updates via SSE (default: false) */
  enableRealTimeUpdates?: boolean;
  /** Polling interval in milliseconds when not using SSE (default: 30000) */
  pollingInterval?: number;
}

/**
 * Odin Feature Flag Client
 */
export class OdinClient {
  private config: OdinClientConfig & {
    timeout: number;
    enableRealTimeUpdates: boolean;
    pollingInterval: number;
  };
  private eventSource?: EventSource;
  private pollingTimer?: number;
  private flagCache: Record<string, unknown> = {};
  private changeListeners: Array<(flags: Record<string, unknown>) => void> = [];
  private connected = false;

  constructor(config: OdinClientConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? 5000,
      enableRealTimeUpdates: config.enableRealTimeUpdates ?? false,
      pollingInterval: config.pollingInterval ?? 30000,
    };
  }

  /**
   * Evaluate a boolean flag
   */
  async getBooleanFlag(flagKey: string, defaultValue: boolean, experimentKey: string): Promise<boolean> {
    const result = await this.evaluateFlag<boolean>(flagKey, defaultValue, experimentKey);
    return result.value;
  }

  /**
   * Evaluate a string flag
   */
  async getStringFlag(flagKey: string, defaultValue: string, experimentKey: string): Promise<string> {
    const result = await this.evaluateFlag<string>(flagKey, defaultValue, experimentKey);
    return result.value;
  }

  /**
   * Evaluate a number flag
   */
  async getNumberFlag(flagKey: string, defaultValue: number, experimentKey: string): Promise<number> {
    const result = await this.evaluateFlag<number>(flagKey, defaultValue, experimentKey);
    return result.value;
  }

  /**
   * Evaluate an object/JSON flag
   */
  async getObjectFlag<T = unknown>(flagKey: string, defaultValue: T, experimentKey: string): Promise<T> {
    const result = await this.evaluateFlag<T>(flagKey, defaultValue, experimentKey);
    return result.value;
  }

  /**
   * Get all flags for the specified experiment
   */
  async getAllFlags(experimentKey: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.fetchWithTimeout(`${this.config.endpoint}/ofrep/v1/evaluate/flags`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          context: {
            ...this.config.context,
            experimentKey,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: BulkFlagEvaluation = await response.json();

      // Convert array to map and update cache
      const flags: Record<string, unknown> = {};
      data.flags.forEach((flag) => {
        flags[flag.key] = flag.value;
      });

      this.flagCache = flags;
      return flags;
    } catch (error) {
      console.error('Failed to get all flags:', error);
      return this.flagCache;
    }
  }

  /**
   * Register a listener for flag changes
   */
  onFlagChange(listener: (flags: Record<string, unknown>) => void): () => void {
    this.changeListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.changeListeners.indexOf(listener);
      if (index > -1) {
        this.changeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Connect to real-time updates (SSE or polling)
   */
  connect(experimentKey: string): void {
    if (this.connected) {
      return;
    }

    this.connected = true;

    if (this.config.enableRealTimeUpdates) {
      this.connectSSE(experimentKey);
    } else {
      this.startPolling(experimentKey);
    }
  }

  /**
   * Disconnect from real-time updates
   */
  disconnect(): void {
    this.connected = false;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }

    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  /**
   * Update the evaluation context (e.g., when user changes)
   * Note: If you're currently connected to real-time updates, you'll need to
   * disconnect and reconnect manually with the desired experimentKey to
   * ensure the updated context is used.
   */
  updateContext(context: Partial<EvaluationContext>): void {
    const filteredContext: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(context)) {
      if (value !== undefined) {
        filteredContext[key] = value as string | number | boolean;
      }
    }

    this.config.context = {
      ...this.config.context,
      ...filteredContext,
    };
  }

  /**
   * Check if connected to real-time updates
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the current cached flags
   */
  getCachedFlags(): Record<string, unknown> {
    return { ...this.flagCache };
  }

  /**
   * Send experiment measurements to Faro
   *
   * @param experimentKey - The Odin experiment key
   * @param measurementName - The name of the measurement or KPI, e.g. "sidebar_interaction"
   * @param attributes - (optional) Additional event attributes
   * @param domain - (optional) Domain of the event, e.g. "prefix-filters"
   */
  captureInteraction(
    experimentKey: string,
    measurementName: string,
    attributes?: Record<string, string>,
    domain?: string
  ): void {
    getFaro()?.api.pushEvent(`odin_exp::${experimentKey}_measurement::${measurementName}`, attributes, domain);
  }

  // Private methods

  /**
   * Build request headers including authentication if provided
   */
  private buildHeaders(additionalHeaders?: HeadersInit): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add authentication header if apiToken is provided
    if (this.config.apiToken) {
      // Automatically add "Bearer " prefix if not already present
      const token = this.config.apiToken.startsWith('Bearer ')
        ? this.config.apiToken
        : `Bearer ${this.config.apiToken}`;
      headers['Authorization'] = token;
    }

    // Merge with additional headers
    if (additionalHeaders) {
      Object.assign(headers, additionalHeaders);
    }

    return headers;
  }

  private async evaluateFlag<T>(flagKey: string, defaultValue: T, experimentKey: string): Promise<FlagEvaluation<T>> {
    try {
      const response = await this.fetchWithTimeout(`${this.config.endpoint}/ofrep/v1/evaluate/flags/${flagKey}`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          context: {
            ...this.config.context,
            experimentKey,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: FlagEvaluation<T> = await response.json();

      // Update cache
      this.flagCache[flagKey] = data.value;

      return data;
    } catch (error) {
      console.error(`Failed to evaluate flag ${flagKey}:`, error);

      // Return cached value or default
      return {
        key: flagKey,
        value: (this.flagCache[flagKey] as T) ?? defaultValue,
        reason: 'ERROR',
      };
    }
  }

  private connectSSE(experimentKey: string): void {
    // Build SSE URL with experiment key
    let url = `${this.config.endpoint}/stream?experimentKey=${experimentKey}`;

    // Note: EventSource doesn't support custom headers (browser limitation)
    // For authentication with external apps, pass token as query parameter
    // This is less secure than headers but is the only option for SSE in browsers
    if (this.config.apiToken) {
      const token = this.config.apiToken.startsWith('Bearer ')
        ? this.config.apiToken.substring(7) // Remove "Bearer " prefix
        : this.config.apiToken;
      url += `&auth=${encodeURIComponent(token)}`;
    }

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('SSE connected');
    };

    this.eventSource.addEventListener('flag-change', (event) => {
      try {
        const data: FlagChangeEvent = JSON.parse(event.data);
        this.flagCache = data.flags;
        this.notifyListeners(data.flags);
      } catch (error) {
        console.error('Failed to parse SSE event:', error);
      }
    });

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // EventSource will automatically attempt to reconnect
    };
  }

  private startPolling(experimentKey: string): void {
    // Initial fetch
    this.pollFlags(experimentKey);

    // Set up recurring polling
    this.pollingTimer = window.setInterval(() => {
      this.pollFlags(experimentKey);
    }, this.config.pollingInterval);
  }

  private async pollFlags(experimentKey: string): Promise<void> {
    const flags = await this.getAllFlags(experimentKey);
    this.notifyListeners(flags);
  }

  private notifyListeners(flags: Record<string, unknown>): void {
    this.changeListeners.forEach((listener) => {
      try {
        listener(flags);
      } catch (error) {
        console.error('Error in flag change listener:', error);
      }
    });
  }

  private async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}

let odin: OdinClient | null = null;

export const getOdin = () => odin;
export const setOdin = (instance: OdinClient | null) => (odin = instance);

export const initOdin = (config: OdinClientConfig) => {
  odin = new OdinClient(config);
};
