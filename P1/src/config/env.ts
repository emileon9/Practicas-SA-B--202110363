import 'dotenv/config';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: getRequiredEnv('DATABASE_URL'),
  PORT: process.env['PORT'] ?? '3000',
} as const;
