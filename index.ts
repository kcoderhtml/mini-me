import { createPrompt, createSelection, type SelectionItem } from "bun-promptx";
import type { SkypeType } from "./type";
import { Spinner } from "@topcli/spinner";

import OpenAI from "openai";
import fs from "fs";

import { createObjectCsvWriter as createCsvWriter } from "csv-writer";

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

    if (
      confirm.error ||
      (confirm.value?.toLowerCase() != "y" && confirm.value)
    ) {
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

    // ask how many conversations the user wants 0 meaning all and filtering from the back
    const numConversations = createPrompt(
      "How many conversations do you want to use? (0 for all): "
    );

    let numConversationsValue: undefined | number = undefined;

    if (numConversations.error) {
      console.error("Something went wrong:", numConversations.error);
      return;
    } else if (numConversations.value === "0" || !numConversations.value) {
      console.log("\x1b[92m✔\x1b[0m Using all conversations!");
    } else {
      console.log(
        "\x1b[92m✔\x1b[0m Using the last",
        numConversations.value,
        "conversations!"
      );
      numConversationsValue = parseInt(numConversations.value);
    }

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
      )
      .slice(numConversationsValue ? -numConversationsValue : undefined);

    const trainingDataMapped = trainingData
      .map((conversation) => {
        return JSON.stringify(conversation);
      })
      .join("\n");

    const moderate = createPrompt(
      "do you want to run a moderation check? (y/n): "
    );

    if (
      moderate.error ||
      (moderate.value?.toLowerCase() != "y" && moderate.value)
    ) {
      console.log(
        "\x1b[91m✘\x1b[0m It is a good idea to run this check to make sure you model doesn't get removed!"
      );
    } else {
      console.log("\x1b[92m✔\x1b[0m Running check now!");

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
      if (
        moderationResults.results.some((result) => result.flagged === false)
      ) {
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
    }

    const trainingType = createSelection(
      [
        {
          text: "GPT-4o-mini-2024-07-18",
          description: "conversation format",
        },
        {
          text: "gemini-1.5-flash-001-tuning",
          description: "csv format",
        },
      ] as SelectionItem[],
      {
        headerText: "Select the model/datatype you want to export to: ",
        perPage: 5,
        footerText: "Press enter when you are ready",
      }
    );

    if (trainingType.error || trainingType.selectedIndex === null) {
      console.error("Something went wrong:", trainingType.error);
      return;
    }

    switch (trainingType.selectedIndex) {
      case 0:
        // write training data to file
        const writingSpinner = new Spinner().start(
          "Writing training data to file..."
        );
        await Bun.write("data/training.jsonl", trainingDataMapped);
        writingSpinner.succeed(
          "Successfully wrote training data to data/training.jsonl!"
        );

        // offer to upload the file
        const upload = createPrompt("do you want to upload the file? (y/n): ");
        if (upload.error || upload.value?.toLowerCase() != "y") {
          console.log("\x1b[91m✘\x1b[0m Not uploading the file!");
          return;
        } else {
          console.log("\x1b[92m✔\x1b[0m Uploading the file!");
        }

        const uploadSpinner = new Spinner().start("Uploading file...");
        let fileUploadId;
        try {
          const fileUpload = await openaiClient.files.create({
            purpose: "fine-tune",
            file: fs.createReadStream("data/training.jsonl"),
          });

          uploadSpinner.succeed(
            "Successfully uploaded file as " + fileUpload.id
          );
          fileUploadId = fileUpload.id;
        } catch (e) {
          uploadSpinner.failed("File upload failed");
          console.error(e);
          return;
        }

        // offer to start training
        const train = createPrompt("do you want to start training? (y/n): ");
        if (train.error || train.value?.toLowerCase() != "y") {
          console.log("\x1b[91m✘\x1b[0m Not starting training!");
          return;
        } else {
          console.log("\x1b[92m✔\x1b[0m Starting training!");
        }

        let wandbProject: null | string = null;
        // ask the user if they want to track this in a weights and biases project and if so than enter the name of it
        const wandb = createPrompt(
          "Do you want to track this in wandb? (y/n): "
        );
        if (wandb.error || wandb.value?.toLowerCase() != "y") {
          console.log("\x1b[91m✘\x1b[0m Not tracking in wandb!");
          return;
        } else {
          console.log("\x1b[92m✔\x1b[0m Tracking in wandb!");

          const wandbProjectPrompt = createPrompt(
            "Enter the name of the wandb project: "
          );
          if (wandbProjectPrompt.error) {
            console.error("Something went wrong:", wandbProjectPrompt.error);
            return;
          }

          wandbProject = wandbProjectPrompt.value;
        }

        const trainingSpinner = new Spinner().start("Starting training...");
        try {
          const training = await openaiClient.fineTuning.jobs.create({
            model: "gpt-4o-mini-2024-07-18",
            training_file: fileUploadId,
            integrations: wandbProject
              ? [
                  {
                    type: "wandb",
                    wandb: {
                      project: wandbProject,
                    },
                  },
                ]
              : [],
          });

          trainingSpinner.succeed(
            "Successfully started training as " + training.id
          );
        } catch (e) {
          trainingSpinner.failed("Training failed");
          console.error(e);
          return;
        }
        break;
      case 1:
        const exportSpinner = new Spinner().start("Exporting to csv...");
        // export the data to csv with an input column for all messages before the last assistant message
        const csvWriter = createCsvWriter({
          path: "data/training.csv",
          header: [
            { id: "input", title: "INPUT" },
            { id: "output", title: "OUTPUT" },
          ],
        });

        const csvData = trainingData.map((conversation) => {
          // make sure that the conversation doesn't exceed 50,000 characters and if it does then truncate from front
          let totalLength = conversation.messages
            .slice(0, -1)
            .map((message) => {
              return (
                "<" + (message.name || "assistant") + ">: " + message.content
              );
            })
            .join(" ").length;

          while (totalLength > 39900) {
            totalLength -= conversation.messages[0].content.length;
            conversation.messages.shift();
          }

          let input = conversation.messages
            .slice(0, -1)
            .map((message) => {
              return (
                "<" + (message.name || "assistant") + ">: " + message.content
              );
            })
            .join(" ");
          let output =
            conversation.messages[conversation.messages.length - 1].content;

          if (output.length > 4900) {
            output = output.slice(output.length - 4900);
          }

          return {
            input,
            output,
          };
        });

        await csvWriter.writeRecords(csvData);
        exportSpinner.succeed("Successfully exported to data/training.csv!");
        break;
    }
  } catch (e) {
    console.error(e);
  }
})();
