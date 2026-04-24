import { z } from 'zod';
import mongoose, { type Document, type Model } from 'mongoose';

// ---------------------------------------------------------------------------
// Zod schemas — define SHAPE only.
// Business rules (uniqueness, length limits, dedup logic, etc.) are NOT
// enforced here; they are part of the interview challenge for the candidate.
// ---------------------------------------------------------------------------

export const IngredientSchema = z.object({
  name: z.string(),
  qty: z.number(),
  unit: z.string(),
});

export type TIngredient = z.infer<typeof IngredientSchema>;

export const RecipeSchema = z.object({
  title: z.string(),
  description: z.string(),
  servings: z.number().int().positive(),
  prepMin: z.number().int().nonnegative(),
  cookMin: z.number().int().nonnegative(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tags: z.array(z.string()),
  ingredients: z.array(IngredientSchema),
  steps: z.array(z.string()),
});

export type TCreateRecipeInput = z.infer<typeof RecipeSchema>;

export const RecipeDocumentSchema = RecipeSchema.extend({
  _id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TRecipeDocument = z.infer<typeof RecipeDocumentSchema>;

// ---------------------------------------------------------------------------
// Mongoose schema
// ---------------------------------------------------------------------------

const ingredientMongooseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    unit: { type: String, required: true },
  },
  { _id: false }
);

const recipeMongooseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    servings: { type: Number, required: true },
    prepMin: { type: Number, required: true },
    cookMin: { type: Number, required: true },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
    },
    tags: [{ type: String }],
    ingredients: [ingredientMongooseSchema],
    steps: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

// HMR-safe model creation (prevents "Cannot overwrite model" error in Next.js dev)
export const RecipeModel: Model<TCreateRecipeInput & Document> =
  (mongoose.models['Recipe'] as Model<TCreateRecipeInput & Document> | undefined) ??
  mongoose.model<TCreateRecipeInput & Document>('Recipe', recipeMongooseSchema);
