<div dir="rtl">

# راهنمای قانون‌های rtlint

هر قانون را می‌توانید در `rtlint.config.json` روی `"off"` (خاموش)، `"warn"` (هشدار) یا `"error"` (خطا) بگذارید. ستاره هم کار می‌کند: `"fa/*": "off"` همه‌ی قانون‌های فارسی را خاموش می‌کند. ✎ یعنی `--fix` خودکار درستش می‌کند.

[بازگشت به راهنمای فارسی](../README.fa.md) · [English](rules.md)

| قانون | پیش‌فرض | اصلاح خودکار |
| --- | --- | --- |
| [`css/physical-property`](#cssphysical-property) | هشدار | ✎ |
| [`css/physical-value`](#cssphysical-value) | هشدار | ✎ |
| [`css/asymmetric-shorthand`](#cssasymmetric-shorthand) | هشدار | ✎ |
| [`css/directional-value`](#cssdirectional-value) | خاموش (اختیاری) | |
| [`class/physical-utility`](#classphysical-utility) | هشدار | ✎ |
| [`class/directional-utility`](#classdirectional-utility) | هشدار | |
| [`jsx/physical-style`](#jsxphysical-style) | هشدار | ✎ |
| [`html/dir-attribute`](#htmldir-attribute) | خطا | ✎ |
| [`html/ltr-input`](#htmlltr-input) | هشدار | ✎ |
| [`icon/directional`](#icondirectional) | هشدار | |
| [`fa/arabic-letters`](#faarabic-letters) | خطا | ✎ |
| [`fa/arabic-digits`](#faarabic-digits) | هشدار | ✎ |
| [`fa/mixed-digits`](#famixed-digits) | هشدار | ✎ |
| [`fa/zwnj-prefix`](#fazwnj-prefix) | هشدار | ✎ |
| [`fa/zwnj-joined`](#fazwnj-joined) | هشدار | ✎ |
| [`fa/zwnj-suffix`](#fazwnj-suffix) | هشدار | ✎ |
| [`fa/zwnj-invalid`](#fazwnj-invalid) | هشدار | ✎ |
| [`fa/punctuation`](#fapunctuation) | هشدار | ✎ |
| [`fa/punctuation-spacing`](#fapunctuation-spacing) | هشدار | ✎ |
| [`fa/kashida`](#fakashida) | هشدار | ✎ |
| [`text/presentation-forms`](#textpresentation-forms) | خطا | ✎ |
| [`security/bidi-control`](#securitybidi-control) | خطا | |
| [`css/physical-transition`](#cssphysical-transition) | هشدار | ✎ |
| [`css/arabic-letter-spacing`](#cssarabic-letter-spacing) | خطا |  |
| [`css/direction-property`](#cssdirection-property) | خاموش (اختیاری) |  |
| [`class/space-reverse`](#classspace-reverse) | خاموش (اختیاری) | ✎ |
| [`html/missing-lang`](#htmlmissing-lang) | هشدار |  |
| [`html/user-content-dir`](#htmluser-content-dir) | خاموش (اختیاری) | ✎ |
| [`fa/space-after-punctuation`](#faspace-after-punctuation) | هشدار | ✎ |
| [`fa/double-space`](#fadouble-space) | هشدار | ✎ |
| [`fa/arrow-direction`](#faarrow-direction) | هشدار | ✎ |
| [`fa/ellipsis`](#faellipsis) | خاموش (اختیاری) | ✎ |
| [`fa/percent-sign`](#fapercent-sign) | خاموش (اختیاری) | ✎ |
| [`fa/decimal-separator`](#fadecimal-separator) | خاموش (اختیاری) | ✎ |
| [`fa/thousands-separator`](#fathousands-separator) | خاموش (اختیاری) | ✎ |
| [`fa/latin-digits`](#falatin-digits) | خاموش (اختیاری) | ✎ |
| [`fa/guillemets`](#faguillemets) | خاموش (اختیاری) | ✎ |
| [`text/invisible-characters`](#textinvisible-characters) | هشدار | ✎ |

---

## اول یک مفهوم: «فیزیکی» در برابر «منطقی»

در CSS، `left` و `right` **فیزیکی**‌اند؛ یعنی همیشه به چپ و راست صفحه اشاره می‌کنند. ولی در صفحه‌ی فارسی همه‌چیز آینه می‌شود: شروع متن سمت راست است و پایانش سمت چپ.

ویژگی‌های **منطقی** به جای چپ و راست می‌گویند «شروع» (start) و «پایان» (end). مرورگر خودش می‌داند در انگلیسی شروع یعنی چپ و در فارسی یعنی راست. پس با ویژگی‌های منطقی یک CSS برای هر دو زبان درست کار می‌کند. بیشتر قانون‌های چیدمان rtlint همین تبدیل را انجام می‌دهند.

| فیزیکی | منطقی |
| --- | --- |
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` |
| `padding-left` / `padding-right` | `padding-inline-start` / `padding-inline-end` |
| `left` / `right` | `inset-inline-start` / `inset-inline-end` |
| `text-align: left` | `text-align: start` |
| `border-top-left-radius` | `border-start-start-radius` |

---

## css/physical-property

ویژگی‌هایی مثل `margin-left` و `left` را به نسخه‌ی منطقی تبدیل می‌کند.

<div dir="ltr">

```css
.card { margin-left: 8px; }            /* قبل */
.card { margin-inline-start: 8px; }    /* بعد */
```

</div>

**دست نمی‌زند به:**
- کدی که مخصوص یک جهت نوشته شده: `[dir="rtl"] …`، `:dir(rtl)`، `.rtl &`، `@include rtl`، یا بعد از توضیح `/* rtl:ignore */` در RTLCSS.
- حاشیه‌ی صفحه‌ی چاپ (`@page`) و بخش‌های `@supports not`.
- map‌ها و ویژگی‌های تودرتوی Sass.
- `env(safe-area-inset-left)` که به ناچ گوشی بسته است.
- ترفند وسط‌چین `left: 50%` همراه `translate(-50%)`: فقط هشدار می‌دهد، چون تغییر نیمی از آن خرابش می‌کند.

## css/physical-value

`text-align`، `float` و `clear` با مقدار `left` یا `right`:

<div dir="ltr">

```css
text-align: left;   →   text-align: start;
float: right;       →   float: inline-end;
```

</div>

## css/asymmetric-shorthand

وقتی در یک خط برای چپ و راست مقدار متفاوت نوشته شده، در فارسی سمت اشتباه می‌افتد. rtlint آن را طوری می‌شکند که ظاهر انگلیسی دقیقاً همان بماند:

<div dir="ltr">

```css
padding: 0 26px 0 20px;
/* ↓ */
padding-block: 0; padding-inline: 20px 26px;
```

</div>

برای `border-radius` هم گوشه‌ها را منطقی می‌کند. در فایل‌های `.sass` و `.styl` و وقتی داخل مقدار توضیح (comment) باشد فقط گزارش می‌دهد.

## css/directional-value

**اختیاری است** (`"css/directional-value": "warn"`). مقدارهایی مثل `transform: translateX(20px)` و `background-position: left` را گزارش می‌دهد که معمولاً در فارسی باید برعکس شوند. اصلاح خودکار ندارد، چون جواب درست به منظور طراح بستگی دارد.

## class/physical-utility

کلاس‌های Tailwind، UnoCSS و Bootstrap:

| فیزیکی | منطقی |
| --- | --- |
| `ml-4` `mr-4` `pl-4` `pr-4` | `ms-4` `me-4` `ps-4` `pe-4` |
| `left-0` `right-0` | `start-0` `end-0` |
| `text-left` `text-right` | `text-start` `text-end` |
| `border-l-2` `rounded-tr-lg` | `border-s-2` `rounded-se-lg` |
| Bootstrap 4: `ml-md-3`، `float-left` | Bootstrap 5: `ms-md-3`، `float-start` |

پیشوندهایی مثل `md:hover:` و `!` و مقدارهای منفی حفظ می‌شوند. کلاس‌هایی که `rtl:` یا `ltr:` دارند، یا با شرطی مثل `isRtl ? 'mr-2' : 'ml-2'` انتخاب شده‌اند، عمدی‌اند و دست نمی‌خورند. به Tailwind نسخه‌ی ۳٫۳ به بالا یا Bootstrap 5 نیاز دارد.

## class/directional-utility

کلاس‌هایی مثل `translate-x-1` و `origin-left` چیزی را به یک سمت صفحه حرکت می‌دهند. اگر نسخه‌ی `rtl:` کنارشان نباشد، rtlint نسخه‌ی آینه‌شده را پیشنهاد می‌دهد؛ مثلاً برای `group-hover:translate-x-1` می‌گوید `rtl:group-hover:-translate-x-1` را اضافه کنید.

## jsx/physical-style

استایل‌های داخل کد در React، Vue و React Native:

<div dir="ltr">

```jsx
<div style={{ marginLeft: 8, textAlign: 'left' }} />              // قبل
<div style={{ marginInlineStart: 8, textAlign: 'start' }} />      // بعد
```

</div>

در React Native نام‌های مخصوص خودش (`marginStart`، `paddingEnd` و …) را می‌گذارد. به تعریف نوع‌های TypeScript و destructuring دست نمی‌زند.

## html/dir-attribute

`<html lang="fa">` بدون `dir="rtl"` کل صفحه را چپ‌به‌راست نشان می‌دهد. rtlint آن را اضافه می‌کند. اگر `lang` پویا باشد (مثل `lang={locale}` در Next.js) ولی `dir` نداشته باشد هم هشدار می‌دهد.

## html/ltr-input

فیلد `type="email"`، `type="url"` یا `type="tel"` در صفحه‌ی فارسی جهت راست‌به‌چپ می‌گیرد و `user@example.com` یا `+98 912…` به‌هم‌ریخته نمایش داده می‌شوند. rtlint `dir="ltr"` اضافه می‌کند.

## icon/directional

آیکون‌های «بعدی» و «قبلی» (`<ChevronRight>`، `fa-arrow-right`، `arrow_forward` و …) در فارسی باید برعکس شوند، چون «بعدی» در فارسی به چپ اشاره می‌کند. rtlint این آیکون‌ها را پیدا می‌کند و می‌گوید آینه‌شان کنید؛ مثلاً با `class="rtl:-scale-x-100"`. فلش‌های بالا و پایین و فلش مورب «لینک بیرونی» را گزارش نمی‌دهد.

## fa/arabic-letters

وقتی فارسی با صفحه‌کلید عربی تایپ شود، «ي» و «ك» عربی جای «ی» و «ک» فارسی می‌نشینند. ظاهرشان تقریباً یکی است، ولی برای کامپیوتر دو حرف متفاوت‌اند؛ پس جست‌وجو، مرتب‌سازی و حذف تکراری‌ها درست کار نمی‌کنند.

rtlint **فقط متن فارسی** را درست می‌کند. متن عربی (فایل `ar.json`، نقل‌قول عربی، آیه‌ها) و متن اردو، کردی، پشتو و سندی را تشخیص می‌دهد و دست نمی‌زند. در کد هم فقط متن‌هایی را بررسی می‌کند که شبیه جمله‌اند، نه جدول‌های تبدیل حروف.

## fa/arabic-digits

رقم‌های عربی مثل `٤٥٦` را به رقم فارسی ۴۵۶ تبدیل می‌کند. شکل رقم‌های ۴، ۵ و ۶ در این دو متفاوت است.

## fa/mixed-digits

عددی که با دو نوع رقم نوشته شده، مثل `۱۲3`، را یکدست فارسی می‌کند: ۱۲۳.

## fa/zwnj-prefix

پیشوند «می» و «نمی» با نیم‌فاصله به فعل می‌چسبد، نه با فاصله: `می روم` ← می‌روم. قبل از کلمه‌هایی مثل «و»، «که» و «را» اصلاح نمی‌کند.

## fa/zwnj-joined

همان پیشوند وقتی بدون هیچ فاصله‌ای به فعل چسبیده: `میخواهم` ← می‌خواهم، `نمیتوانم` ← نمی‌توانم. **فقط فعل‌های شناخته‌شده** را اصلاح می‌کند، پس «میز»، «میدان»، «میوه» و «میلیون» سالم می‌مانند. «میدانی» را هم رد می‌کند، چون می‌تواند صفت باشد (راهنمای میدانی).

## fa/zwnj-suffix

پسوندها با نیم‌فاصله می‌چسبند:

| اشتباه | درست |
| --- | --- |
| `کتاب ها` | کتاب‌ها |
| `بزرگ تر`، `بهترین ها` | بزرگ‌تر، بهترین‌ها |
| `خانه ای`، `رفته اند` | خانه‌ای، رفته‌اند |
| `خانه ی من` | خانه‌ی من |

«تر» به معنی «خیس» هم هست (`میوه تر`)، برای همین پیش‌فرض فقط بعد از صفت‌های رایج مثل «بزرگ»، «کم» و «سریع» می‌چسباند. با گزینه‌ی `{ "comparatives": "all" }` بعد از هر کلمه‌ای می‌چسباند و با `false` اصلاً نمی‌چسباند.

## fa/zwnj-invalid

نیم‌فاصله‌ی تکراری، نیم‌فاصله‌ای که کنار فاصله یا بیرون از کلمه افتاده و کاری نمی‌کند، و نویسه‌های ZWJ و ZWSP که اشتباهی به‌جای نیم‌فاصله گذاشته شده‌اند.

## fa/punctuation

ویرگول، علامت سؤال و نقطه‌ویرگول لاتین بین کلمه‌های فارسی را فارسی می‌کند: `,` ← «،»، `?` ← «؟»، `;` ← «؛». فقط وقتی هر دو طرف فارسی باشد. در فایل‌های CSV و فهرست‌های YAML (مثل `tags: [a, b]`) به ویرگول دست نمی‌زند.

## fa/punctuation-spacing

در فارسی قبل از «،»، «؛»، «؟»، «!» و «.» فاصله نمی‌آید، و داخل گیومه («») هم نه.

## fa/kashida

کشیده (ـ) کلمه را کش می‌دهد، ولی جست‌وجو و کپی را خراب می‌کند. برای تراز کردن متن از `text-align: justify` استفاده کنید.

## text/presentation-forms

متن کپی‌شده از PDF و نرم‌افزارهای قدیمی معمولاً با «شکل‌های نمایشی» حروف ذخیره می‌شود: نویسه‌هایی که شکل نهایی حرف را از قبل دارند. درست دیده می‌شوند، ولی جست‌وجو، مرتب‌سازی و صفحه‌خوان پیدایشان نمی‌کنند. rtlint آن‌ها را به حروف معمولی برمی‌گرداند. این قانون برای عربی و اردو هم کار می‌کند.

علامت ریال (﷼)، «ﷲ» و نشانه‌های قرآنی دست نمی‌خورند. فایل‌های کد هم پیش‌فرض بررسی نمی‌شوند، چون بعضی بازی‌ها عمداً از این حروف استفاده می‌کنند.

## security/bidi-control

نویسه‌های نامرئی کنترل جهت (U+202A تا U+202E و U+2066 تا U+2069) می‌توانند کد را طوری نشان دهند که با اجرای واقعی‌اش فرق کند. این حمله‌ی [Trojan Source](https://trojansource.codes/) (CVE-2021-42574) است.

- در فایل‌های کد، و بخش‌های `<script>` و `<style>` در Vue، Svelte و HTML، هر کدام از این نویسه‌ها گزارش می‌شود.
- در متن و ترجمه‌ها، که ممکن است عمداً استفاده شده باشند، فقط موارد خطرناک گزارش می‌شوند: نویسه‌های override و آن‌هایی که در همان خط بسته نشده‌اند.

اصلاح خودکار ندارد؛ هر مورد را باید یک نفر ببیند.

## css/physical-transition

`transition` و `will-change` نام ویژگی را می‌آورند. وقتی `margin-left` به `margin-inline-start` تبدیل شود، `transition: margin-left` دیگر انیمیشنی ندارد. این قانون نام داخل transition را هم منطقی می‌کند.

## css/arabic-letter-spacing

`letter-spacing` حروف به‌هم‌چسبیده‌ی فارسی را از هم جدا می‌کند. در بخش‌هایی که برای متن فارسی، عربی یا راست‌به‌چپ نوشته شده‌اند (`:lang(fa)`، `[dir="rtl"]`، `.rtl` و …) و برای کلاس‌های `rtl:tracking-*` در Tailwind گزارش می‌شود.

## css/direction-property

اختیاری. `direction` در CSS فقط ظاهر را عوض می‌کند؛ صفحه‌خوان و الگوریتم جهت متن به ویژگی `dir` در HTML تکیه می‌کنند. فیلدهای تلفن، ایمیل و کد گزارش نمی‌شوند.

## class/space-reverse

اختیاری، برای Tailwind 3 و قبل‌تر که `space-x-*` و `divide-x-*` سمت فیزیکی دارند. `rtl:space-x-reverse` را اضافه می‌کند. `rtlint init` اگر Tailwind 3 ببیند، خودش روشنش می‌کند.

## html/missing-lang

`<html>` بدون `lang`؛ مرورگر فونت و صفحه‌خوان صدای اشتباه انتخاب می‌کند. اصلاح خودکار ندارد، چون زبان را فقط خودتان می‌دانید.

## html/user-content-dir

اختیاری. فیلد متن، جست‌وجو، textarea و بخش‌های قابل‌ویرایش که کاربر هر زبانی در آن‌ها می‌نویسد، `dir="auto"` می‌گیرند تا نظر فارسی راست‌به‌چپ و نظر انگلیسی چپ‌به‌راست نمایش داده شود.

## fa/space-after-punctuation

<!-- rtlint-disable-next-line fa/space-after-punctuation -->
«سلام،دنیا» ← «سلام، دنیا». بعد از «،»، «؛»، «؟» و «!» اگر کلمه‌ی فارسی بیاید، یک فاصله می‌آید.

## fa/double-space

بیش از یک فاصله بین کلمه‌های فارسی به یک فاصله تبدیل می‌شود. به تورفتگی کد دست نمی‌زند.

## fa/arrow-direction

فارسی از راست به چپ خوانده می‌شود، پس «ادامه ←» به جلو اشاره می‌کند. فلش `→` در متن فارسی به «←» تبدیل می‌شود. فلش بین دو کلمه‌ی لاتین یا کد دست نمی‌خورد.

## fa/ellipsis

اختیاری. سه نقطه بعد از متن فارسی ← «…».

## fa/percent-sign

اختیاری. `۵۰%` ← ۵۰٪.

## fa/decimal-separator

اختیاری. `۱.۵` ← ۱٫۵. تاریخ‌هایی مثل `۱۴۰۳.۰۵.۱۲` دست نمی‌خورند.

## fa/thousands-separator

اختیاری. `۱,۲۵۰,۰۰۰` ← ۱٬۲۵۰٬۰۰۰.

## fa/latin-digits

اختیاری. رقم لاتینی که تنها وسط جمله‌ی فارسی آمده به رقم فارسی تبدیل می‌شود. کدهایی مثل `3D`، `v2` و `1080p` دست نمی‌خورند.

## fa/guillemets

اختیاری و فقط در فایل‌های متنی (`.md`، `.txt`، زیرنویس): گیومه‌ی انگلیسی دور متن فارسی به «» تبدیل می‌شود. در کد، JSON و HTML هیچ‌وقت، چون آن‌جا گیومه بخشی از کد است.

## text/invisible-characters

نویسه‌های نامرئی مثل فاصله‌ی بی‌عرض (U+200B)، اتصال‌دهنده‌ی کلمه (U+2060) و BOM وسط فایل حذف می‌شوند، چون جست‌وجو و مقایسه‌ی متن را خراب می‌کنند. BOM اول فایل، ایموجی‌های ترکیبی و نیم‌فاصله‌ی فارسی دست نمی‌خورند.

---

## خاموش کردن قانون در کد

در هر نوع توضیح (comment) کار می‌کند:

<div dir="ltr">

```css
/* rtlint-disable-next-line css/physical-property -- نمودار همیشه چپ‌به‌راست است */
.chart-axis { margin-left: 40px; }
```

</div>

دستورها: `rtlint-disable-next-line` (خط بعد)، `rtlint-disable-line` (همین خط)، `rtlint-disable` … `rtlint-enable` (یک بخش)، و `rtlint-disable-file` (کل فایل). بدون نام قانون، همه‌ی قانون‌ها خاموش می‌شوند. دستور باید داخل توضیح باشد؛ نوشتنش در متن عادی کاری نمی‌کند.

</div>
