import { prisma } from '../config/database';
import { issueSession } from './session.service';
import { isAdminEmail } from '../middleware/admin';
import type { AuthResponse } from './auth.service';

interface OAuthProfile {
  provider: 'google' | 'github';
  providerAccountId: string;
  email: string | null;
  fullName: string | null;
}

/**
 * Encuentra el usuario vinculado a esta cuenta OAuth, o lo crea (vinculando
 * por email si ya existe una cuenta local con contraseña).
 */
export async function findOrCreateOAuthUser(profile: OAuthProfile): Promise<AuthResponse> {
  const existingAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (existingAccount) {
    return buildAuthResponse(existingAccount.user);
  }

  if (!profile.email) {
    throw new Error(`${profile.provider} no devolvió un email verificado`);
  }

  const existingUser = await prisma.user.findUnique({ where: { email: profile.email } });

  const user =
    existingUser ??
    (await prisma.user.create({
      data: {
        email: profile.email,
        passwordHash: null,
        fullName: profile.fullName || profile.email.split('@')[0],
      },
    }));

  await prisma.oAuthAccount.create({
    data: {
      userId: user.id,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      email: profile.email,
    },
  });

  return buildAuthResponse(user);
}

async function buildAuthResponse(user: { id: string; email: string; fullName: string; disabledAt?: Date | null }): Promise<AuthResponse> {
  if (user.disabledAt) {
    throw new Error('Account disabled');
  }
  const { accessToken, refreshToken } = await issueSession({ id: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isAdmin: isAdminEmail(user.email),
    },
    accessToken,
    refreshToken,
  };
}
