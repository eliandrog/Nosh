import { lazy, Suspense } from 'react'

// Loaded on demand so the map library (Leaflet) isn't part of the main bundle.
const FreeMealsPage = lazy(() => import('./FreeMealsPage'))

export function FreeMealsRoute() {
  return (
    <Suspense fallback={<p className="page-loading">Loading map…</p>}>
      <FreeMealsPage />
    </Suspense>
  )
}
