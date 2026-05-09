'use client'

import { useState, useEffect } from 'react'

interface Joke {
  id: number
  setup: string
  delivery: string
  joke: string
  category: string
  type: 'single' | 'twopart'
  flags: {
    nsfw: boolean
    religious: boolean
    political: boolean
    racist: boolean
    sexist: boolean
  }
  lang: string
}

export default function JokeDisplay() {
  const [joke, setJoke] = useState<Joke | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [jokeType, setJokeType] = useState<'single' | 'twopart'>('twopart')

  const fetchJoke = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `https://v2.jokeapi.dev/joke/Programming?type=${jokeType}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch joke')
      }
      const data: Joke = await response.json()
      setJoke(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJoke()
  }, [jokeType])

  const handleNewJoke = () => {
    fetchJoke()
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex justify-center gap-4 mb-6">
        <button
          onClick={() => setJokeType('twopart')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            jokeType === 'twopart'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Two-Part Jokes
        </button>
        <button
          onClick={() => setJokeType('single')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            jokeType === 'single'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Single Jokes
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading joke...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <p className="text-red-700">Error: {error}</p>
          <button
            onClick={fetchJoke}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : joke ? (
        <div className="space-y-6">
          {joke.type === 'twopart' ? (
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-lg">
              <h2 className="text-xl font-semibold text-indigo-800 mb-4">Setup</h2>
              <p className="text-lg text-gray-800 mb-4 italic">{joke.setup}</p>
              <h3 className="text-xl font-semibold text-indigo-800 mb-4">Punchline</h3>
              <p className="text-lg text-gray-800 font-medium">{joke.delivery}</p>
            </div>
          ) : (
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-6 rounded-r-lg">
              <p className="text-lg text-gray-800 font-medium">{joke.joke}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-4 border-t">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
              Category: {joke.category}
            </span>
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              Language: {joke.lang}
            </span>
            {joke.flags.nsfw && (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                NSFW
              </span>
            )}
          </div>

          <button
            onClick={handleNewJoke}
            className="w-full mt-6 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-lg"
          >
            🎭 Get Another Joke
          </button>
        </div>
      ) : null}
    </div>
  )
}