import { createPrompt, createSelection, type SelectionItem } from "bun-promptx";
import type { SkypeType } from "./type";
import { Spinner } from "@topcli/spinner";

(async function main() {
  try {
    console.log("Hi! Welcome to the mini me project!");
    console.log(
      "Please make sure you stuck your skype export into the data directory"
    );

    console.log("------------------\n");
    const spinner = new Spinner().start("loading json data!");
    await Bun.sleep(1000);

    const messageData: SkypeType = await Bun.file("data/messages.json").json();

    spinner.succeed(
      "You have " +
        messageData.conversations.length +
        " conversations included in your export"
    );
    console.log(
      "\x1b[92m✔\x1b[0m You have " +
        messageData.conversations.reduce(
          (total, conversation) => total + conversation.MessageList.length,
          0
        ) +
        " messages included in your export"
    );

    console.log("\n------------------\n");

    const result = createSelection(
      messageData.conversations.map((conversation) => {
        return {
          text: conversation.id + ":",
          description: conversation.displayName || "null",
        };
      }) as SelectionItem[],
      {
        headerText:
          "Select the conversation you want to use as training data: ",
        perPage: 5,
        footerText: "Press enter when you are ready",
      }
    );
    if (result.error || result.selectedIndex === null) {
      console.error("Something went wrong:", result.error);
      process.exit(1);
    }

    const selectedConversation =
      messageData.conversations[result.selectedIndex];

    console.log(
      "You selected",
      `\`${selectedConversation.displayName || selectedConversation.id}\``,
      "with",
      selectedConversation.MessageList.length,
      "messages in it"
    );

    console.log(
      "the data spans from",
      new Date(
        selectedConversation.MessageList[
          selectedConversation.MessageList.length - 1
        ].originalarrivaltime
      ).toDateString(),
      "to",
      new Date(
        selectedConversation.MessageList[0].originalarrivaltime
      ).toDateString(),
      "\n"
    );

    const confirm = createPrompt("is this what you want to use? (y/n): ");

    if (confirm.error || confirm.value?.toLowerCase() != "y") {
      console.log("\x1b[91m✘\x1b[0m Not converting to training data!");
      return;
    } else {
      console.log("\x1b[92m✔\x1b[0m Converting to training data!");
    }

    const chunkingSpinner = new Spinner().start(
      "Chunking your conversation into smaller conversations based on time between messages"
    );

    // split the messages up into chunks based on time between messages; if time is greater than 1 hour between messages than split it into a new array section
    const messageChunks: SkypeType["conversations"][0]["MessageList"][] = [];
    let currentChunk: SkypeType["conversations"][0]["MessageList"] = [];
    let lastMessageTime = new Date(
      selectedConversation.MessageList[0].originalarrivaltime
    );
    for (const message of selectedConversation.MessageList) {
      const originalArrivalDate = new Date(message.originalarrivaltime);
      if (
        lastMessageTime.getTime() - originalArrivalDate.getTime() >
        1000 * 60 * 60
      ) {
        messageChunks.push(currentChunk);
        currentChunk = [];
      }
      currentChunk.push(message);
      lastMessageTime = originalArrivalDate;
    }
    if (currentChunk.length > 0) messageChunks.push(currentChunk);

    // list how many chunks there are
    chunkingSpinner.succeed(
      "Successfully chunked into " +
        messageChunks.length +
        " sub conversations with an average of " +
        Math.round(
          messageChunks.reduce((total, chunk) => total + chunk.length, 0) /
            messageChunks.length
        ) +
        " messagess per chunk"
    );
  } catch (e) {
    console.error(e);
  }
})();
