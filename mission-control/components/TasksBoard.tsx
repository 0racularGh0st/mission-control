"use client"
import {useState} from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import {CSS} from '@dnd-kit/utilities'

function Card({id, title, assignee}:{id:string,title:string,assignee:string}){
  const {attributes, listeners, setNodeRef, transform, transition} = useSortable({id})
  const style = {transform: CSS.Transform.toString(transform), transition}
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="p-3 bg-gray-700 rounded">{title}<div className="text-xs text-gray-400">{assignee}</div></div>
  )
}

export default function TasksBoard(){
  const [todo, setTodo] = useState([])
  const [doing, setDoing] = useState([])
  const [done, setDone] = useState([])

  useEffect(()=>{
    fetch('/api/tasks').then(r=>r.json()).then(j=>{
      const t = j.tasks || {todo:[],doing:[],done:[]}
      setTodo(t.todo || [])
      setDoing(t.doing || [])
      setDone(t.done || [])
    }).catch(()=>{
      setTodo([{id:'t1',title:'Design UI',assignee:'Jarvis'}])
    })
  },[])

  const sensors = useSensors(useSensor(PointerSensor))

  async function persist(){
    await fetch('/api/tasks', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({tasks:{todo,doing,done}})})
  }

  function handleDragEnd(event:any){
    const {active, over} = event
    if(!over) return
    if(active.id===over.id) return
    // simple reorder within todo for demo
    setTodo((items)=>{
      const oldIndex = items.findIndex(i=>i.id===active.id)
      const newIndex = items.findIndex(i=>i.id===over.id)
      if(oldIndex===-1||newIndex===-1) return items
      const moved = arrayMove(items, oldIndex, newIndex)
      setTimeout(()=>persist(),200)
      return moved
    })
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <SortableContext items={todo} strategy={verticalListSortingStrategy}>
          <section className="bg-gray-800 p-4 rounded">
            <h3 className="font-semibold">To do</h3>
            <div className="mt-3 space-y-3">
              {todo.map(t=> <Card key={t.id} id={t.id} title={t.title} assignee={t.assignee} />)}
            </div>
          </section>
        </SortableContext>

        <section className="bg-gray-800 p-4 rounded">
          <h3 className="font-semibold">In progress</h3>
          <div className="mt-3 space-y-3">
            {doing.map(d=> <div key={d.id} className="p-3 bg-gray-700 rounded">{d.title}<div className="text-xs text-gray-400">{d.assignee}</div></div>)}
          </div>
        </section>
        <section className="bg-gray-800 p-4 rounded">
          <h3 className="font-semibold">Done</h3>
          <div className="mt-3 space-y-3">
            {done.map(d=> <div key={d.id} className="p-3 bg-gray-700 rounded">{d.title}<div className="text-xs text-gray-400">{d.assignee}</div></div>)}
          </div>
        </section>
      </div>
    </DndContext>
  )
}
