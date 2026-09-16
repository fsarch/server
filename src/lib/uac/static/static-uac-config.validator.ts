import Joi from 'joi';
import { CREATE_UAC_PERMISSION_VALIDATOR } from '../uac-permission.validator.js';

export const CREATE_STATIC_UAC_CONFIG_VALIDATOR = (roles: string[]) =>
  Joi.object({
    type: Joi.string().valid('static').required(),
    users: Joi.array().items(
      Joi.object({
        user_id: Joi.string().required(),
        permissions: Joi.array()
          .items(CREATE_UAC_PERMISSION_VALIDATOR(roles))
          .required(),
      }),
    ),
  });
