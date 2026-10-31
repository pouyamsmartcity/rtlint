import { asymmetricShorthand, directionalValue, physicalProperty, physicalValue } from './css.js';
import { directionalUtility, physicalUtility } from './classes.js';
import { physicalStyle } from './jsx.js';
import { dirAttribute, ltrInput } from './html.js';
import {
  arabicDigits,
  arabicLetters,
  kashida,
  mixedDigits,
  punctuation,
  spacing,
  zwnjInvalid,
  zwnjPrefix,
  zwnjSuffix,
} from './persian.js';
import { zwnjJoined } from './persian-verbs.js';
import { directionalIcon } from './icons.js';
import { presentationForms } from './text.js';
import { bidiControl } from './security.js';
import {
  arrowDirection,
  decimalSeparator,
  doubleSpace,
  ellipsis,
  guillemets,
  latinDigits,
  percentSign,
  spaceAfterPunctuation,
  thousandsSeparator,
} from './persian-extra.js';
import {
  arabicLetterSpacing,
  directionProperty,
  invisibleCharacters,
  missingLang,
  physicalTransition,
  spaceReverse,
  userContentDir,
} from './extra.js';

export const rules = [
  physicalProperty,
  physicalValue,
  asymmetricShorthand,
  directionalValue,
  physicalTransition,
  arabicLetterSpacing,
  directionProperty,
  physicalUtility,
  directionalUtility,
  spaceReverse,
  physicalStyle,
  dirAttribute,
  missingLang,
  ltrInput,
  userContentDir,
  directionalIcon,
  arabicLetters,
  arabicDigits,
  mixedDigits,
  zwnjPrefix,
  zwnjJoined,
  zwnjSuffix,
  zwnjInvalid,
  punctuation,
  spacing,
  spaceAfterPunctuation,
  doubleSpace,
  arrowDirection,
  kashida,
  ellipsis,
  percentSign,
  decimalSeparator,
  thousandsSeparator,
  latinDigits,
  guillemets,
  presentationForms,
  invisibleCharacters,
  bidiControl,
];

export const ruleMap = new Map(rules.map((r) => [r.id, r]));
