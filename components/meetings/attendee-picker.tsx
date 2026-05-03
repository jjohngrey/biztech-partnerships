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

export interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface AttendeePickerProps {
  users: UserOption[];
  currentUserId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}

export function AttendeePicker({
  users,
  currentUserId,
  value,
  onChange,
  error,
}: AttendeePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const currentUser = users.find((u) => u.id === currentUserId);
  const otherUsers = users.filter((u) => u.id !== currentUserId);

  const filtered = (list: UserOption[]) =>
    search
      ? list.filter((u) =>
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase())
        )
      : list;

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const selectedUsers = users.filter((u) => value.includes(u.id));

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
              ? "Select BizTech attendees…"
              : `${value.length} attendee${value.length === 1 ? "" : "s"} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search members…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No members found.</CommandEmpty>
              {/* Current user pinned at top */}
              {currentUser && filtered([currentUser]).length > 0 && (
                <CommandGroup heading="You">
                  <CommandItem
                    value={currentUser.id}
                    onSelect={() => toggle(currentUser.id)}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${value.includes(currentUser.id) ? "opacity-100" : "opacity-0"}`}
                    />
                    {currentUser.firstName} {currentUser.lastName}
                  </CommandItem>
                </CommandGroup>
              )}
              {filtered(otherUsers).length > 0 && (
                <CommandGroup heading="Team">
                  {filtered(otherUsers).map((u) => (
                    <CommandItem
                      key={u.id}
                      value={u.id}
                      onSelect={() => toggle(u.id)}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${value.includes(u.id) ? "opacity-100" : "opacity-0"}`}
                      />
                      {u.firstName} {u.lastName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected chips */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1">
              {u.firstName} {u.lastName}
              {u.id === currentUserId && (
                <span className="text-xs text-neutral-400"> (you)</span>
              )}
              <button
                type="button"
                onClick={() => toggle(u.id)}
                className="ml-1 rounded-full hover:bg-neutral-300 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
