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
    MessageList: {
      id: string;
      displayName: string;
      originalarrivaltime: Date;
      messagetype: "RichText";
      version: number;
      content: string;
      conversationid: string;
      from: string;
      properties: null;
      amsreferences: null;
    }[];
  }[];
};
