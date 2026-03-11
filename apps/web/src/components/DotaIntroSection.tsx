import { Link } from "react-router-dom";
import type { Language } from "@dotagame/contracts";
import { copyMap } from "./DotaIntroData";

export function DotaIntroSection(props: { locale: Language }) {
  const copy = copyMap[props.locale];

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
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Flow</p>
              <h3>{copy.gameplayTitle}</h3>
            </div>
          </div>

          <div className="dota-timeline">
            {copy.gameplaySteps.map((step, index) => (
              <article className="dota-timeline-card" key={step.phase}>
                <div className="dota-timeline-head">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step.phase}</strong>
                </div>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="dota-intro-block">
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Roles</p>
              <h3>{copy.rolesTitle}</h3>
            </div>
          </div>

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
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Skills</p>
              <h3>{copy.skillsTitle}</h3>
            </div>
          </div>

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
          <div className="section-heading compact">
            <div>
              <p className="section-kicker">Hero Atlas</p>
              <h3>{copy.atlasTitle}</h3>
            </div>
            <p className="dota-intro-summary compact">{copy.atlasSubtitle}</p>
          </div>

          <article className="dota-atlas-redirect-card">
            <div>
              <strong>{props.locale === "zh-CN" ? "英雄图谱已拆分为独立页面" : "The hero atlas now has its own page"}</strong>
              <p>
                {props.locale === "zh-CN"
                  ? "按主属性浏览整套英雄池，会比在新手指南里分页翻找更直接。"
                  : "Browse the roster by primary attribute instead of paging through it inside the guide."}
              </p>
            </div>
            <Link className="primary-btn" to="/heroes">
              {props.locale === "zh-CN" ? "打开英雄图谱" : "Open Hero Atlas"}
            </Link>
          </article>
        </section>
      </div>
    </section>
  );
}
