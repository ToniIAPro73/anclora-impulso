import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MealPlanImportPanel } from '@/components/nutrition/meal-plan-import-panel';
import {
  nutritionApi,
  type MealPlanImportCommitResponse,
  type MealPlanImportPreviewResponse,
} from '@/lib/api';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    nutritionApi: {
      ...actual.nutritionApi,
      previewImportedMealPlan: jest.fn(),
      commitImportedMealPlan: jest.fn(),
    },
  };
});

const mockedPreview = nutritionApi.previewImportedMealPlan as jest.MockedFunction<
  typeof nutritionApi.previewImportedMealPlan
>;
const mockedCommit = nutritionApi.commitImportedMealPlan as jest.MockedFunction<
  typeof nutritionApi.commitImportedMealPlan
>;

function makeValidPreview(canCommitToDatabase = false): MealPlanImportPreviewResponse {
  return {
    status: 'VALID',
    canImportPreview: true,
    canCommitToDatabase,
    persistenceBlockedReason: canCommitToDatabase ? null : 'M28_REQUIRED_FOR_FULL_PERSISTENCE',
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

function makeCommitSuccess(
  overrides?: Partial<MealPlanImportCommitResponse>
): MealPlanImportCommitResponse {
  return {
    mealPlanId: 'plan-123',
    title: 'Plan 1 Día Económico',
    lifecycleStatus: 'ACTIVE',
    validationStatus: 'VALID',
    importSchemaVersion: 'meal-plan-import-v1',
    importFingerprint: 'a'.repeat(64),
    idempotentReplay: false,
    createdRecipesCount: 1,
    reusedRecipesCount: 0,
    mealsCount: 1,
    ...overrides,
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

  it('renders VALID preview with M28 pending notice and hides save button when flag is off', async () => {
    mockedPreview.mockResolvedValueOnce(makeValidPreview(false));
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
    expect(screen.queryByRole('button', { name: /Confirmar y guardar plan/i })).toBeNull();
  });

  it('renders REJECTED safety blocker without allowing save or single-click override', async () => {
    const rejected: MealPlanImportPreviewResponse = {
      ...makeValidPreview(true),
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

  it('enables save when canCommitToDatabase=true, persists ACTIVE plan, and links to plan detail', async () => {
    mockedPreview.mockResolvedValueOnce(makeValidPreview(true));
    mockedCommit.mockResolvedValueOnce(makeCommitSuccess());

    render(<MealPlanImportPanel isSpanish={true} onCancel={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Plan nutricional JSON/i), {
      target: { value: '{"specVersion":"meal-plan-import-v1"}' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Previsualizar importación/i }));

    const saveBtn = await screen.findByRole('button', { name: /Confirmar y guardar plan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId('import-commit-success')).toBeInTheDocument();
    });
    expect(mockedCommit).toHaveBeenCalledWith({
      rawPayload: '{"specVersion":"meal-plan-import-v1"}',
      previewHash: 'a'.repeat(64),
      requestedLifecycleStatus: 'ACTIVE',
    });
    expect(screen.getByRole('link', { name: /Ver plan/i })).toHaveAttribute(
      'href',
      '/nutrition/meal-plans/plan-123'
    );
  });

  it('forces DRAFT lifecycleStatus for INCOMPLETE plans and supports safe retry after commit error', async () => {
    const incompletePreview: MealPlanImportPreviewResponse = {
      ...makeValidPreview(true),
      status: 'INCOMPLETE',
      summary: {
        ...makeValidPreview(true).summary,
        hasIncompleteNutrition: true,
        hasIncompleteIngredients: true,
      },
    };
    mockedPreview.mockResolvedValueOnce(incompletePreview);
    mockedCommit
      .mockRejectedValueOnce(new Error('Error temporal de red'))
      .mockResolvedValueOnce(
        makeCommitSuccess({
          lifecycleStatus: 'DRAFT',
          validationStatus: 'INCOMPLETE',
          idempotentReplay: true,
        })
      );

    render(<MealPlanImportPanel isSpanish={true} onCancel={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Plan nutricional JSON/i), {
      target: { value: '{"incomplete":true}' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Previsualizar importación/i }));

    const draftBtn = await screen.findByRole('button', { name: /Guardar como borrador \(DRAFT\)/i });
    fireEvent.click(draftBtn);

    expect(await screen.findByText(/Error temporal de red/i)).toBeInTheDocument();

    // Retry safely without losing preview
    fireEvent.click(draftBtn);
    await waitFor(() => {
      expect(screen.getByTestId('import-commit-success')).toHaveTextContent(
        /Plan ya importado anteriormente \(DRAFT\)/i
      );
    });
  });
});
