import type { AdVariation, CopyElement } from '@/types/adVariation';
import { CREATIVE_FIELDS } from '../creativeFields';

export function buildCopyElementsPayload(
  variation: AdVariation,
  overrides?: Record<string, string>,
): CopyElement[] {
  const existingByKey = variation.copyElements.reduce<Record<string, CopyElement>>(
    (acc, elem) => {
      acc[elem.elementKey] = elem;
      return acc;
    },
    {},
  );

  return CREATIVE_FIELDS[variation.creativeType].map((field, index) => {
    const existing = existingByKey[field.key];
    const value = overrides?.[field.key] ?? existing?.value ?? '';
    const carouselLike =
      variation.creativeType === 'carousel' || variation.creativeType === 'collection';
    return {
      id: existing?.id,
      elementKey: field.key,
      value,
      position: carouselLike ? existing?.position ?? index + 1 : existing?.position,
      locale: existing?.locale,
      meta: existing?.meta,
    };
  });
}

export function buildUpdatePayload(
  variation: AdVariation,
  patch: Partial<AdVariation>,
  copyOverrides?: Record<string, string>,
) {
  return {
    ...patch,
    copyElements: buildCopyElementsPayload(variation, copyOverrides),
  };
}
