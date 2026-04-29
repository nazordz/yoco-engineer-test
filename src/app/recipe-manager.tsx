"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  normalizeTitleKey,
  RecipeSchema,
  type TCreateRecipeInput,
  type TRecipeDocument,
} from "@/lib/schemas/recipe";
import { recipeKeys } from "@/lib/recipe-keys";

const difficultyOptions = ["easy", "medium", "hard"] as const;

type RecipeListResult = {
  recipes: TRecipeDocument[];
  allTags: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type FormErrors = Record<string, string>;

function emptyRecipe(): TCreateRecipeInput {
  return {
    title: "",
    description: "",
    servings: 4,
    prepMin: 10,
    cookMin: 20,
    difficulty: "easy",
    tags: [],
    ingredients: [{ name: "", qty: 1, unit: "g" }],
    steps: [""],
  };
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const json = (await response.json().catch(() => ({}))) as {
    error?: string;
    issues?: { path: string; message: string }[];
  };

  if (!response.ok) {
    const firstIssue = json.issues?.[0];
    throw new Error(
      firstIssue
        ? `${firstIssue.path}: ${firstIssue.message}`
        : (json.error ?? "Request failed"),
    );
  }

  return json as T;
}

async function fetchRecipes(filters: {
  search?: string;
  tags?: string[];
  difficulty?: string;
  page?: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.difficulty) params.set("difficulty", filters.difficulty);
  filters.tags?.forEach((tag) => params.append("tag", tag));
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

  const response = await fetch(
    `/api/recipes${params.size ? `?${params}` : ""}`,
  );
  return readJsonOrThrow<RecipeListResult>(response);
}

async function createRecipe(recipe: TCreateRecipeInput) {
  const response = await fetch("/api/recipes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(recipe),
  });
  return readJsonOrThrow<TRecipeDocument>(response);
}

async function updateRecipe({
  id,
  recipe,
}: {
  id: string;
  recipe: TCreateRecipeInput;
}) {
  const response = await fetch(`/api/recipes/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(recipe),
  });
  return readJsonOrThrow<TRecipeDocument>(response);
}

async function deleteRecipe(id: string) {
  const response = await fetch(`/api/recipes/${id}`, { method: "DELETE" });
  return readJsonOrThrow<{ deleted: true; recipe: TRecipeDocument }>(response);
}

function zodErrorsToMap(error: {
  issues: { path: (string | number)[]; message: string }[];
}) {
  return error.issues.reduce<FormErrors>((acc, issue) => {
    const path = issue.path.join(".");
    if (!acc[path]) acc[path] = issue.message;
    return acc;
  }, {});
}

function RecipeChips({ recipe }: { recipe: TRecipeDocument }) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
      <Chip
        label={recipe.difficulty}
        size="small"
        color={
          recipe.difficulty === "easy"
            ? "success"
            : recipe.difficulty === "medium"
              ? "warning"
              : "error"
        }
      />
      <Chip
        label={`${recipe.prepMin + recipe.cookMin} min`}
        size="small"
        variant="outlined"
      />
      {recipe.tags.map((tag) => (
        <Chip key={tag} label={tag} size="small" variant="outlined" />
      ))}
    </Box>
  );
}

export function RecipeManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TCreateRecipeInput>(() => emptyRecipe());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      tags: selectedTags,
      difficulty: difficulty || undefined,
      page,
      pageSize,
    }),
    [difficulty, search, selectedTags, page],
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, selectedTags, difficulty]);

  const { data, isLoading, error } = useQuery({
    queryKey: recipeKeys.list(filters),
    queryFn: () => fetchRecipes(filters),
  });

  const recipes = data?.recipes ?? [];
  const allTags = data?.allTags ?? [];
  const selectedRecipe =
    recipes.find((recipe) => recipe._id === selectedId) ?? recipes[0] ?? null;

  useEffect(() => {
    if (!selectedRecipe) {
      setSelectedId(null);
      return;
    }
    if (selectedRecipe._id !== selectedId) {
      setSelectedId(selectedRecipe._id);
    }
  }, [selectedId, selectedRecipe]);

  const invalidateRecipes = async () => {
    await queryClient.invalidateQueries({ queryKey: recipeKeys.lists() });
  };

  const createMutation = useMutation({
    mutationFn: createRecipe,
    onSuccess: async (recipe) => {
      await invalidateRecipes();
      setSelectedId(recipe._id);
      closeForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateRecipe,
    onSuccess: async (recipe) => {
      await invalidateRecipes();
      setSelectedId(recipe._id);
      closeForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: async () => {
      await invalidateRecipes();
      setDeleteOpen(false);
      setSelectedId(null);
    },
  });

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyRecipe());
    setFormErrors({});
    createMutation.reset();
    updateMutation.reset();
  }

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyRecipe());
    setFormErrors({});
    setFormOpen(true);
  }

  function openEditForm(recipe: TRecipeDocument) {
    setEditingId(recipe._id);
    setForm({
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepMin: recipe.prepMin,
      cookMin: recipe.cookMin,
      difficulty: recipe.difficulty,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function setField<Field extends keyof TCreateRecipeInput>(
    field: Field,
    value: TCreateRecipeInput[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.reset();
    updateMutation.reset();

    const parsed = RecipeSchema.safeParse(form);
    if (!parsed.success) {
      setFormErrors(zodErrorsToMap(parsed.error));
      return;
    }

    const titleKey = normalizeTitleKey(parsed.data.title);
    const duplicate = recipes.some(
      (recipe) =>
        recipe._id !== editingId &&
        normalizeTitleKey(recipe.title) === titleKey,
    );
    if (duplicate) {
      setFormErrors({ title: "Title must be unique" });
      return;
    }

    setFormErrors({});
    if (editingId) {
      updateMutation.mutate({ id: editingId, recipe: parsed.data });
      return;
    }
    createMutation.mutate(parsed.data);
  }

  const mutationError = createMutation.error ?? updateMutation.error;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 2,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
              Recipe Manager
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data?.pagination
                ? `${data.pagination.total} recipes (page ${data.pagination.page} of ${data.pagination.totalPages})`
                : `${recipes.length} recipes shown`}
            </Typography>
          </Box>
          <Button variant="contained" onClick={openCreateForm}>
            New recipe
          </Button>
        </Box>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: "minmax(220px, 1fr) minmax(220px, 1fr) 180px",
              },
            }}
          >
            <TextField
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              size="small"
              inputProps={{ "aria-label": "Search recipes" }}
            />
            <Autocomplete
              multiple
              options={allTags}
              value={selectedTags}
              onChange={(_event, value) => setSelectedTags(value)}
              renderInput={(params) => (
                <TextField {...params} label="Tags" size="small" />
              )}
            />
            <TextField
              select
              label="Difficulty"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value)}
              size="small"
            >
              <MenuItem value="">All</MenuItem>
              {difficultyOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error">
            {error instanceof Error ? error.message : "Failed to load recipes"}
          </Alert>
        )}

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gap: 3,
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(300px, 420px) 1fr",
              },
              alignItems: "start",
            }}
          >
            <Stack
              spacing={1.5}
              sx={{
                maxHeight: { lg: "68vh" },
                overflow: { lg: "auto" },
                pr: { lg: 1 },
              }}
              data-testid="recipe-list"
            >
              {recipes.length === 0 && (
                <Paper variant="outlined" sx={{ p: 3, textAlign: "center" }}>
                  <Typography>No recipes match the current filters.</Typography>
                </Paper>
              )}
              {recipes.map((recipe) => {
                const isSelected = selectedRecipe?._id === recipe._id;
                return (
                  <Card
                    key={recipe._id}
                    variant="outlined"
                    data-testid="recipe-card"
                    sx={{
                      borderColor: isSelected ? "primary.main" : "divider",
                      minHeight: 'fit-content'
                    }}
                  >
                    <CardActionArea onClick={() => setSelectedId(recipe._id)}>
                      <CardContent>
                        <Stack spacing={1}>
                          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                            {recipe.title}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {recipe.description}
                          </Typography>
                          <RecipeChips recipe={recipe} />
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                );
              })}
              {data?.pagination && data.pagination.totalPages > 1 && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    gap: 1,
                    pt: 2,
                  }}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Typography sx={{ display: "flex", alignItems: "center", px: 2 }}>
                    Page {data.pagination.page} of {data.pagination.totalPages}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={page >= data.pagination.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </Box>
              )}
            </Stack>

            {selectedRecipe && (
              <Paper
                variant="outlined"
                sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}
                data-testid="recipe-detail"
              >
                <Stack spacing={2.25}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Box>
                      <Typography
                        variant="h5"
                        component="h2"
                        sx={{ fontWeight: 700 }}
                      >
                        {selectedRecipe.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedRecipe.servings} servings
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        onClick={() => openEditForm(selectedRecipe)}
                      >
                        Edit
                      </Button>
                      <Button
                        color="error"
                        variant="outlined"
                        onClick={() => setDeleteOpen(true)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Box>

                  <RecipeChips recipe={selectedRecipe} />
                  <Typography>{selectedRecipe.description}</Typography>

                  <Divider />

                  <Box
                    sx={{
                      display: "grid",
                      gap: 2,
                      gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                    }}
                  >
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Prep
                      </Typography>
                      <Typography>{selectedRecipe.prepMin} min</Typography>
                    </Box>
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Cook
                      </Typography>
                      <Typography>{selectedRecipe.cookMin} min</Typography>
                    </Box>
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Total
                      </Typography>
                      <Typography>
                        {selectedRecipe.prepMin + selectedRecipe.cookMin} min
                      </Typography>
                    </Box>
                  </Box>

                  <Divider />

                  <Box>
                    <Typography variant="h6">Ingredients</Typography>
                    <Stack component="ul" spacing={0.75} sx={{ pl: 3, mt: 1 }}>
                      {selectedRecipe.ingredients.map((ingredient, index) => (
                        <Typography
                          component="li"
                          key={`${ingredient.name}-${index}`}
                        >
                          {ingredient.qty} {ingredient.unit} {ingredient.name}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="h6">Steps</Typography>
                    <Stack component="ol" spacing={1} sx={{ pl: 3, mt: 1 }}>
                      {selectedRecipe.steps.map((step, index) => (
                        <Typography
                          component="li"
                          key={`${index}-${step.slice(0, 20)}`}
                        >
                          {step}
                        </Typography>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </Paper>
            )}
          </Box>
        )}
      </Stack>

      <Dialog open={formOpen} onClose={closeForm} fullWidth maxWidth="md">
        <Box component="form" onSubmit={submitForm}>
          <DialogTitle>
            {editingId ? "Edit recipe" : "Create recipe"}
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2.25} sx={{ pt: 0.5 }}>
              {mutationError && (
                <Alert severity="error">{mutationError.message}</Alert>
              )}

              <TextField
                label="Title"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                error={Boolean(formErrors.title)}
                helperText={formErrors.title}
                fullWidth
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(event) =>
                  setField("description", event.target.value)
                }
                error={Boolean(formErrors.description)}
                helperText={formErrors.description}
                multiline
                minRows={3}
                fullWidth
              />

              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(4, 1fr)" },
                }}
              >
                <TextField
                  label="Servings"
                  type="number"
                  value={form.servings}
                  onChange={(event) =>
                    setField("servings", Number(event.target.value))
                  }
                  error={Boolean(formErrors.servings)}
                  helperText={formErrors.servings}
                />
                <TextField
                  label="Prep min"
                  type="number"
                  value={form.prepMin}
                  onChange={(event) =>
                    setField("prepMin", Number(event.target.value))
                  }
                  error={Boolean(formErrors.prepMin)}
                  helperText={formErrors.prepMin}
                />
                <TextField
                  label="Cook min"
                  type="number"
                  value={form.cookMin}
                  onChange={(event) =>
                    setField("cookMin", Number(event.target.value))
                  }
                  error={Boolean(formErrors.cookMin)}
                  helperText={formErrors.cookMin}
                />
                <TextField
                  select
                  label="Difficulty"
                  value={form.difficulty}
                  onChange={(event) =>
                    setField(
                      "difficulty",
                      event.target.value as TCreateRecipeInput["difficulty"],
                    )
                  }
                >
                  {difficultyOptions.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              </Box>

              <Autocomplete
                multiple
                freeSolo
                options={allTags}
                value={form.tags}
                onChange={(_event, value) =>
                  setField("tags", value.map(String).slice(0, 5))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    error={Boolean(formErrors.tags)}
                    helperText={formErrors.tags ?? "Lowercase tags, max 5"}
                  />
                )}
              />

              <Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <Typography variant="h6">Ingredients</Typography>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() =>
                      setField("ingredients", [
                        ...form.ingredients,
                        { name: "", qty: 1, unit: "g" },
                      ])
                    }
                  >
                    Add ingredient
                  </Button>
                </Box>
                <Stack spacing={1.25}>
                  {form.ingredients.map((ingredient, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: "grid",
                        gap: 1,
                        gridTemplateColumns: {
                          xs: "1fr",
                          sm: "1fr 110px 110px auto",
                        },
                      }}
                    >
                      <TextField
                        label="Name"
                        value={ingredient.name}
                        onChange={(event) => {
                          const ingredients = form.ingredients.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, name: event.target.value }
                                : item,
                          );
                          setField("ingredients", ingredients);
                        }}
                        error={Boolean(formErrors[`ingredients.${index}.name`])}
                        helperText={formErrors[`ingredients.${index}.name`]}
                      />
                      <TextField
                        label="Qty"
                        type="number"
                        value={ingredient.qty}
                        onChange={(event) => {
                          const ingredients = form.ingredients.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, qty: Number(event.target.value) }
                                : item,
                          );
                          setField("ingredients", ingredients);
                        }}
                      />
                      <TextField
                        label="Unit"
                        value={ingredient.unit}
                        onChange={(event) => {
                          const ingredients = form.ingredients.map(
                            (item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, unit: event.target.value }
                                : item,
                          );
                          setField("ingredients", ingredients);
                        }}
                      />
                      <Button
                        type="button"
                        color="error"
                        disabled={form.ingredients.length <= 1}
                        onClick={() =>
                          setField(
                            "ingredients",
                            form.ingredients.filter(
                              (_item, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </Box>
                  ))}
                </Stack>
                {formErrors.ingredients && (
                  <Typography color="error" variant="caption">
                    {formErrors.ingredients}
                  </Typography>
                )}
              </Box>

              <Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 1,
                  }}
                >
                  <Typography variant="h6">Steps</Typography>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => setField("steps", [...form.steps, ""])}
                  >
                    Add step
                  </Button>
                </Box>
                <Stack spacing={1.25}>
                  {form.steps.map((step, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: "grid",
                        gap: 1,
                        gridTemplateColumns: { xs: "1fr", sm: "1fr auto" },
                      }}
                    >
                      <TextField
                        label={`Step ${index + 1}`}
                        value={step}
                        onChange={(event) => {
                          const steps = form.steps.map((item, itemIndex) =>
                            itemIndex === index ? event.target.value : item,
                          );
                          setField("steps", steps);
                        }}
                        error={Boolean(formErrors[`steps.${index}`])}
                        helperText={formErrors[`steps.${index}`]}
                        multiline
                      />
                      <Button
                        type="button"
                        color="error"
                        disabled={form.steps.length <= 1}
                        onClick={() =>
                          setField(
                            "steps",
                            form.steps.filter(
                              (_item, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </Box>
                  ))}
                </Stack>
                {formErrors.steps && (
                  <Typography color="error" variant="caption">
                    {formErrors.steps}
                  </Typography>
                )}
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save recipe"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete recipe?</DialogTitle>
        <DialogContent>
          <Typography>
            {selectedRecipe
              ? `Delete "${selectedRecipe.title}"? This cannot be undone.`
              : "Delete this recipe?"}
          </Typography>
          {deleteMutation.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteMutation.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={!selectedRecipe || deleteMutation.isPending}
            onClick={() =>
              selectedRecipe && deleteMutation.mutate(selectedRecipe._id)
            }
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
