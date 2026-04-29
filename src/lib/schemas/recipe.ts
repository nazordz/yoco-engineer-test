import { z } from 'zod';

const TAG_PATTERN = /^[a-z0-9-]+$/;

export function normalizeTitleKey(title: string): string {
  return title.trim().toLocaleLowerCase();
}

export const IngredientSchema = z.object({
  name: z.string().trim().min(1, 'Ingredient name is required').max(80),
  qty: z.coerce.number().positive('Quantity must be greater than 0'),
  unit: z.string().trim().min(1, 'Unit is required').max(20),
});

export type TIngredient = z.infer<typeof IngredientSchema>;

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

export const RecipeObjectSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  description: z.string().trim().min(1, 'Description is required').max(1000),
  servings: z.coerce.number().int().positive('Servings must be greater than 0'),
  prepMin: z.coerce.number().int().nonnegative('Prep time cannot be negative'),
  cookMin: z.coerce.number().int().nonnegative('Cook time cannot be negative'),
  difficulty: DifficultySchema,
  tags: z.array(
    z
      .string()
      .trim()
      .toLowerCase()
      .min(2, 'Tags must be at least 2 characters')
      .max(20, 'Tags must be at most 20 characters')
      .regex(TAG_PATTERN, 'Tags can use lowercase letters, numbers, and hyphens')
  ).max(5, 'Use at most 5 tags'),
  ingredients: z.array(IngredientSchema).min(1, 'Add at least 1 ingredient').max(50),
  steps: z.array(
    z
      .string()
      .trim()
      .min(5, 'Each step must be at least 5 characters')
      .max(500, 'Each step must be at most 500 characters')
  ).min(1, 'Add at least 1 step').max(30),
});

export const RecipeSchema = RecipeObjectSchema.superRefine((recipe, ctx) => {
  const totalMin = recipe.prepMin + recipe.cookMin;
  if (totalMin <= 0 || totalMin > 1440) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['prepMin'],
      message: 'Total prep + cook time must be between 1 and 1440 minutes',
    });
  }

  const seenIngredients = new Map<string, number>();
  recipe.ingredients.forEach((ingredient, index) => {
    const key = ingredient.name.trim().toLocaleLowerCase();
    const firstIndex = seenIngredients.get(key);
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ingredients', index, 'name'],
        message: `Duplicate ingredient name also used at item ${firstIndex + 1}`,
      });
      return;
    }
    seenIngredients.set(key, index);
  });
});

export type TCreateRecipeInput = z.infer<typeof RecipeSchema>;

// Use RecipeObjectSchema for extension since RecipeSchema has refinements
// that can cause .extend() issues
export const RecipeDocumentSchema = RecipeObjectSchema.extend({
  _id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TRecipeDocument = z.infer<typeof RecipeDocumentSchema>;
