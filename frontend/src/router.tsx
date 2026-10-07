import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './components/Layout'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { RecipesPage } from './pages/RecipesPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/recipes" replace /> },
      { path: 'recipes', element: <RecipesPage /> },
      { path: 'recipes/new', element: <PlaceholderPage title="New recipe" /> },
      { path: 'recipes/:slug', element: <PlaceholderPage title="Recipe" /> },
      { path: 'recipes/:slug/edit', element: <PlaceholderPage title="Edit recipe" /> },
      { path: 'week', element: <PlaceholderPage title="This week" /> },
      { path: 'shopping', element: <PlaceholderPage title="Shopping list" /> },
      { path: 'settings', element: <PlaceholderPage title="Settings" /> },
      { path: '*', element: <PlaceholderPage title="Page not found" /> },
    ],
  },
])
