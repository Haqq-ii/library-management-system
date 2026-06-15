"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

// Lightweight command-palette style component built without cmdk.
// Used by CheckoutSheet for member/book type-ahead search.

type CommandProps = React.HTMLAttributes<HTMLDivElement>

function Command({ className, ...props }: CommandProps) {
  return (
    <div
      data-slot="command"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}

type CommandInputProps = React.InputHTMLAttributes<HTMLInputElement>

function CommandInput({ className, ...props }: CommandInputProps) {
  return (
    <div data-slot="command-input-wrapper" className="flex items-center border-b px-3">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <input
        data-slot="command-input"
        className={cn(
          "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    </div>
  )
}

type CommandListProps = React.HTMLAttributes<HTMLDivElement>

function CommandList({ className, ...props }: CommandListProps) {
  return (
    <div
      data-slot="command-list"
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
      {...props}
    />
  )
}

type CommandEmptyProps = React.HTMLAttributes<HTMLDivElement>

function CommandEmpty({ className, ...props }: CommandEmptyProps) {
  return (
    <div
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: string
}

function CommandGroup({ className, heading, children, ...props }: CommandGroupProps) {
  return (
    <div
      data-slot="command-group"
      className={cn("overflow-hidden p-1 text-foreground", className)}
      {...props}
    >
      {heading && (
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
          {heading}
        </div>
      )}
      {children}
    </div>
  )
}

interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean
  onSelect?: () => void
}

function CommandItem({ className, disabled, onSelect, ...props }: CommandItemProps) {
  return (
    <div
      data-slot="command-item"
      role="option"
      aria-selected={false}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        disabled
          ? "pointer-events-none opacity-50"
          : "hover:bg-accent hover:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
}
