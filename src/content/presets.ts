// Preset configurations per content type
// Enhanced in v1.1: sub-type-specific instructions + new content types

import { getReorderedPresets, buildTypeKey } from './shared/preset-usage.js';
import type {
  CodeSubtype,
  ContentSubtype,
  ContentType,
  ForeignSubtype,
  Preset,
  PresetGroup,
} from '../shared/types';

/**
 * PRESETS - Maps content type to suggested and additional presets
 * COMMON_PRESETS - Shared presets available for all content types
 * getAllPresetsForType(contentType, subType) - Returns merged preset list for a type
 * getSuggestedPresetsForType(contentType, subType) - Returns suggested presets (sub-type aware)
 */

// Sub-type specific preset overrides for code
export const CODE_SUBTYPE_PRESETS: Record<CodeSubtype, PresetGroup> = {
  javascript: {
    suggested: [
      { label: 'Explain this JavaScript', instruction: 'Explain the following JavaScript code' },
      { label: 'Debug this', instruction: 'Debug the following JavaScript code and identify any issues' },
      { label: 'Convert to TypeScript', instruction: 'Convert the following JavaScript code to TypeScript' },
    ],
    all: [
      { label: 'Add types', instruction: 'Add TypeScript type annotations to the following JavaScript code' },
      { label: 'Write tests', instruction: 'Write unit tests for the following JavaScript code' },
      { label: 'Optimize', instruction: 'Optimize the following JavaScript code' },
    ]
  },
  python: {
    suggested: [
      { label: 'Explain this Python', instruction: 'Explain the following Python code' },
      { label: 'Debug this', instruction: 'Debug the following Python code and identify any issues' },
      { label: 'Add type hints', instruction: 'Add type hints to the following Python code' },
    ],
    all: [
      { label: 'Write tests', instruction: 'Write unit tests for the following Python code' },
      { label: 'Optimize', instruction: 'Optimize the following Python code' },
      { label: 'Make Pythonic', instruction: 'Rewrite the following code to be more Pythonic' },
    ]
  },
  rust: {
    suggested: [
      { label: 'Explain this Rust', instruction: 'Explain the following Rust code' },
      { label: 'Debug this', instruction: 'Debug the following Rust code and identify any issues' },
      { label: 'Optimize', instruction: 'Optimize the following Rust code' },
    ],
    all: [
      { label: 'Write tests', instruction: 'Write unit tests for the following Rust code' },
      { label: 'Add docs', instruction: 'Add documentation comments to the following Rust code' },
    ]
  },
  go: {
    suggested: [
      { label: 'Explain this Go', instruction: 'Explain the following Go code' },
      { label: 'Debug this', instruction: 'Debug the following Go code and identify any issues' },
      { label: 'Optimize', instruction: 'Optimize the following Go code' },
    ],
    all: [
      { label: 'Write tests', instruction: 'Write unit tests for the following Go code' },
      { label: 'Add docs', instruction: 'Add GoDoc comments to the following Go code' },
    ]
  },
  sql: {
    suggested: [
      { label: 'Explain this SQL', instruction: 'Explain the following SQL query' },
      { label: 'Optimize query', instruction: 'Optimize the following SQL query for performance' },
      { label: 'Debug this', instruction: 'Debug the following SQL and identify any issues' },
    ],
    all: [
      { label: 'Add indexes', instruction: 'Suggest indexes for the following SQL query' },
      { label: 'Convert to...', instruction: 'Convert the following SQL to' },
    ]
  },
  java: {
    suggested: [
      { label: 'Explain this Java', instruction: 'Explain the following Java code' },
      { label: 'Debug this', instruction: 'Debug the following Java code and identify any issues' },
      { label: 'Optimize', instruction: 'Optimize the following Java code' },
    ],
    all: [
      { label: 'Write tests', instruction: 'Write unit tests for the following Java code' },
      { label: 'Add Javadoc', instruction: 'Add Javadoc comments to the following Java code' },
    ]
  },
  'c/c++': {
    suggested: [
      { label: 'Explain this C/C++', instruction: 'Explain the following C/C++ code' },
      { label: 'Debug this', instruction: 'Debug the following C/C++ code and identify any issues' },
      { label: 'Find memory issues', instruction: 'Check the following C/C++ code for memory leaks and safety issues' },
    ],
    all: [
      { label: 'Write tests', instruction: 'Write unit tests for the following C/C++ code' },
      { label: 'Optimize', instruction: 'Optimize the following C/C++ code' },
    ]
  },
  ruby: {
    suggested: [
      { label: 'Explain this Ruby', instruction: 'Explain the following Ruby code' },
      { label: 'Debug this', instruction: 'Debug the following Ruby code and identify any issues' },
      { label: 'Optimize', instruction: 'Optimize the following Ruby code' },
    ],
    all: [
      { label: 'Write tests', instruction: 'Write RSpec tests for the following Ruby code' },
      { label: 'Make idiomatic', instruction: 'Rewrite the following to be more idiomatic Ruby' },
    ]
  },
  php: {
    suggested: [
      { label: 'Explain this PHP', instruction: 'Explain the following PHP code' },
      { label: 'Debug this', instruction: 'Debug the following PHP code and identify any issues' },
      { label: 'Optimize', instruction: 'Optimize the following PHP code' },
    ],
    all: [
      { label: 'Write tests', instruction: 'Write PHPUnit tests for the following PHP code' },
      { label: 'Add types', instruction: 'Add type declarations to the following PHP code' },
    ]
  },
};

// Sub-type specific preset overrides for foreign languages
// Presets prioritize native-language actions (summarize, explain) over translation,
// since users selecting text in their own language usually want responses in that language.
// The system prompt instructs the AI to respond in the same language as the selected text.
function buildForeignPresets(language: string, label?: string): PresetGroup {
  return {
    suggested: [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Explain simply', instruction: 'Explain the following in simple terms' },
      { label: `Translate to English`, instruction: `Translate the following ${language} text to English` },
    ],
  };
}

export const FOREIGN_SUBTYPE_PRESETS: Record<ForeignSubtype, PresetGroup> = {
  japanese: buildForeignPresets('Japanese'),
  chinese: buildForeignPresets('Chinese'),
  korean: buildForeignPresets('Korean'),
  arabic: buildForeignPresets('Arabic'),
  russian: buildForeignPresets('Russian'),
  hindi: buildForeignPresets('Hindi'),
  thai: buildForeignPresets('Thai'),
};

export const PRESETS: Record<ContentType, PresetGroup> = {
  code: {
    suggested: [
      { label: 'Explain code', instruction: 'Explain the following code' },
      { label: 'Debug this', instruction: 'Debug the following code and identify any issues' },
      { label: 'Optimize', instruction: 'Optimize the following code' },
    ],
    all: [
      { label: 'Add types', instruction: 'Add type annotations to the following code' },
      { label: 'Write tests', instruction: 'Write unit tests for the following code' },
      { label: 'Convert to...', instruction: 'Convert the following code to' },
    ]
  },
  foreign: {
    suggested: [
      { label: 'Translate', instruction: 'Translate the following to English' },
      { label: 'Explain', instruction: 'Explain the following text' },
    ],
    all: []
  },
  error: {
    suggested: [
      { label: 'Explain error', instruction: 'Explain the following error and what caused it' },
      { label: 'Suggest fix', instruction: 'Suggest a fix for the following error' },
      { label: 'Find root cause', instruction: 'Analyze the following error and find the root cause' },
    ],
    all: [
      { label: 'Simplify message', instruction: 'Explain this error message in simple terms' },
    ]
  },
  email: {
    suggested: [
      { label: 'Draft reply', instruction: 'Draft a professional reply to the following email' },
      { label: 'Summarize email', instruction: 'Summarize the following email' },
      { label: 'Make professional', instruction: 'Rewrite the following email more professionally' },
    ],
    all: [
      { label: 'Extract action items', instruction: 'Extract action items from the following email' },
    ]
  },
  data: {
    suggested: [
      { label: 'Analyze data', instruction: 'Analyze the following data' },
      { label: 'Convert to table', instruction: 'Convert the following data to a formatted table' },
      { label: 'Summarize items', instruction: 'Summarize the following items' },
    ],
    all: [
      { label: 'Find patterns', instruction: 'Find patterns in the following data' },
    ]
  },
  math: {
    suggested: [
      { label: 'Explain formula', instruction: 'Explain the following formula or equation' },
      { label: 'Solve this', instruction: 'Solve the following mathematical problem' },
      { label: 'Simplify', instruction: 'Simplify the following mathematical expression' },
    ],
    all: [
      { label: 'Step by step', instruction: 'Solve the following step by step' },
    ]
  },
  long: {
    suggested: [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Key points', instruction: 'Extract the key points from the following' },
    ],
    all: []
  },
  default: {
    suggested: [
      { label: 'Summarize', instruction: 'Summarize the following' },
      { label: 'Explain simply', instruction: 'Explain the following in simple terms' },
    ],
    all: []
  },
  image: {
    suggested: [
      { label: 'Explain this image', instruction: 'Explain this image' },
      { label: 'Extract text from image', instruction: 'Extract all text from this image' },
      { label: 'Translate text in image', instruction: 'Translate any text in this image to English' },
    ],
    all: []
  }
};

export const COMMON_PRESETS: Preset[] = [
  { label: 'Summarize', instruction: 'Summarize the following' },
  { label: 'Explain', instruction: 'Explain the following' },
  { label: 'Translate', instruction: 'Translate the following to English' },
  { label: 'Rewrite', instruction: 'Rewrite the following more clearly' },
  { label: 'Expand', instruction: 'Expand on the following' },
  { label: 'Key points', instruction: 'Extract the key points from the following' },
];

/**
 * Returns suggested presets, using sub-type-specific ones when available.
 * @param {string} contentType
 * @param {string|null} subType
 * @returns {Array<{label: string, instruction: string}>}
 */
export function getSuggestedPresetsForType(contentType: ContentType, subType: ContentSubtype): Preset[] {
  let presets: Preset[];
  if (subType && contentType === 'code' && CODE_SUBTYPE_PRESETS[subType as CodeSubtype]) {
    presets = CODE_SUBTYPE_PRESETS[subType as CodeSubtype].suggested;
  } else if (subType && contentType === 'foreign' && FOREIGN_SUBTYPE_PRESETS[subType as ForeignSubtype]) {
    presets = FOREIGN_SUBTYPE_PRESETS[subType as ForeignSubtype].suggested;
  } else {
    presets = (PRESETS[contentType] || PRESETS['default']).suggested;
  }
  return getReorderedPresets(presets, buildTypeKey(contentType, subType));
}

/**
 * Returns all presets (type-specific + common) for a given content type and sub-type.
 * Deduplicates common presets against suggested and type-specific all presets.
 * @param {string} contentType
 * @param {string|null} [subType]
 * @returns {Array<{label: string, instruction: string}>}
 */
export function getAllPresetsForType(contentType: ContentType, subType: ContentSubtype = null): Preset[] {
  const suggested = getSuggestedPresetsForType(contentType, subType || null);

  let typeAll: Preset[];
  if (subType && contentType === 'code' && CODE_SUBTYPE_PRESETS[subType as CodeSubtype]) {
    typeAll = CODE_SUBTYPE_PRESETS[subType as CodeSubtype].all || [];
  } else {
    typeAll = PRESETS[contentType].all || [];
  }

  const labels = new Set([
    ...suggested.map(p => p.label),
    ...typeAll.map(p => p.label),
  ]);
  const common = COMMON_PRESETS.filter(p => !labels.has(p.label));
  return [...typeAll, ...common];
}
