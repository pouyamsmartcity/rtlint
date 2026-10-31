// Persian descriptions of every rule, shown by `rtlint --list-rules --lang fa`
// and in the playground. Messages carry their own Persian text (`fa`).

export const LANGS = ['en', 'fa'];

export const DESCRIPTIONS_FA = {
  'css/physical-property':
    'ویژگی\u200Cهای فیزیکی مثل margin-left و left در صفحه\u200Cی راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشوند؛ نسخه\u200Cی منطقی\u200Cشان (margin-inline-start و inset-inline-start) خودش با جهت متن عوض می\u200Cشود.',
  'css/physical-value':
    'text-align، float و clear با مقدار left/right در راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشوند؛ start/end بنویسید.',
  'css/asymmetric-shorthand':
    'margin، padding، inset، border یا border-radius که برای چپ و راست مقدار متفاوت دارد، در راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشود.',
  'css/directional-value':
    'اختیاری: translate افقی، background-position و transform-origin به یک سمت صفحه بسته\u200Cاند و معمولاً یک نسخه\u200Cی راست\u200Cبه\u200Cچپ لازم دارند.',
  'class/physical-utility':
    'کلاس\u200Cهای Tailwind، UnoCSS و Bootstrap مثل ml-4، pr-2، left-0، text-left، border-l و rounded-r در راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشوند.',
  'class/directional-utility':
    'translate-x و origin-left (و با گزینه\u200Cی gradients، گرادیان\u200Cهای افقی) برای برعکس شدن یک نسخه\u200Cی rtl: لازم دارند.',
  'jsx/physical-style':
    'استایل\u200Cهای React، React Native و Vue با marginLeft، paddingRight یا textAlign: "left" در راست\u200Cبه\u200Cچپ برعکس نمی\u200Cشوند.',
  'html/dir-attribute':
    'تگ <html> با زبان راست\u200Cبه\u200Cچپ باید dir="rtl" داشته باشد؛ اگر زبان پویاست، dir هم باید پویا باشد.',
  'html/ltr-input':
    'فیلدهای ایمیل، آدرس و تلفن در صفحه\u200Cی فارسی به\u200Cهم می\u200Cریزند؛ dir="ltr" لازم دارند.',
  'icon/directional':
    'آیکون\u200Cهای جلو و عقب (فلش و شِورون چپ و راست) در راست\u200Cبه\u200Cچپ همان جهت قبلی را نشان می\u200Cدهند؛ باید آینه شوند.',
  'fa/arabic-letters':
    '«ي»، «ك» و «ى» عربی در متن فارسی جست\u200Cوجو، مرتب\u200Cسازی و نمایش را خراب می\u200Cکنند؛ «ی» و «ک» فارسی بنویسید.',
  // rtlint-disable-next-line fa/* -- describes the mistake
  'fa/arabic-digits': 'رقم\u200Cهای عربی (٤٥٦) در متن فارسی؛ رقم فارسی (۴۵۶) بنویسید.',
  // rtlint-disable-next-line fa/* -- describes the mistake
  'fa/mixed-digits': 'عددی که با ترکیب رقم لاتین و فارسی نوشته شده (مثل ۱۲3).',
  'fa/zwnj-prefix': 'پیشوند «می» و «نمی» با نیم\u200Cفاصله به فعل می\u200Cچسبد، نه با فاصله: «می\u200Cروم».',
  'fa/zwnj-joined':
    // rtlint-disable-next-line fa/* -- describes the mistake
    'پیشوند «می» و «نمی» که بدون فاصله به فعل چسبیده («میخواهم») نیم\u200Cفاصله لازم دارد: «می\u200Cخواهم». فقط فعل\u200Cهای شناخته\u200Cشده اصلاح می\u200Cشوند.',
  'fa/zwnj-suffix':
    'پسوندهایی مثل «ها»، «های»، «تر» و «ترین»، و «ای»، «ام»، «اند» یا کسره\u200Cی «ی» بعد از «ه»، با نیم\u200Cفاصله می\u200Cچسبند: «کتاب\u200Cها»، «خانه\u200Cی من».',
  'fa/zwnj-invalid':
    'نیم\u200Cفاصله\u200Cی تکراری یا بیرون از کلمه، و نویسه\u200Cهای ZWJ یا ZWSP که به\u200Cجای نیم\u200Cفاصله استفاده شده\u200Cاند.',
  'fa/punctuation': 'ویرگول، نقطه\u200Cویرگول و علامت سؤال لاتین بین کلمه\u200Cهای فارسی؛ «،»، «؛» و «؟» بنویسید.',
  'fa/punctuation-spacing': 'قبل از «،»، «؛»، «؟»، «!» و «.» و داخل گیومه\u200Cی «» فاصله نمی\u200Cآید.',
  'fa/kashida': 'کشیده (ـ) کلمه را کش می\u200Cدهد ولی جست\u200Cوجو و کپی را خراب می\u200Cکند؛ برای تراز کردن از text-align: justify استفاده کنید.',
  'text/presentation-forms':
    'حروف کپی\u200Cشده از PDF و نرم\u200Cافزارهای قدیمی (presentation forms) درست دیده می\u200Cشوند ولی جست\u200Cوجو و صفحه\u200Cخوان پیدایشان نمی\u200Cکنند؛ حروف معمولی بنویسید.',
  'security/bidi-control':
    'نویسه\u200Cهای نامرئی کنترل جهت که می\u200Cتوانند کد را طوری نشان دهند که با اجرای واقعی\u200Cاش فرق کند (Trojan Source، CVE-2021-42574).',
  'css/physical-transition':
    'فهرست transition و will-change که نام ویژگی فیزیکی دارد (margin-left، left و …) بعد از تبدیل به ویژگی منطقی دیگر انیمیشن ندارد.',
  'css/arabic-letter-spacing':
    'letter-spacing روی متن فارسی و عربی حروف به\u200Cهم\u200Cچسبیده را از هم جدا می\u200Cکند و برای خط عربی هیچ\u200Cوقت درست نیست.',
  'css/direction-property':
    'اختیاری: ویژگی direction در CSS جهت را ثابت می\u200Cکند؛ روش مطمئن، ویژگی dir در HTML (یا dir="auto") است.',
  'class/space-reverse':
    'اختیاری (Tailwind 3 و قبل\u200Cتر): space-x و divide-x سمت فیزیکی دارند و rtl:space-x-reverse یا rtl:divide-x-reverse لازم دارند.',
  'html/missing-lang':
    'تگ <html> بدون lang؛ مرورگر، فونت و صفحه\u200Cخوان نمی\u200Cفهمند صفحه فارسی یا عربی است.',
  'html/user-content-dir':
    'اختیاری: فیلد متن، textarea و بخش\u200Cهای قابل\u200Cویرایش که کاربر در آن\u200Cها فارسی یا انگلیسی می\u200Cنویسد باید dir="auto" داشته باشند.',
  'fa/space-after-punctuation':
    'بعد از «،»، «؛»، «؟» و «!» اگر کلمه\u200Cی فارسی بیاید، یک فاصله لازم است.',
  'fa/double-space':
    'بیش از یک فاصله بین کلمه\u200Cهای فارسی.',
  'fa/arrow-direction':
    // rtlint-disable-next-line fa/arrow-direction -- describes the mistake
    'فلش «→» در متن فارسی به عقب اشاره می\u200Cکند، چون فارسی از راست به چپ خوانده می\u200Cشود؛ «←» درست است.',
  'fa/ellipsis':
    'اختیاری: سه نقطه بعد از متن فارسی به نویسه\u200Cی «…» تبدیل می\u200Cشود.',
  'fa/percent-sign':
    'اختیاری: بعد از رقم فارسی، علامت درصد فارسی «٪» به\u200Cجای «%».',
  'fa/decimal-separator':
    'اختیاری: ممیز بین رقم\u200Cهای فارسی به ممیز فارسی «٫» تبدیل می\u200Cشود.',
  'fa/thousands-separator':
    'اختیاری: ویرگول بین گروه\u200Cهای سه\u200Cرقمی فارسی به جداکننده\u200Cی هزارگان «٬» تبدیل می\u200Cشود.',
  'fa/latin-digits':
    'اختیاری: رقم لاتین وسط جمله\u200Cی فارسی به رقم فارسی تبدیل می\u200Cشود (نه در کدهایی مثل 3D یا v2).',
  'fa/guillemets':
    'اختیاری، فقط در فایل\u200Cهای متنی: گیومه\u200Cی انگلیسی "" دور متن فارسی به «» تبدیل می\u200Cشود.',
  'text/invisible-characters':
    'نویسه\u200Cهای نامرئی (فاصله\u200Cی بی\u200Cعرض، اتصال\u200Cدهنده\u200Cی کلمه، BOM بی\u200Cجا) که جست\u200Cوجو، شکستن خط و مقایسه\u200Cی متن را خراب می\u200Cکنند.',
};
