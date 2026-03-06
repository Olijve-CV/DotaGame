import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { HeroAvatarOption, Language } from "@dotagame/contracts";
import { fetchHeroAvatars } from "../lib/api";
import { copyMap, HEROES_PER_PAGE, HERO_IMAGE_FALLBACKS, type RoleKey } from "./DotaIntroData";

export function DotaIntroSection(props: { locale: Language }) {
  const copy = copyMap[props.locale];
  const [avatars, setAvatars] = useState<HeroAvatarOption[]>([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(true);
  const [activeRole, setActiveRole] = useState<RoleKey>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedHeroName, setSelectedHeroName] = useState(copy.heroSpotlights[0]?.name ?? "");

  useEffect(() => {
    let active = true;
    setIsLoadingAvatars(true);
    fetchHeroAvatars()
      .then((items) => {
        if (active) {
          setAvatars(items);
        }
      })
      .catch(() => {
        if (active) {
          setAvatars([]);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingAvatars(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredHeroes = useMemo(() => {
    if (activeRole === "all") {
      return copy.heroSpotlights;
    }

    return copy.heroSpotlights.filter((hero) => hero.role === activeRole);
  }, [activeRole, copy.heroSpotlights]);

  const totalPages = Math.max(1, Math.ceil(filteredHeroes.length / HEROES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages - 1);

  const pagedHeroes = useMemo(() => {
    const start = safePage * HEROES_PER_PAGE;
    return filteredHeroes.slice(start, start + HEROES_PER_PAGE);
  }, [filteredHeroes, safePage]);

  const avatarMap = useMemo(
    () => new Map(avatars.map((item) => [item.name, item.image])),
    [avatars]
  );

  useEffect(() => {
    if (currentPage !== safePage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  useEffect(() => {
    if (pagedHeroes.some((hero) => hero.name === selectedHeroName)) {
      return;
    }

    setSelectedHeroName(pagedHeroes[0]?.name ?? copy.heroSpotlights[0]?.name ?? "");
  }, [copy.heroSpotlights, pagedHeroes, selectedHeroName]);

  const selectedHero =
    pagedHeroes.find((hero) => hero.name === selectedHeroName) ??
    pagedHeroes[0] ??
    filteredHeroes[0] ??
    copy.heroSpotlights[0];

  const selectedHeroImage = selectedHero
    ? avatarMap.get(selectedHero.name) ?? HERO_IMAGE_FALLBACKS[selectedHero.name]
    : undefined;

  function handleRoleFilter(role: RoleKey) {
    setActiveRole(role);
    setCurrentPage(0);
  }

  return (
    <section className="dota-intro panel">
      <div className="dota-intro-hero">
        <div>
          <p className="section-kicker">{copy.kicker}</p>
          <h2>{copy.title}</h2>
          <p className="dota-intro-summary">{copy.summary}</p>
        </div>

        <div className="dota-intro-facts">
          {copy.facts.map((fact) => (
            <article className="dota-fact-card" key={fact.label}>
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </article>
          ))}
        </div>
      </div>

      <div className="dota-intro-grid">
        <section className="dota-intro-block">
          <h3>{copy.gameplayTitle}</h3>
          <div className="dota-timeline">
            {copy.gameplaySteps.map((step) => (
              <article className="dota-timeline-card" key={step.phase}>
                <span>{step.phase}</span>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dota-intro-block">
          <h3>{copy.rolesTitle}</h3>
          <div className="dota-role-list">
            {copy.roles.map((role) => (
              <article className="dota-role-card" key={role.name}>
                <h4>{role.name}</h4>
                <p>{role.detail}</p>
                <span>{role.heroes}</span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="dota-intro-grid lower">
        <section className="dota-intro-block">
          <h3>{copy.skillsTitle}</h3>
          <div className="dota-skill-list">
            {copy.skills.map((skill) => (
              <article className="dota-skill-card" key={skill.name}>
                <strong>{skill.name}</strong>
                <p>{skill.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dota-intro-block">
          <h3>{copy.atlasTitle}</h3>
          <p className="dota-intro-summary compact">{copy.atlasSubtitle}</p>

          <div className="chip-row dota-role-filters">
            {copy.roleFilters.map((filter) => (
              <button
                className={activeRole === filter.key ? "active" : ""}
                key={filter.key}
                onClick={() => handleRoleFilter(filter.key)}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="dota-atlas-toolbar">
            <p className="dota-atlas-meta">
              {copy.atlasHeroesLabel}: {filteredHeroes.length}
            </p>
            {totalPages > 1 && (
              <div className="dota-atlas-pagination">
                <button disabled={safePage === 0} onClick={() => setCurrentPage((page) => page - 1)} type="button">
                  {copy.atlasPrevLabel}
                </button>
                <span>
                  {copy.atlasPageLabel} {safePage + 1} / {totalPages}
                </span>
                <button
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  type="button"
                >
                  {copy.atlasNextLabel}
                </button>
              </div>
            )}
          </div>

          {isLoadingAvatars && <p className="muted">{copy.atlasLoading}</p>}

          {selectedHero && (
            <div
              className="dota-spotlight"
              style={{ "--hero-accent": selectedHero.accent } as CSSProperties}
            >
              <article className="dota-spotlight-poster">
                <div className="dota-spotlight-overlay" />
                <div className="dota-spotlight-poster-head">
                  <span>{selectedHero.roleLabel}</span>
                  <h4>{selectedHero.name}</h4>
                </div>

                {selectedHeroImage ? (
                  <img
                    alt={selectedHero.name}
                    className="dota-spotlight-image"
                    src={selectedHeroImage}
                  />
                ) : (
                  <div className="dota-spotlight-placeholder">{selectedHero.name.slice(0, 2)}</div>
                )}

                <div className="dota-spotlight-stats">
                  <article>
                    <span>{copy.laneLabel}</span>
                    <strong>{selectedHero.lane}</strong>
                  </article>
                  <article>
                    <span>{copy.difficultyLabel}</span>
                    <strong>{selectedHero.difficulty}</strong>
                  </article>
                  <article>
                    <span>{copy.specialtyLabel}</span>
                    <strong>{selectedHero.specialty}</strong>
                  </article>
                  <article>
                    <span>{copy.timingLabel}</span>
                    <strong>{selectedHero.timing}</strong>
                  </article>
                </div>
              </article>

              <article className="dota-spotlight-details">
                <div className="dota-spotlight-section">
                  <span className="dota-spotlight-label">{copy.overviewLabel}</span>
                  <p>{selectedHero.overview}</p>
                </div>

                <div className="dota-spotlight-section">
                  <span className="dota-spotlight-label">{copy.skillsLabel}</span>
                  <div className="dota-skill-detail-list">
                    {selectedHero.skills.map((skill) => (
                      <article className="dota-skill-detail-card" key={`${selectedHero.name}-${skill.name}`}>
                        <strong>{skill.name}</strong>
                        <p>{skill.detail}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </article>
            </div>
          )}

          <div className="dota-gallery-grid">
            {pagedHeroes.map((hero) => {
              const heroImage = avatarMap.get(hero.name) ?? HERO_IMAGE_FALLBACKS[hero.name];
              const isSelected = hero.name === selectedHero?.name;

              return (
                <button
                  className={`dota-gallery-card${isSelected ? " selected" : ""}`}
                  key={hero.name}
                  onClick={() => setSelectedHeroName(hero.name)}
                  type="button"
                >
                  {heroImage ? (
                    <img alt={hero.name} className="dota-gallery-card-image" src={heroImage} />
                  ) : (
                    <span className="dota-gallery-card-placeholder">{hero.name.slice(0, 2)}</span>
                  )}
                  <span className="dota-gallery-card-name">{hero.name}</span>
                  <span className="dota-gallery-card-role">{hero.roleLabel}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
