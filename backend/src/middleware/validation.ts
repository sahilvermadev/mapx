import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Middleware to validate request body, query, or params using Joi schema
 */
export function validate(schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const { error } = schema.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        errors.push(...error.details.map(detail => detail.message));
      } else {
        // Replace req.body with sanitized version
        req.body = schema.body.validate(req.body).value;
      }
    }

    // Validate query
    if (schema.query) {
      const { error } = schema.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        errors.push(...error.details.map(detail => detail.message));
      } else {
        req.query = schema.query.validate(req.query).value;
      }
    }

    // Validate params
    if (schema.params) {
      const { error } = schema.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });
      if (error) {
        errors.push(...error.details.map(detail => detail.message));
      } else {
        req.params = schema.params.validate(req.params).value;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  uuidOptional: Joi.string().uuid().optional(),
  email: Joi.string().email().required(),
  emailOptional: Joi.string().email().optional(),
  url: Joi.string().uri().required(),
  urlOptional: Joi.string().uri().optional(),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
  },
  coordinates: {
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  },
  rating: Joi.number().integer().min(1).max(5),
  visibility: Joi.string().valid('friends', 'public').default('friends'),
};

