export const initialState = { attempt: null, drafts: {}, stage: 1, pending: false, message: null };
export function roundReducer(state, action) {
  switch (action.type) {
    case 'RESTORE':
      return { ...initialState, attempt: action.attempt, drafts: action.drafts || {}, stage: Math.min(action.attempt.current_stage || 1, 4) };
    case 'SYNC': {
      if (state.attempt && (action.attempt.id !== state.attempt.id || (action.attempt.revision || 0) < (state.attempt.revision || 0))) return state;
      return { ...state, attempt: action.attempt };
    }
    case 'EDIT':
      if (state.pending || state.attempt?.status !== 'IN_PROGRESS' || state.attempt?.stages[`stage${action.stage}`]?.status !== 'PENDING') return state;
      return { ...state, drafts: { ...state.drafts, [`stage${action.stage}`]: action.answer }, message: null };
    case 'STAGE':
      if (state.pending || (action.stage !== 4 && state.attempt?.stages[`stage${action.stage}`]?.status === 'LOCKED')) return state;
      return { ...state, stage: action.stage, message: null };
    case 'PENDING': return { ...state, pending: true, message: null };
    case 'MESSAGE': return { ...state, pending: false, message: action.message };
    default: return state;
  }
}
