import mongoose, { type Document, type Model } from 'mongoose';
import { normalizeTitleKey, type TCreateRecipeInput } from '@/lib/schemas/recipe';

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
    titleKey: { type: String, required: true, unique: true, index: true },
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

recipeMongooseSchema.pre('validate', function setTitleKey() {
  const recipe = this as Document & { title?: string; titleKey?: string };
  if (recipe.title) {
    recipe.title = recipe.title.trim();
    recipe.titleKey = normalizeTitleKey(recipe.title);
  }
});

export type TRecipeModelDocument = TCreateRecipeInput & { titleKey: string } & Document;

export const RecipeModel: Model<TRecipeModelDocument> =
  (mongoose.models['Recipe'] as Model<TRecipeModelDocument> | undefined) ??
  mongoose.model<TRecipeModelDocument>('Recipe', recipeMongooseSchema);
