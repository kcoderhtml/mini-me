# Mini Me!

A project to make a mini you with openai 4-o

A demo of the cli and how to use it can be found here [on youtube](https://youtu.be/3RDaxo5k854)

## Steps

1. Get your skype data from [the skype data export page](https://secure.skype.com/en/data-export)
![the skype export page](https://github.com/kcoderhtml/mini-me/raw/master/.github/images/skype-export.png)
2. extract the `.tar` file it gives you and stick the json files you get into the `data` directory of this project
3. Run the cli with `bun run index.ts` and enjoy!
![the cli](https://github.com/kcoderhtml/mini-me/raw/master/.github/images/cli.png)
4. If you want to auto upload to openai or run a moderation check then please export your open ai api key or stick it in an env file:
```bash
OPENAI_API_KEY=sk-proj-xxxxxx-xxxxxxxx
```
