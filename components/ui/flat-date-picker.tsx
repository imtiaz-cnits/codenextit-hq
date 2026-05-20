"use client";

import * as React from "react";
import { format, parse, setMonth, setYear, addMonths, subMonths, isValid } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Input } from "./input";

interface FlatDatePickerProps {
  date?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function FlatDatePicker({ date, onChange, placeholder = "Pick a date", className }: FlatDatePickerProps) {
  const [open, setOpen] = React.useState(false);
  // Current month/year for navigation
  const [month, setMonthDate] = React.useState<Date>(new Date());
  // Local string state for the year input so user can type freely (e.g. clear & retype)
  const [yearInput, setYearInput] = React.useState<string>(String(new Date().getFullYear()));

  // Parse the date string (YYYY-MM-DD) into a Date object
  const selectedDate = React.useMemo(() => {
    if (!date) return undefined;
    try {
      const parsed = parse(date, "yyyy-MM-dd", new Date());
      return isValid(parsed) ? parsed : undefined;
    } catch (e) {
      return undefined;
    }
  }, [date]);

  // Update navigation month when selection changes
  React.useEffect(() => {
    if (selectedDate) {
      setMonthDate(selectedDate);
    }
  }, [selectedDate]);

  // Keep year input in sync when month changes from any source other than typing
  React.useEffect(() => {
    setYearInput(String(month.getFullYear()));
  }, [month]);

  const handleSelect = (newDate: Date | undefined) => {
    if (newDate) {
      onChange(format(newDate, "yyyy-MM-dd"));
      setOpen(false); // Close after selection
    } else {
      onChange("");
    }
  };

  const handleMonthChange = (monthIdx: string) => {
    const newDate = setMonth(month, parseInt(monthIdx));
    setMonthDate(newDate);
  };

  const handleYearChange = (yearStr: string) => {
    // Allow free typing; only update month state when value is a valid 4-digit year in range
    setYearInput(yearStr);
    const year = parseInt(yearStr);
    if (yearStr.length === 4 && !isNaN(year) && year > 1900 && year < 2100) {
      const newDate = setYear(month, year);
      setMonthDate(newDate);
    }
  };

  const handleYearBlur = () => {
    // On blur, snap back to last valid year if input is invalid/empty
    const year = parseInt(yearInput);
    if (isNaN(year) || year <= 1900 || year >= 2100 || yearInput.length !== 4) {
      setYearInput(String(month.getFullYear()));
    }
  };

  const nextMonth = () => setMonthDate(addMonths(month, 1));
  const prevMonth = () => setMonthDate(subMonths(month, 1));

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={true}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          variant={"outline"}
          onClick={() => setOpen(true)}
          className={cn(
            "w-full justify-start text-left font-normal h-10 px-3",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selectedDate && isValid(selectedDate) ? format(selectedDate, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverPrimitive.Trigger>
      
      <PopoverPrimitive.Content 
        className="z-[9999] w-[280px] rounded-md border bg-popover p-0 text-popover-foreground shadow-xl outline-none" 
        align="start"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between p-2 border-b bg-muted/5">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-1">
            <Select 
              value={month.getMonth().toString()} 
              onValueChange={handleMonthChange}
            >
              <SelectTrigger className="h-8 w-[100px] text-[13px] font-bold border-none bg-transparent hover:bg-accent focus:ring-0 px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[10000]">
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={i.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Input
              type="number"
              className="h-8 w-[55px] text-[13px] font-bold px-1 border-none bg-transparent hover:bg-accent focus-visible:ring-0 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={yearInput}
              onChange={(e) => handleYearChange(e.target.value)}
              onBlur={handleYearBlur}
              onWheel={(e) => e.currentTarget.blur()}
              min={1901}
              max={2099}
            />
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="p-1 flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            month={month}
            onMonthChange={setMonthDate}
            initialFocus
            className="w-full"
            classNames={{
              month_caption: "hidden", 
              nav: "hidden",
              table: "w-full border-collapse",
              day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
            }}
          />
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
