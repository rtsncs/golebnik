import { CardGameClientMessage } from './games/game';
import { LobbyClientMessage } from './lobby';
import { TableClientMessage } from './table';

export type ClientMessage =
  | LobbyClientMessage
  | TableClientMessage
  | CardGameClientMessage;
