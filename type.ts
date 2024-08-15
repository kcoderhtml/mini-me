export type SkypeType = {
  userId: string;
  exportDate: Date;
  conversations: {
    id: string;
    displayName: string | null;
    version: number;
    properties: {
      conversationblocked: boolean;
      lastimreceivedtime: null;
      consumptionhorizon: null;
      conversationstatus: null;
    };
    threadProperties: null;
    MessageList: {}[];
  }[];
};
