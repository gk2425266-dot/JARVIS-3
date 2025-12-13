export enum AppState {
  IDLE = 'IDLE',
  REQUESTING_PERMISSION = 'REQUESTING_PERMISSION',
  LISTENING = 'LISTENING',
  ERROR = 'ERROR'
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  text: string;
}
