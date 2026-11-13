import { useState } from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

// Controlled dialog WITHOUT a DialogTrigger: the pattern used by the admin editor, onboarding and profile dialogs.
function ControlledDialogHarness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open editor
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Editor</DialogTitle>
          <DialogDescription>Fixture dialog</DialogDescription>
          <input aria-label="Notes" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

describe("DialogContent focus restoration", () => {
  it("returns focus to the element that opened a trigger-less dialog when it closes with Escape", async () => {
    const user = userEvent.setup()
    render(<ControlledDialogHarness />)

    const opener = screen.getByRole("button", { name: "Open editor" })
    await user.click(opener)
    await screen.findByRole("dialog")

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
  })

  it("returns focus to the opener when closed with the close button", async () => {
    const user = userEvent.setup()
    render(<ControlledDialogHarness />)

    const opener = screen.getByRole("button", { name: "Open editor" })
    await user.click(opener)
    await screen.findByRole("dialog")

    await user.click(screen.getByRole("button", { name: "Cerrar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
  })
})
