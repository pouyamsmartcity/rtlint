import { asymmetricShorthand, physicalProperty, physicalValue } from './css.js';
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
import { bidiControl } from './security.js';

export const rules = [
  physicalProperty,
  physicalValue,
  asymmetricShorthand,
  physicalUtility,
  directionalUtility,
  physicalStyle,
  dirAttribute,
  ltrInput,
  arabicLetters,
  arabicDigits,
  mixedDigits,
  zwnjPrefix,
  zwnjSuffix,
  zwnjInvalid,
  punctuation,
  spacing,
  kashida,
  bidiControl,
];

export const ruleMap = new Map(rules.map((r) => [r.id, r]));
