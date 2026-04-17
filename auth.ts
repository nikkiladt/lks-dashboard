import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/spreadsheets.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token ?? (token as any).accessToken,
          refreshToken: account.refresh_token ?? (token as any).refreshToken,
          expiresAt: account.expires_at ?? (token as any).expiresAt,
        };
      }

      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: (token as any).accessToken,
        refreshToken: (token as any).refreshToken,
        expiresAt: (token as any).expiresAt,
      } as any;
    },
  },
});