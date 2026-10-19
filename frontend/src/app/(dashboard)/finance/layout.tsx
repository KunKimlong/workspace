import { FinanceProvider } from "@/components/finance/finance-context"

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return <FinanceProvider>{children}</FinanceProvider>
}
