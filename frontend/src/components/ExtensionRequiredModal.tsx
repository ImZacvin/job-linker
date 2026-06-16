import { useNavigate } from "react-router"
import { Puzzle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type Props = {
  open: boolean
}

export default function ExtensionRequiredModal({ open }: Props) {
  const navigate = useNavigate()

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-primary" />
            <DialogTitle>Extension not detected</DialogTitle>
          </div>
          <DialogDescription>
            Job Linker browser extension is required to scrape job listings from
            LinkedIn, SEEK, and Glints into your dashboard. Please install it to
            continue.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex justify-end gap-2">
          <Button onClick={() => navigate("/extension")}>
            Go to install instructions
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
