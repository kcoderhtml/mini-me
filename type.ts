export type SkypeType = {
  userId: string;
  exportDate: string; // date format but in a string
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
      originalarrivaltime: string; // date format but actualy a string
      messagetype:
        | "RichText"
        | "RichText/UriObject"
        | "RichText/Media_Album"
        | "Event/BingBot"
        | "Event/Call"
        | "RichText/Media_GenericFile"
        | "RichText/Media_Video"
        | "RichText/Media_AudioMsg"
        | "Poll"
        | "RichText/Media_Card"
        | "RichText/ScheduledCallInvite"
        | "RichText/Media_CallRecording"
        | "RichText/Contacts"
        | "RichText/Location";
      version: number;
      content: string;
      conversationid: string;
      from: string;
      properties: null;
      amsreferences: null;
    }[];
  }[];
};
