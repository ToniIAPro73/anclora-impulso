import nodemailer from 'nodemailer';
import type { Prisma } from '@prisma/client';

import { prisma } from '../config/database';
import { env } from '../config/env';
import { getUserNudges } from './engagement.service';
import { buildScheduledDate, isDueWithinWindow } from './notification-schedule.service';

type NotificationChannel = 'email';
type DeliveryStatus = 'pending' | 'sent' | 'failed';

const transporter =
  env.smtpHost && env.smtpUser && env.smtpPass && env.smtpFrom
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass,
        },
      })
    : null;

function buildLocalDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildNotificationCopy(kind: string, language: 'es' | 'en', href: string) {
  switch (kind) {
    case 'onboarding':
      return language === 'es'
        ? {
            subject: 'Completa tu base de personalización',
            body: `Aún faltan datos clave para afinar entrenamientos, nutrición y seguimiento. Continúa aquí: ${href}`,
          }
        : {
            subject: 'Complete your personalization base',
            body: `Key data is still missing to fine-tune workouts, nutrition, and tracking. Continue here: ${href}`,
          };
    case 'workout':
      return language === 'es'
        ? {
            subject: 'Tienes un entrenamiento útil esperándote',
            body: `Ya tienes una sesión lista y sigues por debajo del objetivo semanal. Retómala aquí: ${href}`,
          }
        : {
            subject: 'A useful workout is waiting for you',
            body: `You already have a ready session and you are still below your weekly target. Resume it here: ${href}`,
          };
    case 'nutrition':
      return language === 'es'
        ? {
            subject: 'Cierra tu registro nutricional de hoy',
            body: `Sin registro diario la pauta pierde capacidad de ajuste. Regístralo aquí: ${href}`,
          }
        : {
            subject: 'Close today’s nutrition log',
            body: `Without daily logging the plan loses adjustment power. Log it here: ${href}`,
          };
    case 'weekly_review':
      return language === 'es'
        ? {
            subject: 'Conviene revisar tu semana',
            body: `Tu progreso pide un pequeño ajuste antes de repetir el mismo patrón. Revísalo aquí: ${href}`,
          }
        : {
            subject: 'It is worth reviewing your week',
            body: `Your progress needs a small adjustment before repeating the same pattern. Review it here: ${href}`,
          };
    default:
      return language === 'es'
        ? {
            subject: 'Es momento de reactivar el ritmo',
            body: `Detectamos una caída reciente de actividad. Vuelve con una acción pequeña y concreta aquí: ${href}`,
          }
        : {
            subject: 'It is time to regain momentum',
            body: `We detected a recent activity drop. Come back with one small, concrete action here: ${href}`,
          };
  }
}

async function createPendingDelivery(params: {
  userId: string;
  email: string;
  kind: string;
  href: string;
  reminderTime: string | null;
  language: 'es' | 'en';
  metadata?: Record<string, unknown>;
}) {
  const now = new Date();
  const scheduledFor = buildScheduledDate(params.reminderTime, now);
  if (!isDueWithinWindow(scheduledFor, now)) {
    return null;
  }

  const dedupeKey = `${params.userId}:${params.kind}:${buildLocalDayKey(now)}`;
  const existing = await prisma.notificationDelivery.findUnique({
    where: { dedupeKey },
  });

  if (existing) {
    return existing;
  }

  const copy = buildNotificationCopy(params.kind, params.language, `${env.frontendUrl}${params.href}`);
  return prisma.notificationDelivery.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      channel: 'email',
      status: 'pending',
      subject: copy.subject,
      body: copy.body,
      href: params.href,
      dedupeKey,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      scheduledFor,
    },
  });
}

async function sendEmailDelivery(deliveryId: string) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  });

  if (!delivery) {
    return null;
  }

  if (!transporter) {
    return prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'failed',
        failureReason: 'SMTP_NOT_CONFIGURED',
      },
    });
  }

  try {
    await transporter.sendMail({
      from: env.smtpFrom,
      to: delivery.user.email,
      subject: delivery.subject,
      text: `Hola ${delivery.user.fullName || ''}\n\n${delivery.body}\n\nAnclora Impulso`,
      html: `<p>Hola ${delivery.user.fullName || ''}</p><p>${delivery.body}</p><p><a href="${env.frontendUrl}${delivery.href || '/dashboard'}">Abrir Anclora Impulso</a></p>`,
    });

    return prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        failureReason: null,
      },
    });
  } catch (error) {
    return prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      },
    });
  }
}

export async function dispatchDueNotifications() {
  const users = await prisma.user.findMany({
    where: {
      remindersEnabled: true,
    },
    select: {
      id: true,
      email: true,
      reminderTime: true,
    },
  });

  const createdDeliveries = await Promise.all(
    users.map(async (user) => {
      const nudgeResponse = await getUserNudges(user.id);
      const firstNudge = nudgeResponse.nudges[0];
      if (!firstNudge) {
        return null;
      }

      return createPendingDelivery({
        userId: user.id,
        email: user.email,
        kind: firstNudge.kind,
        href: firstNudge.href,
        reminderTime: nudgeResponse.reminderTime,
        language: 'es',
        metadata: firstNudge.context as Record<string, unknown> | undefined,
      });
    }),
  );

  const pendingDeliveries = createdDeliveries.filter(Boolean) as Array<{ id: string }>;
  const sent = await Promise.all(pendingDeliveries.map((delivery) => sendEmailDelivery(delivery.id)));

  return {
    created: pendingDeliveries.length,
    sent: sent.filter((item) => item?.status === 'sent').length,
    failed: sent.filter((item) => item?.status === 'failed').length,
  };
}

export async function getRecentDeliveries(limit = 20) {
  return prisma.notificationDelivery.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  });
}

export async function getUserDeliveries(userId: string, limit = 10) {
  return prisma.notificationDelivery.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
