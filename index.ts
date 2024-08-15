import { createSelection, type SelectionItem } from "bun-promptx";
import type { SkypeType } from "./type";

console.log("Hi! Welcome to the mini me project!");
console.log(
  "Please make sure you stuck your skype export into the data directory"
);

console.log("------------------\n");

console.log("transforming the data into a valid training file!");
const messageData: SkypeType = await Bun.file("data/messages.json").json();

console.log(
  "You have",
  messageData.conversations.length,
  "conversations included in your export\n\n------------------\n"
);

const result = createSelection(
  messageData.conversations.map((conversation) => {
    return {
      text: conversation.id + ":",
      description: conversation.displayName || "null",
    };
  }) as SelectionItem[],
  {
    headerText: "Select the conversation you want to use as training data: ",
    perPage: 5,
    footerText: "Press enter when you are ready",
  }
);
if (result.error || result.selectedIndex === null) {
  console.error("Something went wrong:", result.error);
  process.exit(1);
}

const selectedConversation = messageData.conversations[result.selectedIndex];

console.log(
  "You selected",
  `\`${selectedConversation.displayName || selectedConversation.id}\``,
  "with",
  selectedConversation.MessageList.length,
  "messages in it"
);
