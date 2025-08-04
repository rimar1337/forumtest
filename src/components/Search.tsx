import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export function SearchBox() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (query.trim()) {
      navigate({ to: '/search', search: { q: query.trim() } })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search..."
        className=" text-sm my-2 w-full border border-gray-500 rounded-lg px-2 py-1 focus:outline-none focus:ring text-gray-50 bg-gray-800"
      />
    </form>
  )
}