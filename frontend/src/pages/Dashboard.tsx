import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/AuthContext"

export default function Dashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="flex items-center justify-between max-w-5xl mx-auto px-4 py-3">
          <h1 className="text-lg font-semibold">Job Linker</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.full_name}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex flex-col items-center justify-center text-center gap-2">
          <h2 className="text-2xl font-semibold">Dashboard</h2>
          <p className="text-muted-foreground">Coming soon</p>
        </div>
      </main>
    </div>
  )
}
