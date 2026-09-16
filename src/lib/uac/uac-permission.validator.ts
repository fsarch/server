import Joi from 'joi';

/**
 * Validates a single permission entry: a plain string (unscoped), or an
 * object scoping it to one or more resource ids.
 */
export const CREATE_UAC_PERMISSION_VALIDATOR = (roles: string[]) =>
  Joi.alternatives(
    Joi.string().valid(...roles),
    Joi.object({
      name: Joi.string().valid(...roles).required(),
      resource: Joi.alternatives(
        Joi.string(),
        Joi.array().items(Joi.string()).min(1),
      ).required(),
    }),
  ).required();
