import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous, genericOAuth } from "better-auth/plugins";
import db, { schema } from "./database";

import dotenv from "dotenv";
import { generateDemoName } from "./utils/generate-demo-name";

dotenv.config();

const trustedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

export const auth: ReturnType<typeof betterAuth> = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:1337",
  trustedOrigins,
  secret: process.env.JWT_ACCESS_SECRET || "",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      account: schema.accountTable,
      session: schema.sessionTable,
      verification: schema.verificationTable,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
      scopes: ["user:email"],
    },
  },
  plugins: [
    anonymous({
      generateName: async () => generateDemoName(),
    }),
    genericOAuth({
      config: [
        {
          providerId: "oidc",
          clientId: process.env.OIDC_CLIENT_ID || "",
          clientSecret: process.env.OIDC_CLIENT_SECRET || "",
          discoveryUrl: process.env.OIDC_DISCOVERY_URL || "",
          scopes: (process.env.OIDC_SCOPES || "openid profile email").split(
            " ",
          ),
        },
      ],
    }),
  ],
});
