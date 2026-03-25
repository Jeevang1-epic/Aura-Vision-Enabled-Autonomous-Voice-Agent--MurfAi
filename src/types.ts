export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  status: 'active' | 'completed';
}

export interface LogEntry {
  id: string;
  sessionId: string;
  timestamp: string;
  type: 'voice' | 'vision' | 'system';
  role?: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  metadata?: {
    thumbnail?: string;
    [key: string]: any;
  };
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
