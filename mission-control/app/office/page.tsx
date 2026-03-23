export default function Office(){
  return (
    <div>
      <h1 className="text-3xl font-bold">Office</h1>
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="p-6 bg-gray-800 rounded text-center">Jarvis<br/><div className="text-sm text-gray-400">Working</div></div>
        <div className="p-6 bg-gray-800 rounded text-center">Cody<br/><div className="text-sm text-gray-400">Idle</div></div>
      </div>
    </div>
  )
}
