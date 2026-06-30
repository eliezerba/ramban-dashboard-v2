export function goToSection(appState, sectionId) {
  appState.currentSectionId = sectionId;
  appState.currentTab = 'by-source';
}

export function goToCommentator(appState, commentatorId) {
  appState.currentCommentatorId = commentatorId;
  appState.currentTab = 'by-commentator';
}
