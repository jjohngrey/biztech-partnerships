"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center text-muted-foreground data-[variant=default]:rounded-lg data-[variant=default]:p-[3px] data-[variant=default]:group-data-[orientation=horizontal]/tabs:h-9 data-[variant=line]:gap-1 data-[variant=line]:rounded-none data-[variant=pill]:rounded-md data-[variant=pill]:border data-[variant=pill]:border-border data-[variant=pill]:p-0.5 data-[variant=pill]:text-[13px] data-[variant=row]:gap-1 sm:data-[variant=row]:gap-2 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "bg-transparent",
        pill: "bg-[#111113]",
        row: "bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-black transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:text-black dark:group-data-[variant=default]/tabs-list:data-[state=active]:border-input dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30 dark:group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground",
        // pill — bordered container with rounded active highlight (partnerships/events directory tab strips)
        "group-data-[variant=pill]/tabs-list:h-7 group-data-[variant=pill]/tabs-list:rounded group-data-[variant=pill]/tabs-list:border-transparent group-data-[variant=pill]/tabs-list:bg-transparent group-data-[variant=pill]/tabs-list:px-3 group-data-[variant=pill]/tabs-list:text-muted-foreground group-data-[variant=pill]/tabs-list:hover:text-foreground group-data-[variant=pill]/tabs-list:data-[state=active]:bg-foreground/8 group-data-[variant=pill]/tabs-list:data-[state=active]:text-foreground group-data-[variant=pill]/tabs-list:data-[state=active]:shadow-none",
        // row — loose row layout for the outreach directory tab strip
        "group-data-[variant=row]/tabs-list:h-8 group-data-[variant=row]/tabs-list:flex-none group-data-[variant=row]/tabs-list:gap-1.5 group-data-[variant=row]/tabs-list:rounded-md group-data-[variant=row]/tabs-list:border-transparent group-data-[variant=row]/tabs-list:bg-transparent group-data-[variant=row]/tabs-list:px-2.5 group-data-[variant=row]/tabs-list:text-[12px] group-data-[variant=row]/tabs-list:font-medium group-data-[variant=row]/tabs-list:text-muted-foreground group-data-[variant=row]/tabs-list:hover:bg-foreground/5 group-data-[variant=row]/tabs-list:hover:text-foreground group-data-[variant=row]/tabs-list:data-[state=active]:bg-foreground/10 group-data-[variant=row]/tabs-list:data-[state=active]:text-foreground group-data-[variant=row]/tabs-list:data-[state=active]:shadow-none sm:group-data-[variant=row]/tabs-list:gap-2 sm:group-data-[variant=row]/tabs-list:px-3",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
