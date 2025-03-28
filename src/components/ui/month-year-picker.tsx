
import * as React from "react";
import { format, parse, setMonth, setYear } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthYearPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function MonthYearPicker({
  value,
  onChange,
  className,
  placeholder = "Selecione um mês/ano",
}: MonthYearPickerProps) {
  // Parse the initial value or use current date
  const initialDate = value 
    ? parse(value, "yyyy-MM", new Date()) 
    : new Date();
  
  const [date, setDate] = React.useState<Date>(initialDate);

  // Initialize with current year or from value
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 30 }, (_, i) => currentYear - 10 + i);
  
  // All months
  const months = Array.from({ length: 12 }, (_, i) => i);

  // Handle month change
  const handleMonthChange = (month: string) => {
    const newDate = setMonth(date, parseInt(month));
    setDate(newDate);
    onChange(format(newDate, "yyyy-MM"));
  };

  // Handle year change
  const handleYearChange = (year: string) => {
    const newDate = setYear(date, parseInt(year));
    setDate(newDate);
    onChange(format(newDate, "yyyy-MM"));
  };

  React.useEffect(() => {
    // Update the date state when the value prop changes
    if (value) {
      try {
        const parsedDate = parse(value, "yyyy-MM", new Date());
        setDate(parsedDate);
      } catch (error) {
        console.error("Error parsing date:", error);
      }
    }
  }, [value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(date, "MMMM yyyy", { locale: ptBR })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4 flex flex-col space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Mês</label>
              <Select
                value={date.getMonth().toString()}
                onValueChange={handleMonthChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Mês" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month} value={month.toString()}>
                      {format(new Date(2000, month, 1), "MMMM", { 
                        locale: ptBR 
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Ano</label>
              <Select
                value={date.getFullYear().toString()}
                onValueChange={handleYearChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
