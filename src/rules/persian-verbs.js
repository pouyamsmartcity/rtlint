import { ZWNJ } from '../unicode.js';
import { eachPersianMatch } from './util.js';

// Common verb stems. A glued «می»/«نمی» is only reported when the rest of the
// word is one of these stems plus a personal ending, so nouns that merely
// start with «می» (میز، میدان، میوه، میلیون، میهمان، میان) are never touched.
const PRESENT = [
  'خواه', 'رو', 'کن', 'دان', 'توان', 'گو', 'گوی', 'گیر', 'آی', 'آ', 'بین', 'ده', 'زن', 'شو', 'آور',
  'نویس', 'خوان', 'پرس', 'رس', 'ساز', 'کش', 'گذار', 'گذر', 'فرست', 'پذیر', 'بر', 'دار', 'یاب',
  'نشین', 'خور', 'پوش', 'ریز', 'شکن', 'فهم', 'ترس', 'خند', 'گری', 'دو', 'پز', 'بند', 'کوش',
  'جنگ', 'رقص', 'شنو', 'ایست', 'افت', 'انداز', 'سوز', 'شناس', 'فروش', 'خر', 'گرد', 'گردان',
  'چرخ', 'پر', 'جه', 'مان', 'ران', 'بخش', 'بار', 'تاب', 'لرز', 'خواب', 'چین', 'کار', 'شمار',
  'ماند', 'پند', 'اندیش', 'آموز', 'آفرین', 'آزما', 'آرا', 'پاش', 'خراش', 'تراش', 'دوز', 'سپار',
  'گشا', 'نما', 'ستا', 'زا', 'پا', 'کاه', 'افزا', 'پیما', 'پوی', 'جو', 'شوی', 'روی', 'خیز', 'رسان',
  'نوش', 'چش', 'لغز', 'گنج', 'رنج', 'کوب', 'روب', 'فریب', 'ساب', 'تپ', 'چک', 'بوس', 'دزد',
];
const PAST = [
  'رفت', 'کرد', 'گفت', 'خواست', 'دانست', 'توانست', 'آمد', 'دید', 'داد', 'زد', 'شد', 'آورد',
  'نوشت', 'خواند', 'پرسید', 'رسید', 'ساخت', 'کشید', 'گذاشت', 'گذشت', 'فرستاد', 'داشت', 'یافت',
  'نشست', 'خورد', 'پوشید', 'ریخت', 'شکست', 'فهمید', 'ترسید', 'خندید', 'گریست', 'دوید', 'پخت',
  'بست', 'کوشید', 'جنگید', 'رقصید', 'شنید', 'ایستاد', 'افتاد', 'انداخت', 'سوخت', 'شناخت',
  'فروخت', 'خرید', 'گشت', 'گرداند', 'چرخید', 'پرید', 'جهید', 'ماند', 'راند', 'بخشید', 'بارید',
  'تابید', 'لرزید', 'خوابید', 'چید', 'کاشت', 'شمرد', 'اندیشید', 'آموخت', 'آفرید', 'آزمود',
  'گشود', 'نمود', 'افزود', 'پیمود', 'جست', 'شست', 'خاست', 'رساند', 'نوشید', 'برد', 'گرفت',
  'گردید', 'کاست', 'سپرد', 'دوخت', 'زیست', 'مرد', 'بود',
];
const PRESENT_ENDINGS = 'یم|ید|ند|م|ی|د';
const PAST_ENDINGS = 'یم|ید|ند|م|ی|';

// Glued forms that are also common words: میدانی is "field" (as in راهنمای میدانی).
const AMBIGUOUS = new Set(['میدانی']);

const byLength = (a, b) => b.length - a.length;
const GLUED = new RegExp(
  // rtlint-disable-next-line fa/* -- example or regex, not prose
  `(?<![\\p{L}\\p{M}\\u200C])(ن?می)(?:(${[...PRESENT].sort(byLength).join('|')})(${PRESENT_ENDINGS})|(${[...PAST].sort(byLength).join('|')})(${PAST_ENDINGS}))(?![\\p{L}\\p{M}\\u200C])`,
  'gu',
);

export const zwnjJoined = {
  id: 'fa/zwnj-joined',
  meta: {
    description:
      // rtlint-disable-next-line fa/* -- example or regex, not prose
      'The verb prefixes می/نمی written glued to the verb («میخواهم») need a zero-width non-joiner: «می\u200Cخواهم». Only known verb forms are touched.',
    fixable: true,
    level: 'warn',
  },
  check(file, report) {
    eachPersianMatch(file, GLUED, (m, index) => {
      if (AMBIGUOUS.has(m[0])) return;
      const prefix = m[1];
      const rest = m[0].slice(prefix.length);
      report({
        index,
        length: m[0].length,
        message: `"${m[0]}" glues the verb prefix "${prefix}" to the verb; use "${prefix}${ZWNJ}${rest}".`,
        fa: `در «${m[0]}» پیشوند «${prefix}» به فعل چسبیده؛ «${prefix}${ZWNJ}${rest}» بنویسید.`,
        fix: { range: [index + prefix.length, index + prefix.length], text: ZWNJ },
      });
    });
  },
};
