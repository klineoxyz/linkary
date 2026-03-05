"use client";

import React, { useState } from "react";

const TOPICS = ["All", "Crypto", "Tech", "Community", "Music"];
const EVENT_TYPES = ["All", "X Spaces", "Roundtable", "AMA"];
const FORMATS = ["All", "Audio", "Video"];
const PLATFORMS = ["All", "X"];
const LANGUAGES = ["All", "English", "Spanish"];

type FilterSectionProps = {
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
};

function FilterSection({ title, options, selected, onSelect }: FilterSectionProps) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <input
              type="radio"
              name={title}
              checked={selected === opt}
              onChange={() => onSelect(opt)}
              className="rounded-full border-border text-primary focus:ring-primary/50"
            />
            <span className="text-sm text-foreground group-hover:text-primary transition-colors">
              {opt}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function FiltersRail() {
  const [topic, setTopic] = useState("All");
  const [eventType, setEventType] = useState("All");
  const [format, setFormat] = useState("All");
  const [platform, setPlatform] = useState("All");
  const [language, setLanguage] = useState("All");

  return (
    <aside className="w-full sm:w-52 shrink-0 border-r border-border bg-card rounded-2xl p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold text-foreground mb-4">Filters</h3>
      <FilterSection title="Topics" options={TOPICS} selected={topic} onSelect={setTopic} />
      <FilterSection title="Event type" options={EVENT_TYPES} selected={eventType} onSelect={setEventType} />
      <FilterSection title="Format" options={FORMATS} selected={format} onSelect={setFormat} />
      <FilterSection title="Platform" options={PLATFORMS} selected={platform} onSelect={setPlatform} />
      <FilterSection title="Language" options={LANGUAGES} selected={language} onSelect={setLanguage} />
    </aside>
  );
}
