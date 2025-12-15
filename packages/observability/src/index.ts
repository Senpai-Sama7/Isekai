import { diag, DiagConsoleLogger, DiagLogLevel, trace, Span, Attributes } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { ExpressInstrumentation } from "@opentelemetry/instrumentation-express";
import promClient from "prom-client";

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

export const metricsRegistry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: metricsRegistry });

// Performance metrics
const requestDurationHistogram = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const activeRequestsGauge = new promClient.Gauge({
  name: 'http_active_requests',
  help: 'Number of active HTTP requests'
});

export function startTelemetry(serviceName: string) {
  const sdk = new NodeSDK({
    serviceName,
    instrumentations: [new HttpInstrumentation(), new ExpressInstrumentation()],
  });
  try {
    sdk.start();
  } catch (e: any) {
    console.error("otel start error", e.message);
  }
  return sdk;
}

export function requestCounter(name = "http_requests_total") {
  return new promClient.Counter({
    name,
    help: "HTTP requests count",
    registers: [metricsRegistry],
    labelNames: ["method", "route", "status"],
  });
}

export function metricsMiddleware() {
  return async function(_req: any, res: any) {
    res.setHeader("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  };
}

export function observeRequestDuration(labels: { method: string; route: string; status: string }) {
  return requestDurationHistogram.startTimer(labels);
}

export function incrementActiveRequests() {
  activeRequestsGauge.inc();
}

export function decrementActiveRequests() {
  activeRequestsGauge.dec();
}

// Export the enhanced logger
export { Logger, logger } from './logger';
