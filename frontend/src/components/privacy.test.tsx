import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Private, PrivacyProvider, PrivacyToggle } from "@/components/privacy"
import { TooltipProvider } from "@/components/ui/tooltip"

function renderAmounts() {
  return render(
    <PrivacyProvider>
      <TooltipProvider>
        <PrivacyToggle />
        <p>
          Balance <Private>$500.00</Private>
        </p>
      </TooltipProvider>
    </PrivacyProvider>
  )
}

/** The blurred wrapper, or null when amounts are shown as plain text. */
const blurred = () => document.querySelector(".blur-\\[0\\.45em\\]")
const paragraph = () => screen.getByText(/^Balance/)

describe("privacy", () => {
  it("hides amounts by default", () => {
    renderAmounts()

    expect(blurred()).toHaveTextContent("$500.00")
    expect(blurred()).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByText("hidden")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show amounts" })).toBeInTheDocument()
  })

  it("shows and hides amounts with the eye button", () => {
    renderAmounts()

    fireEvent.click(screen.getByRole("button", { name: "Show amounts" }))
    expect(blurred()).toBeNull()
    expect(paragraph()).toHaveTextContent("Balance $500.00")
    expect(screen.queryByText("hidden")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Hide amounts" }))
    expect(blurred()).toHaveTextContent("$500.00")
  })

  it("remembers the choice in this browser", () => {
    const first = renderAmounts()
    fireEvent.click(screen.getByRole("button", { name: "Show amounts" }))
    first.unmount()

    renderAmounts()
    expect(blurred()).toBeNull()
  })

  it("Private needs the provider", () => {
    expect(() => render(<Private>$1</Private>)).toThrow(/PrivacyProvider/)
  })
})
