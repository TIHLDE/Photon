import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";

type SearchInputProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    debounceMs?: number;
};

export function SearchInput({
    value,
    onChange,
    placeholder = "Søk...",
    debounceMs = 300,
}: SearchInputProps) {
    const [local, setLocal] = useState(value);

    useEffect(() => {
        setLocal(value);
    }, [value]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (local !== value) {
                onChange(local);
            }
        }, debounceMs);
        return () => clearTimeout(timer);
    }, [local, value, onChange, debounceMs]);

    return (
        <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder={placeholder}
                className="pl-9"
            />
        </div>
    );
}
