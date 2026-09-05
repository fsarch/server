import Joi from 'joi';

const CREATE_UAC_PERMISSION_VALIDATOR = (roles: string[]) => Joi.string().valid(...roles).required();

const CREATE_MAP_MAPPING_VALIDATOR = (roles: string[]) =>
  Joi.object({
    path: Joi.string().required(),
    operator: Joi.string().valid('map').required(),
    mappings: Joi.array()
      .items(
        Joi.object({
          key: Joi.string().required(),
          permissions: Joi.array().items(CREATE_UAC_PERMISSION_VALIDATOR(roles)).required(),
        }),
      )
      .required(),
  });

const CREATE_COMPARISON_MAPPING_VALIDATOR = (roles: string[]) =>
  Joi.object({
    path: Joi.string().required(),
    value: Joi.string().required(),
    operator: Joi.string().valid('includes', 'equals').required(),
    permissions: Joi.array().items(CREATE_UAC_PERMISSION_VALIDATOR(roles)).required(),
  });

export const CREATE_TOKEN_UAC_CONFIG_VALIDATOR = (roles: string[]) =>
  Joi.object({
    type: Joi.string().valid('token-based').required(),
    mappings: Joi.array()
      .items(
        Joi.alternatives(
          CREATE_MAP_MAPPING_VALIDATOR(roles),
          CREATE_COMPARISON_MAPPING_VALIDATOR(roles),
        ),
      )
      .required(),
  });
