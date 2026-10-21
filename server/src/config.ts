import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  SERVER_URL: z.string().default('http://localhost:3000'),
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_JWT_SECRET: z.string().optional().default(''),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/sayso'),
  MONGODB_DB_NAME: z.string().default('sayso'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  GEMMA_MODEL_ID: z.string().default('google/gemma-2-9b-it'),
  SENTRY_DSN: z.string().optional().default(''),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:5173'),
});

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
