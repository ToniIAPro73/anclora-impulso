import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workoutsApi, type Workout } from '@/lib/api';
import { useAuth } from '@/lib/contexts/auth-context';

interface CreateWorkoutParams {
  name: string;
  exercises: Array<{
    exerciseId: string;
    sets: number;
    reps: number;
    rest: number;
    order: number;
  }>;
}

interface GenerateWorkoutParams {
  workoutType: 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'full_body';
  duration: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  trainingEnvironment: 'gym' | 'home' | 'outdoor';
  targetMuscles?: string[];
  equipment?: string[];
  age?: number;
  sex?: 'male' | 'female';
}

/**
 * Hook para obtener entrenamientos del usuario
 * Usa React Query para caché automático
 */
export function useWorkouts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Obtener entrenamientos
  const workoutsQuery = useQuery<Workout[]>({
    queryKey: ['workouts'],
    queryFn: () => workoutsApi.getAll(),
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
  });

  // Crear entrenamiento
  const createMutation = useMutation({
    mutationFn: (data: CreateWorkoutParams) => workoutsApi.create(data),
    onSuccess: (newWorkout) => {
      // Actualizar caché optimísticamente
      queryClient.setQueryData<Workout[]>(['workouts'], (prev) =>
        prev ? [newWorkout, ...prev] : [newWorkout]
      );
    },
  });

  // Eliminar entrenamiento
  const deleteMutation = useMutation({
    mutationFn: (id: string) => workoutsApi.delete(id),
    onSuccess: (_, deletedId) => {
      // Actualizar caché
      queryClient.setQueryData<Workout[]>(['workouts'], (prev) =>
        prev ? prev.filter((w) => w.id !== deletedId) : prev
      );
    },
  });

  // Generar entrenamiento con IA
  const generateMutation = useMutation({
    mutationFn: (params: GenerateWorkoutParams) => workoutsApi.generate(params, user?.id ?? 'anon'),
    onSuccess: (newWorkout) => {
      // Actualizar caché
      queryClient.setQueryData<Workout[]>(['workouts'], (prev) =>
        prev ? [newWorkout, ...prev] : [newWorkout]
      );
    },
  });

  return {
    workouts: workoutsQuery.data ?? [],
    isLoading: workoutsQuery.isLoading,
    error: workoutsQuery.error?.message ?? null,
    refetch: workoutsQuery.refetch,

    // Mutations
    createWorkout: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    deleteWorkout: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    generateWorkout: generateMutation.mutateAsync,
    isGenerating: generateMutation.isPending,

    // Errores de mutaciones
    createError: createMutation.error?.message,
    deleteError: deleteMutation.error?.message,
    generateError: generateMutation.error?.message,
  };
}
