import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MealPlanImportPanel } from '@/components/nutrition/meal-plan-import-panel';
import { nutritionApi, type MealPlanImportPreviewResponse } from '@/lib/api';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    nutritionApi: {
      ...actual.nutritionApi,
      previewImportedMealPlan: jest.fn(),
    },
  };
});

const mockedPreview = nutritionApi.previewImportedMealPlan as jest.MockedFunction<
  typeof nutritionApi.previewImportedMealPlan
>;

function makeValidPreview(): MealPlanImportPreviewResponse {
  return {
    status: 'VALID',
    canImportPreview: true,
    canCommitToDatabase: false,
    persistenceBlockedReason: 'M28_REQUIRED_FOR_FULL_PERSISTENCE',
    previewHash: 'a'.repeat(64),
    validation: {
      status: 'VALID',
      normalizedPlan: {
        title: 'Plan 1 Día Económico',
        preferences: {
          dietType: 'ninguna',
          locale: 'es-ES',
          daysCount: 1,
          budgetTier: 'economico',
          maxMainIngredients: 5,
          excludedEquipment: ['horno_convencional'],
          excludedFoods: [],
          dietaryRestrictions: [],
          mealTimes: ['08:30', '14:00', '21:00'],
        },
        days: [
          {
            dayIndex: 0,
            meals: [
              {
                mealType: 'desayuno',
                scheduledTime: '08:30',
                recipe: { externalId: 'r1', name: 'Avena con plátano', servings: 1 },
              },
            ],
          },
        ],
      },
      errors: [],
      warnings: [],
      missingData: [],
      safetyFlags: [],
    },
    summary: {
      title: 'Plan 1 Día Económico',
      dietType: 'ninguna',
      locale: 'es-ES',
      daysCount: 1,
      mealsCount: 1,
      recipesCount: 1,
      hasIncompleteNutrition: false,
      hasIncompleteIngredients: false,
    },
    shoppingList: {
      aggregatedItems: [
        { name: 'Copos de avena', unit: 'g', totalQuantity: 60, occurrences: 1, isBasePantry: false },
      ],
      unconvertibleItems: [],
      isExact: true,
    },
    duplicateMatches: [],
    batchCookingWarnings: [],
  };
}

describe('MealPlanImportPanel (TASK-036)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation alert when previewing empty input', async () => {
    render(<MealPlanImportPanel isSpanish={true} onCancel={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Previsualizar importación/i }));

    expect(
      await screen.findByText(/Pega un plan JSON o carga un archivo \.json/i)
    ).toBeInTheDocument();
    expect(mockedPreview).not.toHaveBeenCalled();
  });

  it('renders VALID preview with summary, preferences, shopping list and M28 pending notice', async () => {
    mockedPreview.mockResolvedValueOnce(makeValidPreview());
    render(<MealPlanImportPanel isSpanish={true} onCancel={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Plan nutricional JSON/i), {
      target: { value: '{"specVersion":"meal-plan-import-v1"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Previsualizar importación/i }));

    await waitFor(() => {
      expect(screen.getByTestId('import-preview-status')).toHaveTextContent('VALID');
    });
    expect(screen.getByText('Plan 1 Día Económico')).toBeInTheDocument();
    expect(screen.getByText(/Copos de avena: 60 g/i)).toBeInTheDocument();
    expect(screen.getByText(/pendiente de la migración M28/i)).toBeInTheDocument();
  });

  it('renders REJECTED safety blocker without allowing single-click override', async () => {
    const rejected: MealPlanImportPreviewResponse = {
      ...makeValidPreview(),
      status: 'REJECTED',
      canImportPreview: false,
      previewHash: null,
      validation: {
        status: 'REJECTED',
        normalizedPlan: null,
        errors: [{ code: 'SAFETY_BLOCK', message: 'Contenido no seguro detectado' }],
        warnings: [],
        missingData: [],
        safetyFlags: ['UNTRUSTED_CONTENT'],
      },
    };
    mockedPreview.mockResolvedValueOnce(rejected);
    render(<MealPlanImportPanel isSpanish={true} onCancel={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Plan nutricional JSON/i), {
      target: { value: '{"bad":true}' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Previsualizar importación/i }));

    await waitFor(() => {
      expect(screen.getByTestId('import-preview-status')).toHaveTextContent('REJECTED');
    });
    expect(screen.getByText(/Importación bloqueada por seguridad/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar|Guardar|Forzar/i })).toBeNull();
  });
});

