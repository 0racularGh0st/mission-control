export default function Dashboard(){
  return (
    <div className="min-h-screen p-6">
      <h2 className="text-3xl font-semibold">Dashboard</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">Status Widgets (heartbeat)</div>
        <div className="p-4 bg-white dark:bg-gray-800 rounded shadow">Quick Commands (Cody)</div>
      </div>
    </div>
  )
}
