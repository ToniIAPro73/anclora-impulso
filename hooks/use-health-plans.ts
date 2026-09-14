import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { healthPlansApi } from '@/lib/api';
import { useLanguage } from '@/lib/contexts/language-context';

export function useHealthPlan() {
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const locale = language === 'en' ? 'en' : 'es';
  const homeQuery = useQuery({
    queryKey: ['health-plan-home', locale],
    queryFn: () => healthPlansApi.getHome(locale),
    staleTime: 60_000,
  });
  const definitionsQuery = useQuery({
    queryKey: ['health-plan-definitions', locale],
    queryFn: () => healthPlansApi.listDefinitions(locale),
    staleTime: 5 * 60_000,
  });
  const enrollMutation = useMutation({
    mutationFn: () => healthPlansApi.enroll(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health-plan-home'] }),
  });
  const completeMutation = useMutation({
    mutationFn: (actionId: string) => healthPlansApi.completeAction(actionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health-plan-home'] }),
  });
  const onboardingMutation = useMutation({
    mutationFn: healthPlansApi.saveOnboarding,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['health-plan-home'] }),
  });

  return {
    home: homeQuery.data ?? null,
    definition: definitionsQuery.data?.[0] ?? null,
    isLoading: homeQuery.isLoading || definitionsQuery.isLoading,
    error: homeQuery.error?.message ?? definitionsQuery.error?.message ?? enrollMutation.error?.message ?? null,
    enroll: enrollMutation.mutateAsync,
    completeAction: completeMutation.mutateAsync,
    saveOnboarding: onboardingMutation.mutateAsync,
    isEnrolling: enrollMutation.isPending,
    isCompleting: completeMutation.isPending,
    isSavingOnboarding: onboardingMutation.isPending,
  };
}
