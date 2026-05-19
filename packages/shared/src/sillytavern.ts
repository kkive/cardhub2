/**
 * SillyTavern / TavernAI compatible character card types.
 * Reference: SillyTavern character card PNG metadata spec.
 */

export interface SillyTavernCard {
  /** Character name */
  name: string;
  /** Character description / personality */
  description: string;
  /** First message or greeting */
  first_mes: string;
  /** Example messages for AI context */
  mes_example: string;
  /** System prompt / personality note */
  system_prompt: string;
  /** Additional context / notes */
  creator_notes?: string;
  /** Character tags */
  tags?: string[];
  /** Character personality traits */
  personality?: string;
  /** Scenario / setting */
  scenario?: string;
  /** Avatar image (base64 or URL) */
  avatar?: string;
}

export interface TavernAICard {
  /** Character name */
  name: string;
  /** Character description */
  description: string;
  /** First message */
  first_mes: string;
  /** Example dialogue */
  mes_example: string;
  /** Personality */
  personality: string;
  /** Scenario */
  scenario: string;
  /** Creator comment */
  creatorcomment?: string;
  /** Tags */
  tags?: string[];
  /** Character version */
  char_version?: number;
  /** Spec version */
  spec?: string;
  /** Spec version number */
  spec_version?: string;
}

/**
 * SillyTavern V2 character card spec (chara_card_v2).
 * This is the latest format used by SillyTavern 1.12+.
 */
export interface SillyTavernV2Card {
  /** Must be "chara_card_v2" */
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes?: string;
    system_prompt?: string;
    tags?: string[];
    creator?: string;
    character_version?: string;
    extensions?: Record<string, unknown>;
  };
}

/**
 * Convert a SillyTavern card to our platform CardContent.data shape.
 */
export function sillyTavernToCardData(st: SillyTavernCard): Record<string, unknown> {
  return {
    name: st.name,
    description: st.description,
    firstMessage: st.first_mes,
    exampleMessages: st.mes_example,
    systemPrompt: st.system_prompt,
    personality: st.personality,
    scenario: st.scenario,
    tags: st.tags ?? [],
    creatorNotes: st.creator_notes,
  };
}

/**
 * Convert platform card data back to SillyTavern format.
 */
export function cardDataToSillyTavern(data: Record<string, unknown>): SillyTavernCard {
  return {
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    first_mes: String(data.firstMessage ?? ''),
    mes_example: String(data.exampleMessages ?? ''),
    system_prompt: String(data.systemPrompt ?? ''),
    personality: String(data.personality ?? ''),
    scenario: String(data.scenario ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    creator_notes: data.creatorNotes ? String(data.creatorNotes) : undefined,
  };
}

/**
 * Convert platform card data to SillyTavern V2 format.
 */
export function cardDataToSillyTavernV2(data: Record<string, unknown>): SillyTavernV2Card {
  return {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: String(data.name ?? ''),
      description: String(data.description ?? ''),
      personality: String(data.personality ?? ''),
      scenario: String(data.scenario ?? ''),
      first_mes: String(data.firstMessage ?? ''),
      mes_example: String(data.exampleMessages ?? ''),
      creator_notes: data.creatorNotes ? String(data.creatorNotes) : undefined,
      system_prompt: data.systemPrompt ? String(data.systemPrompt) : undefined,
      tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
      creator: data.creator ? String(data.creator) : undefined,
      character_version: data.characterVersion ? String(data.characterVersion) : undefined,
    },
  };
}

/**
 * Convert a SillyTavern V2 card to platform card data.
 */
export function sillyTavernV2ToCardData(st: SillyTavernV2Card): Record<string, unknown> {
  return {
    name: st.data.name,
    description: st.data.description,
    firstMessage: st.data.first_mes,
    exampleMessages: st.data.mes_example,
    systemPrompt: st.data.system_prompt ?? '',
    personality: st.data.personality,
    scenario: st.data.scenario,
    tags: st.data.tags ?? [],
    creatorNotes: st.data.creator_notes,
    creator: st.data.creator,
    characterVersion: st.data.character_version,
  };
}

/**
 * Convert platform card data to TavernAI format.
 */
export function cardDataToTavernAI(data: Record<string, unknown>): TavernAICard {
  return {
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    first_mes: String(data.firstMessage ?? ''),
    mes_example: String(data.exampleMessages ?? ''),
    personality: String(data.personality ?? ''),
    scenario: String(data.scenario ?? ''),
    creatorcomment: data.creatorNotes ? String(data.creatorNotes) : undefined,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    spec: 'chara_card_v1',
    spec_version: '1.0',
  };
}

/**
 * Convert a TavernAI card to platform card data.
 */
export function tavernAIToCardData(ta: TavernAICard): Record<string, unknown> {
  return {
    name: ta.name,
    description: ta.description,
    firstMessage: ta.first_mes,
    exampleMessages: ta.mes_example,
    personality: ta.personality,
    scenario: ta.scenario,
    tags: ta.tags ?? [],
    creatorNotes: ta.creatorcomment,
  };
}

export type ExportFormat = 'platform_json' | 'sillytavern_v2' | 'tavernai';
