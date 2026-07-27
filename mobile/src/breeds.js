/**
 * Breed catalogue: reference text, localised names, and one photo per breed.
 *
 * Every screen that shows a breed goes through here, so a name is spelled the
 * same way in the shortlist, the registry, and the guide.
 *
 * The photos are bundled rather than fetched. The guide has to work in a shed
 * with no signal, and a picture of the animal is the fastest way for someone to
 * check the model against what is standing in front of them. They are built from
 * the training set by scripts/make_breed_images.py.
 */
import breedInfo from '../assets/breeds.json';
import { i18n, t } from './i18n';

const IMAGES = {
  Gir: require('../assets/breeds/gir.jpg'),
  Hariana: require('../assets/breeds/hariana.jpg'),
  Jaffarabadi: require('../assets/breeds/jaffarabadi.jpg'),
  Kankrej: require('../assets/breeds/kankrej.jpg'),
  Khillari: require('../assets/breeds/khillari.jpg'),
  Mehsana: require('../assets/breeds/mehsana.jpg'),
  Murrah: require('../assets/breeds/murrah.jpg'),
  'Nili-Ravi': require('../assets/breeds/nili-ravi.jpg'),
  Ongole: require('../assets/breeds/ongole.jpg'),
  Rathi: require('../assets/breeds/rathi.jpg'),
  'Red Sindhi': require('../assets/breeds/red-sindhi.jpg'),
  Surti: require('../assets/breeds/surti.jpg'),
};

// breeds.json stores origin and purpose once, in English, because they are a
// small closed set shared across breeds. Translating them by key keeps the
// reference data from carrying three copies of "Gujarat".
const ORIGIN_KEYS = {
  Gujarat: 'gujarat',
  Haryana: 'haryana',
  Maharashtra: 'maharashtra',
  Punjab: 'punjab',
  Rajasthan: 'rajasthan',
  Sindh: 'sindh',
  'Andhra Pradesh': 'andhraPradesh',
};

const PURPOSE_KEYS = {
  Dairy: 'dairy',
  Draught: 'draught',
  'Draught / Dairy': 'dual',
};

function translate(group, keys, value) {
  const key = keys[value];
  return key ? t(`guide.${group}.${key}`) : value;
}

export const originLabel = (origin) => translate('origins', ORIGIN_KEYS, origin);
export const purposeLabel = (purpose) => translate('purposes', PURPOSE_KEYS, purpose);

/** Breed names are proper nouns, so they live with the reference data. */
export function breedName(breed) {
  const names = breedInfo[breed]?.names;
  return names?.[i18n.locale] ?? names?.en ?? breed;
}

export function breedImage(breed) {
  return IMAGES[breed] ?? null;
}

export function breedAnimalType(breed) {
  return breedInfo[breed]?.animalType ?? 'cattle';
}

/** Pick the current language out of a `{ en, hi, mr }` block. */
export function localised(field, fallback) {
  return field?.[i18n.locale] ?? field?.en ?? fallback;
}

/** Every breed, cattle first, alphabetical within each group. */
export function listBreeds() {
  return Object.entries(breedInfo)
    .map(([key, info]) => ({
      key,
      ...info,
      displayName: breedName(key),
      originName: originLabel(info.origin),
      purposeName: purposeLabel(info.purpose),
      image: breedImage(key),
    }))
    .sort((a, b) => (a.animalType === b.animalType
      ? a.displayName.localeCompare(b.displayName)
      : a.animalType.localeCompare(b.animalType)));
}
