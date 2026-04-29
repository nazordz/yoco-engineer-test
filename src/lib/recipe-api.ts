import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import {
  normalizeTitleKey,
  RecipeSchema,
  type TCreateRecipeInput,
  type TRecipeDocument,
} from '@/lib/schemas/recipe';
import { RecipeModel } from '@/lib/models/recipe';

export const RecipeListResponseSchema = z.object({
  recipes: z.array(z.any()),
  allTags: z.array(z.string()),
});

export function serializeRecipe(recipe: unknown): TRecipeDocument {
  const value =
    recipe && typeof recipe === 'object' && 'toObject' in recipe
      ? (recipe as { toObject: () => Record<string, unknown> }).toObject()
      : (recipe as Record<string, unknown>);

  return {
    ...value,
    _id: String(value._id),
    createdAt: new Date(value.createdAt as string | Date).toISOString(),
    updatedAt: new Date(value.updatedAt as string | Date).toISOString(),
  } as TRecipeDocument;
}

export function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    {
      error: 'Validation failed',
      issues: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    },
    { status: 400 }
  );
}

export function errorResponse(error: unknown, status = 500) {
  if (error instanceof mongoose.Error.CastError) {
    return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({ error: message }, { status });
}

export async function parseRecipeRequest(request: Request) {
  const body: unknown = await request.json();
  return RecipeSchema.safeParse(body);
}

export async function findTitleConflict(
  recipe: Pick<TCreateRecipeInput, 'title'>,
  currentId?: string
) {
  const titleKey = normalizeTitleKey(recipe.title);
  const query = currentId ? { titleKey, _id: { $ne: currentId } } : { titleKey };
  return RecipeModel.findOne(query).select('_id title').lean();
}

export function duplicateTitleResponse() {
  return NextResponse.json(
    {
      error: 'Validation failed',
      issues: [{ path: 'title', message: 'Title must be unique' }],
    },
    { status: 409 }
  );
}
