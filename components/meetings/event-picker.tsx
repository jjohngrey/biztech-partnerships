"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, X } from "lucide-react";

export interface EventOption {
  id: string;
  name: string;
  startDate: string;
  archived: boolean;
}

interface EventPickerProps {
  events: EventOption[];
  value: string[];
  onChange: (ids: string[]) => void;
}

export function EventPicker({ events, value, onChange }: EventPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeEvents = events.filter((e) => !e.archived);
  const archivedEvents = events.filter((e) => e.archived);

  const filter = (list: EventOption[]) =>
    search
      ? list.filter((e) =>
          e.name.toLowerCase().includes(search.toLowerCase())
        )
      : list;

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const selectedEvents = events.filter((e) => value.includes(e.id));

  const displayName = (e: EventOption) => {
    const year = new Date(e.startDate).getFullYear();
    return `${e.name} (${year})`;
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {value.length === 0
              ? "Select events… (optional)"
              : `${value.length} event${value.length === 1 ? "" : "s"} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search events…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No events found.</CommandEmpty>
              {filter(activeEvents).length > 0 && (
                <CommandGroup>
                  {filter(activeEvents).map((e) => (
                    <CommandItem
                      key={e.id}
                      value={e.id}
                      onSelect={() => toggle(e.id)}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${value.includes(e.id) ? "opacity-100" : "opacity-0"}`}
                      />
                      {displayName(e)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {filter(archivedEvents).length > 0 && (
                <CommandGroup heading="Archived">
                  {filter(archivedEvents).map((e) => (
                    <CommandItem
                      key={e.id}
                      value={e.id}
                      onSelect={() => toggle(e.id)}
                      className="text-neutral-400"
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${value.includes(e.id) ? "opacity-100" : "opacity-0"}`}
                      />
                      {displayName(e)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected chips */}
      {selectedEvents.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedEvents.map((e) => (
            <Badge key={e.id} variant="secondary" className="gap-1">
              {displayName(e)}
              <button
                type="button"
                onClick={() => toggle(e.id)}
                className="ml-1 rounded-full hover:bg-neutral-300 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
