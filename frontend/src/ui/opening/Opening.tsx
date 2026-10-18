import { useState } from "react";
import { LOOKS, ROBES, loadProfile, saveProfile, type Profile } from "../../game/profile";
import type { ClassId } from "../../types";
import { Story } from "./Story";
import { Title } from "./Title";
import { WhereYouStart } from "./WhereYouStart";
import { WhoAreYou } from "./WhoAreYou";
import "./opening.css";

export type OpeningStep = "title" | "who" | "where" | "story";

interface Props {
  start: OpeningStep;
  /** "Summer · tide 3" when there's a journey to continue. */
  saved: string | null;
  busy: boolean;
  error: string;
  onContinue: () => void;
  /** Create the run; resolves true once it exists. */
  onSail: (classId: ClassId) => Promise<boolean>;
}

const freshProfile = (): Profile => ({
  name: "",
  look: LOOKS[Math.floor(Math.random() * LOOKS.length)],
  robe: ROBES[0],
});

/** Title, then who you are, where you start and the story, then into the city. */
export function Opening({ start, saved, busy, error, onContinue, onSail }: Props) {
  const [step, setStep] = useState<OpeningStep>(start);
  const [profile, setProfile] = useState<Profile>(() => loadProfile() ?? freshProfile());
  const [classId, setClassId] = useState<ClassId>("first_of_their_line");

  if (step === "title") return <Title saved={saved} onNew={() => setStep("who")} onContinue={onContinue} />;
  if (step === "who")
    return <WhoAreYou profile={profile} onChange={setProfile} onBack={() => setStep("title")} onNext={() => setStep("where")} />;
  if (step === "where")
    return (
      <WhereYouStart
        profile={profile}
        chosen={classId}
        onChoose={setClassId}
        onBack={() => setStep("who")}
        onNext={() => setStep("story")}
      />
    );
  return (
    <Story
      profile={profile}
      classId={classId}
      busy={busy}
      error={error}
      onBack={() => setStep("where")}
      onSail={() => {
        saveProfile({ ...profile, name: profile.name.trim() });
        void onSail(classId);
      }}
    />
  );
}
