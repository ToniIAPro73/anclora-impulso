import { prisma } from '../config/database';
import { hashPassword, comparePassword } from '../utils/password';
import { issueSession } from './session.service';
import { AppError } from '../middleware/errorHandler';
import type { RegisterInput, LoginInput } from '../utils/validators';
import { isAdminEmail } from '../middleware/admin';

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
  // Verificar si el usuario ya existe
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new AppError(409, 'El email ya está registrado');
  }

  // Hash de la contraseña
  const passwordHash = await hashPassword(data.password);

  // Crear usuario
  const user = await prisma.user.create({
    data: {
      email: data.email,
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
      isAdmin: isAdminEmail(user.email),
    },
    accessToken,
    refreshToken,
  };
}

/**
 * Iniciar sesión
 */
export async function login(data: LoginInput): Promise<AuthResponse> {
  // Buscar usuario
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

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
      isAdmin: isAdminEmail(user.email),
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
    isAdmin: isAdminEmail(user.email),
  };
}
