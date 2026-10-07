import { PageHeader } from '../components/Layout'

/** Temporary page for routes built in later branches. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} subtitle="Coming soon." />
    </>
  )
}
