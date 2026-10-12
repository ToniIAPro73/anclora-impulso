import { prisma } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { issueSession } from './session.service';
import { AppError } from '../middleware/errorHandler';
import type { RegisterInput, LoginInput } from '../utils/validators';
import { isAdminUserId } from '../middleware/admin';
import { normalizeEmail } from '../utils/email';
import { lookupAccountByCanonicalEmail } from './account-lookup.service';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    isAdmin: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Registrar un nuevo usuario
 */
export async function register(data: RegisterInput): Promise<AuthResponse> {
  // F-1: canonical address; a case variant of an existing account is the same account (never a second one).
  const email = normalizeEmail(data.email);

  // Verificar si el usuario ya existe
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError(409, 'El email ya está registrado');
  }

  // Hash de la contraseña
  const passwordHash = await hashPassword(data.password);

  // Crear usuario
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: data.fullName,
    },
  });

  // Crear sesión de servidor y tokens
  const { accessToken, refreshToken } = await issueSession({ id: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isAdmin: isAdminUserId(user.id),
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Lookup by canonical address through the shared policy (account-lookup.service): accounts created before
 * normalization may be stored with mixed case, and when the canonical set holds several accounts none is selected —
 * not even an exact match on the normalized value.
 */
async function findUserByEmail(rawEmail: string) {
  const lookup = await lookupAccountByCanonicalEmail(rawEmail);
  return lookup.status === 'found' ? lookup.user : null;
}

/**
 * Iniciar sesión
 */
export async function login(data: LoginInput): Promise<AuthResponse> {
  const user = await findUserByEmail(data.email);

  if (!user || !user.passwordHash || user.disabledAt) {
    throw new AppError(401, 'Email o contraseña incorrectos');
  }

  // Verificar contraseña
  const isValidPassword = await comparePassword(data.password, user.passwordHash);

  if (!isValidPassword) {
    throw new AppError(401, 'Email o contraseña incorrectos');
  }

  // Crear sesión de servidor y tokens
  const { accessToken, refreshToken } = await issueSession({ id: user.id, email: user.email });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isAdmin: isAdminUserId(user.id),
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Obtener información del usuario actual
 */
export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'Usuario no encontrado');
  }

  return {
    ...user,
    isAdmin: isAdminUserId(user.id),
  };
}
