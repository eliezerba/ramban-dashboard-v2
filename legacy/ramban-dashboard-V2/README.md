# דשבורד רמב"ן - גרסה 2

דשבורד מחקרי עצמאי לחקר היחסים בין פירוש הרמב"ן לתורה לבין פרשניו, על בסיס הנתונים הקיימים בתיקיית Data.

## 1. מה הדשבורד עושה
- קריאה לפי מקור: טקסט, גרפים, טבלת דמיון ומעבר לישויות קשורות.
- קריאה לפי פרשן: פריסה רוחבית, מדדים חוזרים, גרף אגרגטיבי וניווט למקורות.
- מבט כללי/אשכולות: זוגות דמיון, אשכולות, דגלי איכות ומעבר חזרה למקורות.

## 2. הפעלה למשתמש קצה
פתח את הקובץ:
- index.html

אין צורך להריץ שרת.
אין צורך להריץ build.

אפשר גם להפעיל דרך:
- INDEX.cmd
- INDEX.ps1

קבצי INDEX בגרסה 2 בודקים אוטומטית שיש data/data-index.js.
אם הקובץ חסר, הם מריצים בנייה מחדש דרך scripts/build-data-index.js ואז פותחים את index.html.

## 3. מבנה תיקייה
- index.html
- css/style.css
- js/
- data/
- data-index.json
- DATA_ANALYSIS.md
- scripts/build-data-index.js

## 4. איך בנויה תיקיית הנתונים
מקורות הנתונים החיצוניים:
- Data/E2_full_corpus: גרפים וטקסטים ברמת מקור-פרשן.
- Data/E3_comparative_analysis: מדדים, השוואות, פרופילי פרשנים ודמיון רוחבי.

הפלט המקומי של גרסה 2:
- data/data-index.js
- data/sections/section_<id>.js
- data/commentators/commentator_<id>.js
- data-index.json (עותק קריא חיצוני)

## 5. איך נוצר data-index.json
הפקה מתבצעת על ידי:
- scripts/build-data-index.js

הסקריפט:
1. קורא קבצי CSV/JSON מ-E2/E3.
2. ממפה מקורות, פרשנים, גרפים והשוואות.
3. בונה אינדקס ראשי + קבצי נתונים מפוצלים.
4. מייצר גם פורמט .js לטעינה ישירה בדפדפן ללא fetch.

## 6. עדכון נתונים כש-Data משתנה
לאחר שינוי ב-Data, יש להריץ מחדש:

```bash
cd "ramban-dashboard V2"
node scripts/build-data-index.js
```

ולאחר מכן לפתוח שוב את index.html.

## 6.1 אבחון מהיר במקרה של "אין DATA"
בדיקה ידנית:

```bash
cd "ramban-dashboard V2"
dir data\data-index.js
dir data\sections
dir data\commentators
```

אם data-index.js חסר:

```bash
cd "ramban-dashboard V2"
node scripts/build-data-index.js
```

ואז לפתוח שוב את INDEX.cmd או index.html.

## 7. העלאה עתידית ל-GitHub Pages
הפרויקט מותאם לקבצים סטטיים:
- כל הנתונים נטענים מקבצי .js מקומיים.
- אין תלות בשרת צד-שרת.

לכן ניתן להעלות את תוכן התיקייה כמו שהוא ל-GitHub Pages.

## 8. הערות אמינות
- אשכולות מוצגים ככלי עזר מחקרי, לא כהכרעה סופית.
- בחלק מהמקרים אין עוגן טקסטואלי מדויק לכל מושג.
- יש להתייחס לדגלי איכות (למשל THIN-RAMBAN, SPARSE/DIVERGENT) בזמן פרשנות.
