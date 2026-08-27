import Joi from 'joi';

export const TRACING_CONSOLE_EXPORTER_CONFIG_VALIDATOR = Joi.object({
  type: Joi.string().valid('console').required(),
});

export const TRACING_OTLP_HTTP_EXPORTER_CONFIG_VALIDATOR = Joi.object({
  type: Joi.string().valid('otlp-http').required(),
  url: Joi.string().uri().required(),
  headers: Joi.object().pattern(Joi.string(), Joi.string()),
});

export const TRACING_OTLP_GRPC_EXPORTER_CONFIG_VALIDATOR = Joi.object({
  type: Joi.string().valid('otlp-grpc').required(),
  url: Joi.string().uri().required(),
  headers: Joi.object().pattern(Joi.string(), Joi.string()),
});

export const TRACING_EXPORTER_CONFIG_VALIDATOR = Joi.alternatives(
  TRACING_CONSOLE_EXPORTER_CONFIG_VALIDATOR,
  TRACING_OTLP_HTTP_EXPORTER_CONFIG_VALIDATOR,
  TRACING_OTLP_GRPC_EXPORTER_CONFIG_VALIDATOR,
);

export const TRACING_CONFIG_VALIDATOR = Joi.object({
  enabled: Joi.boolean().required(),
  serviceName: Joi.string(),
  sampleRatio: Joi.number().min(0).max(1),
  exporter: Joi.when('enabled', {
    is: true,
    then: TRACING_EXPORTER_CONFIG_VALIDATOR.required(),
    otherwise: TRACING_EXPORTER_CONFIG_VALIDATOR.optional(),
  }),
});
