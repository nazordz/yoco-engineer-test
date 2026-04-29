import { type NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { normalizeTitleKey } from '@/lib/schemas/recipe';
import { RecipeModel } from '@/lib/models/recipe';
import {
  duplicateTitleResponse,
  errorResponse,
  findTitleConflict,
  parseRecipeRequest,
  serializeRecipe,
  validationErrorResponse,
} from '@/lib/recipe-api';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;
    const recipe = await RecipeModel.findById(id).lean();

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    return NextResponse.json(serializeRecipe(recipe));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;

    const parsed = await parseRecipeRequest(request);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const conflict = await findTitleConflict(parsed.data, id);
    if (conflict) {
      return duplicateTitleResponse();
    }

    const recipe = await RecipeModel.findByIdAndUpdate(
      id,
      { ...parsed.data, titleKey: normalizeTitleKey(parsed.data.title) },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    return NextResponse.json(serializeRecipe(recipe));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await connectDB();
    const { id } = await context.params;
    const recipe = await RecipeModel.findByIdAndDelete(id).lean();

    if (!recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, recipe: serializeRecipe(recipe) });
  } catch (error) {
    return errorResponse(error);
  }
}
