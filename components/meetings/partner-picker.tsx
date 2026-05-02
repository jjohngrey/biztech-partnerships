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

export interface PartnerOption {
  id: string;
  firstName: string;
  lastName: string;
  companyId: string | null;
  companyName: string | null;
}

interface PartnerPickerProps {
  partners: PartnerOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}

export function PartnerPicker({ partners, value, onChange, error }: PartnerPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Group by company
  const grouped = new Map<string, { companyName: string; partners: PartnerOption[] }>();
  const noCompany: PartnerOption[] = [];

  for (const p of partners) {
    const q = `${p.firstName} ${p.lastName} ${p.companyName ?? ""}`.toLowerCase();
    if (search && !q.includes(search.toLowerCase())) continue;

    if (p.companyId && p.companyName) {
      if (!grouped.has(p.companyId)) {
        grouped.set(p.companyId, { companyName: p.companyName, partners: [] });
      }
      grouped.get(p.companyId)!.partners.push(p);
    } else {
      noCompany.push(p);
    }
  }

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const selectedPartners = partners.filter((p) => value.includes(p.id));

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
              ? "Select partner attendees…"
              : `${value.length} partner${value.length === 1 ? "" : "s"} selected`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search by name or company…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No partners found.</CommandEmpty>
              {Array.from(grouped.entries()).map(([companyId, group]) => (
                <CommandGroup key={companyId} heading={group.companyName}>
                  {group.partners.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => toggle(p.id)}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${value.includes(p.id) ? "opacity-100" : "opacity-0"}`}
                      />
                      {p.firstName} {p.lastName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              {noCompany.length > 0 && (
                <CommandGroup heading="No company">
                  {noCompany.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => toggle(p.id)}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${value.includes(p.id) ? "opacity-100" : "opacity-0"}`}
                      />
                      {p.firstName} {p.lastName}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected chips */}
      {selectedPartners.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedPartners.map((p) => (
            <Badge key={p.id} variant="secondary" className="gap-1">
              {p.firstName} {p.lastName}
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="ml-1 rounded-full hover:bg-neutral-300"
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
