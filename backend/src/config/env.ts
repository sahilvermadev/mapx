import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Try multiple common locations for the .env when running inside docker and locally
const candidatePaths = [
  path.resolve(__dirname, '../../.env'),   // project root when running ts-node from src
  path.resolve(__dirname, '../.env'),      // backend/.env if exists
  path.resolve(process.cwd(), '.env'),     // current working directory
];

for (const p of candidatePaths) {
  try {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p, override: false });
      // Only load the first existing file to avoid unintended overrides
      break;
    }
  } catch {
    // ignore
  }
}

export const requiredEnv = (key: string): string => {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
};

interface EnvValidationRule {
  required: boolean;
  validate?: (value: string) => boolean;
  message?: string;
  default?: string;
}

interface EnvConfig {
  [key: string]: EnvValidationRule;
}

const envConfig: EnvConfig = {
  DATABASE_URL: {
    required: true,
    validate: (value) => /^postgres(ql)?:\/\/.+/.test(value),
    message: 'DATABASE_URL must be a valid PostgreSQL connection string'
  },
  JWT_SECRET: {
    required: true,
    validate: (value) => value.length >= 32,
    message: 'JWT_SECRET must be at least 32 characters long'
  },
  GOOGLE_CLIENT_ID: {
    required: true,
    validate: (value) => value.length > 0,
    message: 'GOOGLE_CLIENT_ID is required'
  },
  GOOGLE_CLIENT_SECRET: {
    required: true,
    validate: (value) => value.length > 0,
    message: 'GOOGLE_CLIENT_SECRET is required'
  },
  REDIS_URL: {
    required: false,
    default: 'redis://localhost:6379',
    validate: (value) => /^redis:\/\/.+/.test(value),
    message: 'REDIS_URL must be a valid Redis connection string'
  },
  PORT: {
    required: false,
    default: '5000',
    validate: (value) => {
      const port = parseInt(value, 10);
      return !isNaN(port) && port > 0 && port <= 65535;
    },
    message: 'PORT must be a valid port number (1-65535)'
  },
  NODE_ENV: {
    required: false,
    default: 'development',
    validate: (value) => ['development', 'production', 'test'].includes(value),
    message: 'NODE_ENV must be one of: development, production, test'
  },
  ALLOWED_ORIGINS: {
    required: false,
    default: 'http://localhost:5173',
  },
  SESSION_SECRET: {
    required: false,
    validate: (value) => value.length >= 32,
    message: 'SESSION_SECRET must be at least 32 characters long'
  },
  OPENAI_API_KEY: {
    required: false,
    validate: (value) => value.startsWith('sk-'),
    message: 'OPENAI_API_KEY should start with "sk-"'
  },
  GROQ_API_KEY: {
    required: false,
    validate: (value) => value.length > 0,
    message: 'GROQ_API_KEY is required if using AI features'
  },
  GOOGLE_MAPS_API_KEY: {
    required: false,
    validate: (value) => value.length > 0,
    message: 'GOOGLE_MAPS_API_KEY is required if using Maps features'
  },
};

/**
 * Validate environment variables on startup
 */
export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  for (const [key, rule] of Object.entries(envConfig)) {
    const value = process.env[key];

    // Set default if not provided and default exists
    if (!value && rule.default) {
      process.env[key] = rule.default;
      continue;
    }

    // Check required
    if (rule.required && !value) {
      errors.push(`Missing required environment variable: ${key}`);
      continue;
    }

    // Skip validation if value not provided and not required
    if (!value) {
      continue;
    }

    // Validate format if validator provided
    if (rule.validate && !rule.validate(value)) {
      errors.push(`${key}: ${rule.message || 'Invalid format'}`);
    }
  }

  // Warn about missing optional but recommended variables in production
  if (isProduction) {
    const recommended = ['OPENAI_API_KEY', 'GROQ_API_KEY', 'GOOGLE_MAPS_API_KEY', 'SESSION_SECRET'];
    for (const key of recommended) {
      if (!process.env[key]) {
        console.warn(`⚠️  Warning: ${key} is not set. This may cause issues in production.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get environment variable with validation
 */
export function getEnv(key: string): string | undefined {
  return process.env[key];
}

/**
 * Get environment variable or default
 */
export function getEnvOrDefault(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}










