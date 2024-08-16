import { createPrompt, createSelection, type SelectionItem } from "bun-promptx";
import type { SkypeType } from "./type";
import { Spinner } from "@topcli/spinner";

import OpenAI from "openai";

const openaiClient = new OpenAI();

(async function main() {
  try {
    console.log("Hi! Welcome to the mini me project!");
    console.log(
      "Please make sure you stuck your skype export into the data directory"
    );

    console.log("------------------\n");
    const spinner = new Spinner().start("loading json data!");

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
    selectedConversation.MessageList.reverse();

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
        originalArrivalDate.getTime() - lastMessageTime.getTime() >
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
        " messages per chunk"
    );

    // format into openai conversations format for training
    const trainingData = messageChunks
      .map((chunk) => {
        let messages = chunk.map((message) => {
          return {
            role: message.from === messageData.userId ? "assistant" : "user",
            name:
              message.from !== messageData.userId && message.displayName
                ? message.displayName.replaceAll(" ", "")
                : undefined,
            content: message.content,
          };
        });

        // Keep removing the last message until the last one is from the assistant
        while (
          messages.length > 0 &&
          messages[messages.length - 1].role !== "assistant"
        ) {
          messages.pop();
        }

        return { messages };
      })
      // make sure there is more than one message and a message of both user and assistant role
      .filter(
        (conversation) =>
          conversation.messages.length > 1 &&
          conversation.messages.some((message) => message.role === "user") &&
          conversation.messages.some((message) => message.role === "assistant")
      );

    const trainingDataMapped = trainingData
      .map((conversation) => {
        return JSON.stringify(conversation);
      })
      .join("\n");

    const moderate = createPrompt(
      "do you want to run a moderation check? (y/n): "
    );

    if (moderate.error || moderate.value?.toLowerCase() != "y") {
      console.log(
        "\x1b[91m✘\x1b[0m It is a good idea to run this check to make sure you model doesn't get removed!"
      );

      // write training data to file
      const writingSpinner = new Spinner().start(
        "Writing training data to file..."
      );
      await Bun.write("data/training.jsonl", trainingDataMapped);
      writingSpinner.succeed(
        "Successfully wrote training data to data/training.jsonl!"
      );

      return;
    } else {
      console.log("\x1b[92m✔\x1b[0m Running check now!");
    }

    // run the training data through the moderation api
    const moderationSpinner = new Spinner().start(
      "Running moderation check..."
    );
    const moderationResults = await openaiClient.moderations.create({
      input: trainingData
        .map((conversations) => {
          conversations.messages
            .map((message) => {
              message.content;
            })
            .join("\n");
        })
        .join("\n---\n"),
    });
    if (moderationResults.results.some((result) => result.flagged === false)) {
      moderationSpinner.succeed("Moderation check complete!");
    } else {
      moderationSpinner.failed("Moderation check failed!");
      console.log(
        "The following conversations were flagged:",
        moderationResults.results
          .filter((result) => result.flagged)
          .map((result) => result.category_scores)
      );
      return;
    }

    // write training data to file
    const writingSpinner = new Spinner().start(
      "Writing training data to file..."
    );
    await Bun.write("data/training.jsonl", trainingDataMapped);
    writingSpinner.succeed(
      "Successfully wrote training data to data/training.jsonl!"
    );
  } catch (e) {
    console.error(e);
  }
})();
