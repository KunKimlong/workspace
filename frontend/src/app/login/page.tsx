"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { IconType } from "react-icons"
import {
  LuCircleAlert,
  LuEye,
  LuEyeOff,
  LuLoaderCircle,
  LuLock,
  LuMail,
} from "react-icons/lu"

import { useAuth } from "@/components/auth-provider"
import { FullPageLoader } from "@/components/full-page-loader"
import { Logo, LogoMark } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ApiError } from "@/lib/api"
import { APP_NAME } from "@/lib/site"
import { cn } from "@/lib/utils"

// Tells browsers and password managers (1Password, LastPass, Bitwarden, Dashlane)
// not to offer saved values or history for these fields.
const NO_AUTOFILL = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Keep the border/ring red on invalid fields even while focused (focus styles would otherwise win)
const INPUT_CLASSES =
  "h-12 rounded-xl text-base md:text-base aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:ring-destructive/25 dark:aria-invalid:border-destructive"

type Field = "email" | "password"
type FieldErrors = Partial<Record<Field, string>>

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!email.trim()) errors.email = "Email is required"
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address"
  if (!password) errors.password = "Password is required"
  return errors
}

// Bar heights (%) for the decorative chart sketch on the brand panel
const SKETCH_BARS = [38, 62, 24, 80, 46, 30, 92, 54, 20, 68, 40, 74, 34, 58]

/** Small sketch of the Finance page's daily-spending chart. Decorative only - no real data. */
function ChartSketch() {
  return (
    <div aria-hidden="true" className="w-full max-w-sm rounded-2xl bg-white p-5 text-zinc-900 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-2.5 w-20 rounded-full bg-zinc-200" />
          <div className="mt-2 h-4 w-28 rounded-full bg-zinc-800" />
        </div>
        <span className="rounded-full bg-[#8e51ff]/10 px-2.5 py-1 text-[11px] font-semibold text-[#7c3aed]">
          Daily spending
        </span>
      </div>
      <div className="relative mt-6 flex h-28 items-end gap-1.5">
        <div className="absolute inset-x-0 top-[35%] border-t border-dashed border-zinc-300" />
        {SKETCH_BARS.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-[4px] bg-[#eb6834]" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="mt-5 grid gap-2.5 border-t border-zinc-100 pt-4">
        {[64, 48, 56].map((w, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-2.5 rounded-full bg-zinc-200" style={{ width: `${w}%` }} />
            <div className="h-2.5 w-12 rounded-full bg-zinc-300" />
          </div>
        ))}
      </div>
    </div>
  )
}

function BrandPanel() {
  return (
    <div className="hidden bg-[#8e51ff] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 dark:bg-[oklch(0.25_0.07_292)]">
      <Logo className="text-lg" markClassName="size-10" inverted />

      <div>
        <h2 className="max-w-md text-[2.6rem] leading-[1.1] font-bold tracking-tight">
          Where did the money go this month?
        </h2>
        <p className="mt-4 max-w-sm text-base text-white/75">
          A small, private place to note the salary that comes in and the spending that goes out.
        </p>
        <div className="mt-12 -rotate-2">
          <ChartSketch />
        </div>
      </div>

      <p className="text-sm text-white/60">© {new Date().getFullYear()} {APP_NAME}</p>
    </div>
  )
}

/** Label + input row that turns red (label, border, icon) and shows its message when invalid. */
function FormField({
  id,
  label,
  icon: Icon,
  invalid,
  error,
  children,
}: {
  id: string
  label: string
  icon: IconType
  invalid: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} required className={cn("text-sm transition-colors", invalid && "text-destructive")}>
        {label}
      </Label>
      <div className="relative">
        <Icon
          className={cn(
            "pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 transition-colors",
            invalid ? "text-destructive" : "text-muted-foreground"
          )}
        />
        {children}
      </div>
      {error && (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-sm text-destructive">
          <LuCircleAlert className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

export default function LoginPage() {
  const { status, login } = useAuth()
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  /** Problems with a specific field (required, format, server validation). */
  const [errors, setErrors] = useState<FieldErrors>({})
  /** Wrong email/password: both fields turn red, the message is in the banner. */
  const [badCredentials, setBadCredentials] = useState(false)
  /** Banner message (bad credentials, server unreachable, ...). */
  const [formError, setFormError] = useState<string | null>(null)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Mask the password with CSS where supported (Chrome, Edge, Safari); otherwise fall back
  // to a regular password input so the value is never shown in plain text.
  const [cssMasking, setCssMasking] = useState(true)

  useEffect(() => {
    if (!CSS.supports("-webkit-text-security", "disc")) setCssMasking(false)
  }, [])

  useEffect(() => {
    if (status === "authenticated") router.replace("/")
  }, [status, router])

  const emailInvalid = !!errors.email || badCredentials
  const passwordInvalid = !!errors.password || badCredentials

  function focusFirstInvalid(fieldErrors: FieldErrors) {
    if (fieldErrors.email) emailRef.current?.focus()
    else if (fieldErrors.password) passwordRef.current?.focus()
  }

  /** Editing a field clears its own error and the shared bad-credentials state. */
  function clearErrorsFor(field: Field) {
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setBadCredentials(false)
    setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setBadCredentials(false)

    const clientErrors = validate(email, password)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length) {
      focusFirstInvalid(clientErrors)
      return
    }

    setSubmitting(true)
    try {
      await login(email.trim(), password)
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setErrors(err.fieldErrors)
        focusFirstInvalid(err.fieldErrors)
      } else if (err instanceof ApiError && err.status === 401) {
        setBadCredentials(true)
        setFormError("Incorrect email or password. Please try again.")
        setPassword("")
        passwordRef.current?.focus()
      } else {
        setFormError(err instanceof Error ? err.message : "Login failed. Please try again.")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (status !== "unauthenticated") return <FullPageLoader />

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <BrandPanel />

      <div className="relative flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <ThemeToggle className="absolute top-4 right-4" />

        <div className="w-full max-w-md">
          <LogoMark className="mb-8 size-14 lg:hidden" />

          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-2 text-base text-muted-foreground">Use the account set up for this workspace.</p>

          <form onSubmit={handleSubmit} autoComplete="off" noValidate className="mt-10 grid gap-6">
            {formError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <LuCircleAlert className="mt-0.5 size-5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <FormField id="login-email" label="Email" icon={LuMail} invalid={emailInvalid} error={errors.email}>
              <Input
                ref={emailRef}
                id="login-email"
                name="login-email"
                aria-required="true"
                type="text"
                inputMode="email"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                {...NO_AUTOFILL}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearErrorsFor("email")
                }}
                aria-invalid={emailInvalid}
                aria-describedby={errors.email ? "login-email-error" : undefined}
                className={cn(INPUT_CLASSES, "pl-11")}
                autoFocus
              />
            </FormField>

            <FormField
              id="login-password"
              label="Password"
              icon={LuLock}
              invalid={passwordInvalid}
              error={errors.password}
            >
              <Input
                ref={passwordRef}
                id="login-password"
                name="login-secret"
                aria-required="true"
                // Not type="password": browsers attach saved logins to any password input
                // and ignore autocomplete="off" there. The text is masked with CSS instead.
                type={cssMasking ? "text" : showPassword ? "text" : "password"}
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                {...NO_AUTOFILL}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  clearErrorsFor("password")
                }}
                // Block copying the hidden value out, like a real password field
                onCopy={(e) => !showPassword && e.preventDefault()}
                onCut={(e) => !showPassword && e.preventDefault()}
                aria-invalid={passwordInvalid}
                aria-describedby={errors.password ? "login-password-error" : undefined}
                className={cn(
                  INPUT_CLASSES,
                  "px-11",
                  cssMasking && !showPassword && "[-webkit-text-security:disc]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <LuEyeOff className="size-5" /> : <LuEye className="size-5" />}
              </button>
            </FormField>

            <Button type="submit" disabled={submitting} className="h-12 w-full rounded-xl text-base">
              {submitting && <LuLoaderCircle className="size-5 animate-spin" />}
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
