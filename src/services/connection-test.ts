import {
  ConnectionStatus,
  ConnectionTestResult,
  ProviderConfig,
  ProviderId,
} from "../types/providers";
import { getProvider, getProviderMetadata } from "../providers/registry";

export interface DiagnosticFeedback {
  status: ConnectionStatus;
  headline: string;
  detail: string;
  troubleshooting?: string[];
}

export function getDiagnosticFeedback(
  providerId: ProviderId,
  result: ConnectionTestResult
): DiagnosticFeedback {
  const meta = getProviderMetadata(providerId);

  switch (result.status) {
    case "connected":
      return {
        status: "connected",
        headline: `Connected to ${meta.name}`,
        detail: `Verified successfully in ${result.latencyMs}ms. Ready for chat and tasks.`,
      };

    case "invalid_key":
      return {
        status: "invalid_key",
        headline: "Authentication Failed: Invalid API Key",
        detail: result.message || "The API key supplied was rejected by the provider.",
        troubleshooting: [
          `Double-check your API key in the ${meta.name} developer portal.`,
          meta.apiKeyHelpUrl ? `Obtain or regenerate your key at: ${meta.apiKeyHelpUrl}` : "",
          "Ensure there are no leading or trailing whitespace characters.",
        ].filter(Boolean),
      };

    case "quota_exceeded":
      return {
        status: "quota_exceeded",
        headline: "Quota or Rate Limit Exceeded",
        detail: result.message || "Your account has run out of credits or hit request rate limits.",
        troubleshooting: [
          "Check your account credit balance and billing tier.",
          "Verify whether free tier promotional credits have expired.",
          "Wait a few moments if you encountered a short-term rate limit.",
        ],
      };

    case "network_error":
      return {
        status: "network_error",
        headline: "Network or CORS Connectivity Error",
        detail: result.message || "Unable to reach the provider endpoint from this browser.",
        troubleshooting: [
          providerId === "ollama"
            ? "Ensure Ollama is running and start with OLLAMA_ORIGINS=\"*\" to permit browser requests."
            : "Check your internet connection and DNS settings.",
          "Check whether an ad blocker or privacy extension is blocking API calls.",
          "If using a custom base URL or reverse proxy, verify that CORS headers are enabled.",
        ],
      };

    case "unsupported_endpoint":
      return {
        status: "unsupported_endpoint",
        headline: "Endpoint Not Found (404)",
        detail: result.message || "The specified URL endpoint does not support this API version.",
        troubleshooting: [
          `Reset the Base URL to the default: ${meta.defaultBaseUrl}`,
          "Ensure no extra subpaths like /chat or /models are appended to the root API URL.",
        ],
      };

    case "unavailable":
      return {
        status: "unavailable",
        headline: `${meta.name} Service Unavailable`,
        detail: result.message || "The provider server returned a 5xx error or is experiencing downtime.",
        troubleshooting: [
          "Check the provider status page for service outages.",
          "Try switching to a fallback provider in NusaAgent BYOK.",
        ],
      };

    default:
      return {
        status: result.status || "network_error",
        headline: "Connection Test Failed",
        detail: result.message || "Could not establish a connection.",
      };
  }
}

/**
 * Execute real connection test for any configured provider.
 */
export async function testProviderConnection(
  config: ProviderConfig
): Promise<ConnectionTestResult> {
  const provider = getProvider(config.providerId);
  try {
    const result = await provider.testConnection(config);
    return result;
  } catch (err: any) {
    return {
      status: "network_error",
      success: false,
      latencyMs: 0,
      message: err?.message || "Unknown error occurred during connection test.",
      testedAt: Date.now(),
    };
  }
}
