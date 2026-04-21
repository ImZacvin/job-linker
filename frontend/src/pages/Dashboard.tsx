import KanbanBoard from "@/components/kanban/KanbanBoard"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between max-w-[1600px] mx-auto px-6 py-3">
          <h1 className="text-lg font-semibold">Job Linker</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.full_name}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold">Application Pipeline</h2>
          <p className="text-sm text-muted-foreground">
            Drag jobs between columns to update their status.
          </p>
        </div>
        <KanbanBoard />
      </main>
    </div>
  )
}
