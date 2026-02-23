import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";

interface TagInputProps {
  label: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder: string;
}

export const TagInput = ({ label, tags, onAdd, onRemove, placeholder }: TagInputProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value.trim();
      if (value) {
        onAdd(value);
        (e.target as HTMLInputElement).value = "";
      }
    }
  };

  const handleClick = () => {
    const input = document.querySelector<HTMLInputElement>(`[data-tag-input="${label}"]`);
    if (input) {
      const value = input.value.trim();
      if (value) {
        onAdd(value);
        input.value = "";
      }
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, i) => (
            <Badge key={`${tag}-${i}`} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          data-tag-input={label}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
        />
        <Button type="button" variant="outline" size="icon" onClick={handleClick}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
