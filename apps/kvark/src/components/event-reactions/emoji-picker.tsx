import EmojiPickerReact, { Theme } from "emoji-picker-react";

type EmojiPickerProps = {
    theme: "light" | "dark";
    onPick: (emoji: string) => void;
};

/** Lastes lazy fra `reaction-picker-dialog.tsx` — se kommentaren der. */
export default function EmojiPicker({ theme, onPick }: EmojiPickerProps) {
    return (
        <EmojiPickerReact
            theme={theme === "dark" ? Theme.DARK : Theme.LIGHT}
            width="100%"
            lazyLoadEmojis
            onEmojiClick={(data) => onPick(data.emoji)}
        />
    );
}
