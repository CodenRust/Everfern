import JokeDisplay from '@/components/JokeDisplay'

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-indigo-800">
          😂 Random Programming Jokes 😂
        </h1>
        <JokeDisplay />
      </div>
    </main>
  )
}