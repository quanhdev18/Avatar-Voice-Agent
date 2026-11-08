export type VocabEntry = {
  kanji?: string;
  kana: string;
  romaji: string;
  meaningVi: string;
  example?: string;
  exampleVi?: string;
};

export type GrammarPoint = {
  pattern: string;
  meaningVi: string;
  explanationVi: string;
  examples: { ja: string; romaji: string; vi: string }[];
};

export type DialogueLine = { speaker: string; ja: string; romaji: string; vi: string };

export type LessonContent = {
  objectivesVi: string[];
  vocab: VocabEntry[];
  grammar: GrammarPoint[];
  dialogue: DialogueLine[];
  rolePlayVi: string;
};

export type LessonSeed = {
  id: string;
  level: "N5";
  order: number;
  title: string;
  titleVi: string;
  content: LessonContent;
};
