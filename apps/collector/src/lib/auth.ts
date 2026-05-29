import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/index.js';
import * as schema from '../db/schema.js';
import { env } from '../config.js';

const socialProviders = env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
  ? {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    }
  : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/auth",
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    ...(env.NODE_ENV === 'production'
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: '.codebaz.cloud',
          },
        }
      : {}),
    defaultCookieAttributes: {
      sameSite: 'none',
      secure: true,
    },
  },
  socialProviders,
  trustedOrigins: ['http://localhost:3000', 'https://api-nextdoctor.codebaz.cloud', 'https://nextdoctor.codebaz.cloud'],
});

export type Auth = typeof auth;
