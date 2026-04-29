import { type NextRequest, NextResponse } from 'next/server';
import type { FilterQuery } from 'mongoose';
import { connectDB } from '@/lib/db';
import {
  DifficultySchema,
  type TCreateRecipeInput,
} from '@/lib/schemas/recipe';
import { RecipeModel } from '@/lib/models/recipe';
import {
  duplicateTitleResponse,
  errorResponse,
  findTitleConflict,
  parseRecipeRequest,
  serializeRecipe,
  validationErrorResponse,
} from '@/lib/recipe-api';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const tags = searchParams
      .getAll('tag')
      .flatMap((tag) => tag.split(','))
      .map((tag) => tag.trim().toLocaleLowerCase())
      .filter(Boolean);
    const difficultyResult = DifficultySchema.optional().safeParse(
      searchParams.get('difficulty') || undefined
    );
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const filters: FilterQuery<TCreateRecipeInput>[] = [];

    if (search) {
      const term = new RegExp(escapeRegExp(search), 'i');
      filters.push({
        $or: [
          { title: term },
          { description: term },
          { tags: term },
          { 'ingredients.name': term },
          { steps: term },
        ],
      });
    }

    if (tags.length > 0) {
      filters.push({ tags: { $all: [...new Set(tags)] } });
    }

    if (difficultyResult.success && difficultyResult.data) {
      filters.push({ difficulty: difficultyResult.data });
    }

    const filter = filters.length > 0 ? { $and: filters } : {};
    const [total, recipes, allTags] = await Promise.all([
      RecipeModel.countDocuments(filter),
      RecipeModel.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      RecipeModel.distinct('tags'),
    ]);

    return NextResponse.json({
      recipes: recipes.map(serializeRecipe),
      allTags: allTags.sort(),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const parsed = await parseRecipeRequest(request);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error);
    }

    const conflict = await findTitleConflict(parsed.data);
    if (conflict) {
      return duplicateTitleResponse();
    }

    const recipe = await RecipeModel.create(parsed.data);
    return NextResponse.json(serializeRecipe(recipe), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
