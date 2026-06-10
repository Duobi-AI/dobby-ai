export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = Exclude<ThemeMode, 'auto'>;

export type ContentType =
  | 'code'
  | 'foreign'
  | 'error'
  | 'math'
  | 'data'
  | 'email'
  | 'long'
  | 'default'
  | 'image';

export type CodeSubtype =
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'sql'
  | 'java'
  | 'c/c++'
  | 'ruby'
  | 'php';

export type ForeignSubtype =
  | 'japanese'
  | 'chinese'
  | 'korean'
  | 'arabic'
  | 'russian'
  | 'hindi'
  | 'thai';

export type ContentSubtype = CodeSubtype | ForeignSubtype | null;

export type DetectionResult = {
  type: ContentType;
  subType: ContentSubtype;
  confidence: number | 'high';
  wordCount?: number;
  charCount?: number;
};

export type Preset = {
  label: string;
  instruction: string;
};

export type PresetGroup = {
  suggested: Preset[];
  all?: Preset[];
};

export type PresetUsage = Record<string, Record<string, number>>;

export type AutosuggestPageContext = {
  pageTitle?: string;
  pageUrl?: string;
  fieldHint?: string;
  fieldLabel?: string;
  formFields?: string[];
  surroundingText?: string;
};

export type CaptureRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectionRect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width?: number;
  height?: number;
};
