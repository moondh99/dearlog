import { useDevModeStore } from '../../store/devModeStore'

export const isDemoMode = () => useDevModeStore.getState().isDemoMode
