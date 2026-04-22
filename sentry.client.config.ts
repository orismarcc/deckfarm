import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.2,          // 20% of requests traced
  replaysSessionSampleRate: 0.05, // 5% of sessions recorded
  replaysOnErrorSampleRate: 1.0,  // 100% of error sessions recorded
  integrations: [],
})
