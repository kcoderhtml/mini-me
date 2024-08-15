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
  "conversations included in your export"
);
