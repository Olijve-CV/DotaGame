import { useDeferredValue, useMemo, useState } from "react";
import type { HeroAvatarOption, Language } from "@dotagame/contracts";

const labels = {
  "zh-CN": {
    search: "搜索英雄头像",
    random: "随机分配",
    randomHint: "如果不手动选择，系统会为你随机分配一个英雄头像。",
    empty: "没有匹配到英雄，请换个关键词。"
  },
  "en-US": {
    search: "Search hero avatars",
    random: "Random pick",
    randomHint: "If you skip the choice, the system will assign one hero avatar for you.",
    empty: "No heroes matched this search."
  }
};

export function HeroAvatarPicker(props: {
  locale: Language;
  options: HeroAvatarOption[];
  selectedAvatarId: number | null;
  onSelect: (avatarHeroId: number | null) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const text = useMemo(() => labels[props.locale], [props.locale]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return props.options;
    }

    return props.options.filter((item) => item.name.toLowerCase().includes(normalizedQuery));
  }, [deferredQuery, props.options]);

  return (
    <section className="avatar-picker">
      <div className="avatar-picker-toolbar">
        <input
          disabled={props.disabled || props.loading}
          placeholder={text.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <button
        className={`avatar-option avatar-random${props.selectedAvatarId == null ? " selected" : ""}`}
        aria-pressed={props.selectedAvatarId == null}
        disabled={props.disabled || props.loading}
        onClick={() => props.onSelect(null)}
        type="button"
      >
        <span aria-hidden="true" className="avatar-option-status" />
        <span className="avatar-random-badge">?</span>
        <span className="avatar-option-copy">
          <strong>{text.random}</strong>
          <span className="avatar-option-note">{text.randomHint}</span>
        </span>
      </button>

      <div className="avatar-grid">
        {filteredOptions.map((item) => {
          const isSelected = props.selectedAvatarId === item.id;

          return (
            <button
              aria-pressed={isSelected}
              className={`avatar-option avatar-option-card${isSelected ? " selected" : ""}`}
              disabled={props.disabled || props.loading}
              key={item.id}
              onClick={() => props.onSelect(item.id)}
              type="button"
            >
              <span aria-hidden="true" className="avatar-option-status" />
              <span className="avatar-option-media">
                <img alt={item.name} loading="lazy" src={item.image} />
              </span>
              <span className="avatar-option-name">{item.name}</span>
            </button>
          );
        })}
      </div>

      {!props.loading && filteredOptions.length === 0 && <p className="muted">{text.empty}</p>}
    </section>
  );
}
