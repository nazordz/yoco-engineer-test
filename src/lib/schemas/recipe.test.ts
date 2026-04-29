import { describe, test, expect } from 'vitest';
import { RecipeSchema, IngredientSchema } from './recipe';
import { RecipeModel } from '@/lib/models/recipe';

const validRecipe = {
  title: 'Classic Spaghetti',
  description: 'A simple pasta dish with tomato sauce.',
  servings: 4,
  prepMin: 10,
  cookMin: 20,
  difficulty: 'easy' as const,
  tags: ['quick', 'comfort'],
  ingredients: [
    { name: 'Spaghetti', qty: 400, unit: 'g' },
    { name: 'Tomato sauce', qty: 500, unit: 'ml' },
  ],
  steps: [
    'Boil salted water.',
    'Cook pasta for 10 minutes.',
    'Heat the sauce and combine.',
  ],
};

describe('RecipeSchema', () => {
  test('accepts a valid recipe', () => {
    const result = RecipeSchema.safeParse(validRecipe);
    expect(result.success).toBe(true);
  });

  test('rejects a recipe with missing title field', () => {
    const { title: _title, ...noTitle } = validRecipe;
    const result = RecipeSchema.safeParse(noTitle);
    expect(result.success).toBe(false);
  });

  test('rejects an invalid difficulty value', () => {
    const result = RecipeSchema.safeParse({
      ...validRecipe,
      difficulty: 'extreme',
    });
    expect(result.success).toBe(false);
  });

  test('rejects a recipe with invalid total time', () => {
    const result = RecipeSchema.safeParse({ ...validRecipe, prepMin: 0, cookMin: 0 });
    expect(result.success).toBe(false);
  });

  test('rejects duplicate ingredient names case-insensitively', () => {
    const result = RecipeSchema.safeParse({
      ...validRecipe,
      ingredients: [
        { name: 'Salt', qty: 5, unit: 'g' },
        { name: 'salt', qty: 3, unit: 'g' },
      ],
    });
    expect(result.success).toBe(false);
  });

  test('rejects more than five tags and invalid tag format', () => {
    const tooManyTags = RecipeSchema.safeParse({
      ...validRecipe,
      tags: ['quick', 'comfort', 'pasta', 'dinner', 'sauce', 'extra'],
    });
    const invalidTag = RecipeSchema.safeParse({
      ...validRecipe,
      tags: ['Quick!'],
    });

    expect(tooManyTags.success).toBe(false);
    expect(invalidTag.success).toBe(false);
  });

  test('rejects steps outside the allowed length and count', () => {
    const shortStep = RecipeSchema.safeParse({ ...validRecipe, steps: ['mix'] });
    const tooManySteps = RecipeSchema.safeParse({
      ...validRecipe,
      steps: Array.from({ length: 31 }, (_, index) => `Valid preparation step ${index}`),
    });

    expect(shortStep.success).toBe(false);
    expect(tooManySteps.success).toBe(false);
  });
});

describe('RecipeModel', () => {
  test('can create and retrieve a recipe document', async () => {
    const created = await RecipeModel.create(validRecipe);
    expect(created._id).toBeDefined();
    expect(created.title).toBe('Classic Spaghetti');

    const found = await RecipeModel.findById(created._id).lean();
    expect(found).not.toBeNull();
    expect(found?.title).toBe('Classic Spaghetti');
    expect(found?.titleKey).toBe('classic spaghetti');
  });

  test('enforces normalized title uniqueness', async () => {
    await RecipeModel.syncIndexes();
    await RecipeModel.create(validRecipe);

    await expect(
      RecipeModel.create({ ...validRecipe, title: '  classic spaghetti  ' })
    ).rejects.toThrow();
  });
});
