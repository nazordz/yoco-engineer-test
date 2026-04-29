import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, test, vi, afterEach } from 'vitest';
import { RecipeManager } from './recipe-manager';

const recipes = [
  {
    _id: 'recipe-1',
    title: 'Pasta Night',
    description: 'Tomato sauce with basil and parmesan.',
    servings: 4,
    prepMin: 10,
    cookMin: 20,
    difficulty: 'easy',
    tags: ['quick', 'comfort'],
    ingredients: [
      { name: 'pasta', qty: 400, unit: 'g' },
      { name: 'tomato sauce', qty: 500, unit: 'ml' },
    ],
    steps: ['Boil salted water.', 'Combine pasta with sauce.'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function renderWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RecipeManager />
    </QueryClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RecipeManager', () => {
  test('loads recipes and shows the selected recipe detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ recipes, allTags: ['comfort', 'quick'] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    renderWithClient();

    expect(await screen.findAllByText('Pasta Night')).toHaveLength(2);
    expect(screen.getAllByText('Tomato sauce with basil and parmesan.')).toHaveLength(2);

    await waitFor(() => {
      expect(screen.getByTestId('recipe-detail')).toHaveTextContent('30 min');
    });
  });
});
