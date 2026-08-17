import { lockCta, type CopyJson } from '@/lib/prompts';

function clipChars(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max).trim();
}

function clipWords(value: string, maxWords: number): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value.trim();
  return words.slice(0, maxWords).join(' ');
}

function hasCjk(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function mockVariation(base: CopyJson, index: number): CopyJson {
  const n = index + 1;
  const cjk = hasCjk(`${base.hook}${base.headline}${base.description}`);
  const hook = cjk ? `角度${n} ${base.hook}` : `Angle ${n}: ${base.hook}`;
  const headline = cjk ? `写法${n} ${base.headline}` : `Alt ${n} ${base.headline}`;
  const description = cjk
    ? `变体${n}。${base.description}`
    : `Variation ${n}. ${base.description}`;
  return {
    hook: clipChars(clipWords(hook, 10), 50),
    headline: clipChars(headline, 40),
    description: clipChars(description, 125),
    cta: lockCta(base.cta),
  };
}

export async function callGeminiJson(
  _systemPrompt: string,
  _userPrompt: string,
  baseCopy: CopyJson,
  index: number
): Promise<CopyJson> {
  // Mock until GEMINI_API_KEY works against AI Studio. Swap this body later.
  return mockVariation(baseCopy, index);
}
