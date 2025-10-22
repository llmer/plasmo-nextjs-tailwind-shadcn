import { useState } from "react"

import { Button } from "@/components/ui/button"

export function Main({ name = "Extension" }) {
  const [data, setData] = useState("")

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">
        Welcome to your <a href="https://www.plasmo.com" className="text-primary hover:underline">Plasmo</a> {name}!
      </h1>
      <input
        onChange={(e) => setData(e.target.value)}
        value={data}
        className="border border-input bg-background px-3 py-2 rounded-md"
        placeholder="Type something..."
      />

      <div className="flex gap-2">
        <Button>Default Button</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
      </div>

      <a href="https://docs.plasmo.com" className="text-primary hover:underline">
        READ THE DOCS!
      </a>
    </div>
  )
}
