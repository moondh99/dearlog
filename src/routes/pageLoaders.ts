export const pageLoaders = {
  auth: () => import('../pages/AuthPage'),
  verify: () => import('../pages/VerifyPage'),
  onboarding: () => import('../pages/OnboardingPage'),
  interview: () => import('../pages/InterviewPage'),
  archive: () => import('../pages/ArchivePage'),
  persona: () => import('../pages/PersonaPage'),
  review: () => import('../pages/ReviewPage'),
  autobiography: () => import('../pages/AutobiographyPage'),
  settings: () => import('../pages/SettingsPage'),
};

export const routePreloads: Record<string, () => Promise<unknown>> = {
  '/auth': pageLoaders.auth,
  '/auth/verify': pageLoaders.verify,
  '/onboarding/role': pageLoaders.onboarding,
  '/onboarding/senior-profile': pageLoaders.onboarding,
  '/': pageLoaders.interview,
  '/archive': pageLoaders.archive,
  '/persona': pageLoaders.persona,
  '/review': pageLoaders.review,
  '/autobiography': pageLoaders.autobiography,
  '/settings': pageLoaders.settings,
};
