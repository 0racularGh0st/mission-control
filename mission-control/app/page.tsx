import Link from 'next/link'

export default function Page() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-4xl font-bold">Mission Control — Jarvis</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-300">Local hub for tools, notes, and agents.</p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard" className="p-4 bg-white dark:bg-gray-800 rounded shadow hover:shadow-lg">Dashboard</Link>
          <Link href="/notes" className="p-4 bg-white dark:bg-gray-800 rounded shadow hover:shadow-lg">Notes</Link>
          <Link href="/tools" className="p-4 bg-white dark:bg-gray-800 rounded shadow hover:shadow-lg">Tools</Link>
        </div>
      </div>
    </main>
  )
}
