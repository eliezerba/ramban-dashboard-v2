const loadedScripts = new Set();

function loadScriptOnce(src) {
  if (loadedScripts.has(src)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      loadedScripts.add(src);
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed loading script: ${src}`));
    document.body.appendChild(script);
  });
}

async function loadSectionData(sectionMeta) {
  if (!sectionMeta || !sectionMeta.dataFile) {
    throw new Error('חסר מסלול נתונים למקור המבוקש.');
  }
  await loadScriptOnce(`./${sectionMeta.dataFile}`);
  return window.RAMBAN_V2_SECTIONS[sectionMeta.id] || null;
}

async function loadCommentatorData(commentatorMeta) {
  if (!commentatorMeta || !commentatorMeta.dataFile) {
    throw new Error('חסר מסלול נתונים לפרשן המבוקש.');
  }
  await loadScriptOnce(`./${commentatorMeta.dataFile}`);
  return window.RAMBAN_V2_COMMENTATORS[commentatorMeta.id] || null;
}

window.RV2DataLoader = {
  loadSectionData,
  loadCommentatorData,
};
