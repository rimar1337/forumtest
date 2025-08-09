import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/callback/')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = useNavigate()
  navigate({to:"/"})
  return <div>Hello "/callback/"!</div>
}
