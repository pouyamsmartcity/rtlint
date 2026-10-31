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

export const rules = [
  physicalProperty,
  physicalValue,
  asymmetricShorthand,
  directionalValue,
  physicalUtility,
  directionalUtility,
  physicalStyle,
  dirAttribute,
  ltrInput,
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
  kashida,
  presentationForms,
  bidiControl,
];

export const ruleMap = new Map(rules.map((r) => [r.id, r]));
