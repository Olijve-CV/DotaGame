import type { Language } from "@dotagame/contracts";
import { DotaIntroSection } from "../components/DotaIntroSection";

export function DotaIntroPage(props: { locale: Language }) {
  return (
    <section className="stack">
      <DotaIntroSection locale={props.locale} />
    </section>
  );
}
