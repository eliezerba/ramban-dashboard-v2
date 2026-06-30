# ניתוח תיקיית DATA עבור דשבורד רמב"ן - גרסה 2

## מצב מסמך
המסמך מתעד את מיפוי הנתונים שבוצע בפועל לפני בניית הממשק.

## 1. תמונת מצב כללית
- בתיקיית Data נמצאו 3355 קבצים.
- יש שני צירי נתונים מרכזיים:
  - E2_full_corpus: גרפים וטקסטים ברמת מקור-פרשן.
  - E3_comparative_analysis: תוצאות השוואה, מדדים רוחביים, פרופילי פרשנים וויזואליזציות מסכמות.
- קבצי הנחיה/הסבר: scholar_guide.pdf, scholar_guide.md, E3_coherence_analysis.md, E3_commentator_analysis.md, E3_corpus_analysis.md.

## 2. מיפוי E2_full_corpus
### 2.1 מבנה עיקרי
- manifest.json: מידע ריצה כללי על הפקת הגרפים.
- results.jsonl: שורות סטטוס לכל פריט מקור-פרשן (כולל counts).
- graphs/: תיקיות מסוג kg_<source>_<commentator>.

### 2.2 קבצי גרף בתוך כל kg_*
נתיב טיפוסי:
- C-1_O1/singleStepRelations/final_knowledge_graph.json
- C-1_O1/singleStepRelations/step_0_initial_graph.json
- C-1_O1/singleStepRelations/step_1_processed_subgraphs.json
- C-1_O1/singleStepRelations/step_2_consolidated_graph.json
- C-1_O1/singleStepRelations/step_3_merged_concepts.json
- C-1_O1/singleStepRelations/step_4_deduplicated_relations.json
- C-1_O1/singleStepRelations/knowledge_graph_visualization.html
- C-1_O1/singleStepRelations/concept_embeddings.parquet

### 2.3 שדות מרכזיים ב-final_knowledge_graph.json
- consolidated_graph.text: הטקסט המלא (רמב"ן או פרשן).
- consolidated_graph.concepts[]: רשימת צמתים (prefLabel, entity_type, description).
- consolidated_graph.relation_objects[]: קשתות וקשרי משמעות (predicate, evidence_text).

מסקנה: E2 הוא מקור האמת לגרף ולציטוטים הטקסטואליים בכל מקור/פרשן.

## 3. מיפוי E3_comparative_analysis
### 3.1 טבלאות מדדים ברמת מקור
- coherence_by_section.csv:
  - ramban_coherence, commentator_agreement, gap, flags ועוד.
- coverage.csv:
  - ספירות concepts/free/relations לכל מקור-פרשן + status.
- corpus_graph_metrics.csv:
  - מדדי רשת רוחביים.

### 3.2 השוואות ברמת מקור
- pairwise/<section>.json:
  - vs_ramban.<commentator>.align
  - shared / unique_commentary / unique_ramban

### 3.3 פרופילי פרשנים
- commentator/method_profile.csv
- commentator/source_profile.csv
- commentator/scriptural_range.csv
- commentator/commentator_structure.csv
- commentator/aggregate/<commentator>.json (גרף אגרגטיבי פרשן)

### 3.4 מבט כללי ואשכולות
- matrices/commentator_similarity.csv
- matrices/dendrogram.png
- overlap_viz/ (ויזואליזציות חתכים)

מסקנה: E3 הוא מקור האמת למדדים, תוצאות השוואה, פרופילים ואינדיקציות אשכול.

## 4. ישויות ליבה שנגזרו בפועל
- מקור: sectionId (למשל 14, 19_1).
- פרשן: commentatorId כפי שמופיע ב-E2/E3.
- השוואה: align + קבוצות מושגים משותפים/ייחודיים מ-pairwise.
- אשכול: נגזר ממטריצת commentator_similarity לפי סף דמיון; מוצג ככלי עזר, לא כהכרעה סופית.

## 5. ניהול אי-אחידות וחוסרים
- חלק מהמקורות כוללים מעט פרשנים בלבד.
- חלק מהגרפים מסומנים tiny/empty ב-coverage.
- קיימים קבצים עם תווים לא לטיניים ושמות הטרוגניים; נדרש נרמול מזהים.
- לא בכל מקום יש עוגן טקסטואלי מדויק לכל מושג; יש להציג זאת למשתמש כהסתייגות.

## 6. החלטות אינדוקס לגרסה 2
נבנה data-index.json עם:
- רשימת מקורות + metrics + קובץ נתונים לכל מקור.
- רשימת פרשנים + פרופילים + קובץ נתונים לכל פרשן.
- Top pairs + clusters + flag groups למבט כללי.
- קבצי משנה:
  - data/sections/section_<id>.js
  - data/commentators/commentator_<id>.js

הבחירה ב-.js (השמה ל-window) מאפשרת פתיחה ישירה של index.html בלי שרת.

## 7. מה חסר או חלקי
- אין שכבת grounding מלאה של כל מושג לכל טקסט בשורה מדויקת.
- אשכולות מוצגים כהסקה תומכת-נתונים ולא כמסקנה מחקרית מחייבת.
- תצוגת סימון בתוך הטקסט (highlight מדויק ברמת מילים/משפטים) זמינה רק בחלק מהשדות.

## 8. מסקנת ניתוח
הדאטה הקיים מספיק לבניית כלי מחקרי מלא ב-3 צירי קריאה:
- לפי מקור
- לפי פרשן
- מבט כללי/אשכולות

עם ניווט דו-כיווני מלא בין:
מקור <-> פרשן <-> גרף <-> טבלה <-> אשכול/מסקנה <-> טקסט.
