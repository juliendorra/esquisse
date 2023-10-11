## Esquisse ✍️ 
## Quick prototyping of AI workflows one level or two above prompt engineering.

Esquisse is a light and quick tool when you need to prototype a generative AI workflow, one level or two above prompt engineering.

I (https://github.com/juliendorra) originally built this web-tool so my design students could prototype mini AI-apps in a couple of hours: _a fantasy football club generator, with logo and jersey; a user interview template that auto-update according to answers; an idea helper for products;_ and more!

### Why create this mini AI-app builder?

To give users a malleable and generic way to draft AI usages **one level or two up from just "prompting"**. Without code, my design students managed to build AI pipelines… and also asked for a few updates that I added and tested with them 😅

## Install and use

You can use Esquisse on you own computer by cloning and running the repo: [Local usage](#local-dev)

Or you can easily deploy on Deno Deploy: [Deploy](#deploy-on-deno-deploy)

You will need [OpenAI](https://platform.openai.com/) and [Stability](https://platform.stability.ai) API keys.

## How to create and share mini AI apps?

- Adds text and image generation blocks
- Reference and use the result from a text block in another text or image block top 'Data' cell by using either `#name` (no white space, for example a single word block name) or `[name of the block]` (white space allowed in the name of the block)
- You can mix and match several text results with static text: `head face [character for head] #style`
- ⟳ button refresh a block result by sending a new request
- The _structure_ of your AI cells is **saved in the URL**: names, data text, transform text. Share the URL to share the structure (not the results). You can go back to reload a previous structure.

## Set UI/UX Hints on blocks

- 📥 button set the block as an _entry_ block, only the data cell is writable.
- 🔒 button set the block as an _locked_ block, no cell is writable. 

These are purely UI/UX hints to help you organize your mini-app, and can be reversed any time.
These cells keeps updating normally when the results they reference update.

## Examples:

_Building an AI Cadavre Exquis app in 12 minutes (sped up!)_

https://github.com/juliendorra/esquisse/assets/109677/96162abe-a2eb-42b2-91e2-5df241a6722b


_[early version] Screenshot of a simple app that generates three images combining a character and scene as paintings from the the 16th, 17th and 19th century:_

<img width="50%" alt="screenshot of a simple app that generates three images combining a character and scene as paintings from the the 16th, 17th and 19th century" src="https://github.com/BenthamRealities/visi-llm/assets/109677/2d42c609-91b9-49de-80d2-839322a3faae">

_Students at Strate in the process of creating apps:_

<img width="50%"  src="https://github.com/BenthamRealities/visi-llm/assets/109677/9213c7fc-d86c-47ef-a9ce-a52fa3271394">

<img width="50%"  src="https://github.com/BenthamRealities/visi-llm/assets/109677/9faeded3-d248-4456-81e6-cce76358b28f">

## Local dev
- install Deno locally https://docs.deno.com/runtime/manual/
- clone the repo locally

- create your local .env file based on .env.SAMPLE
- add your OpenAI and Stability API keys
- add at least one local user
- for quick **local** dev you can copy the users from the .env.SAMPLE 

- `deno cache main.ts`
- `deno task dev`
- visit http://127.0.0.1:8000/ to use

## Deploy on Deno Deploy

The code has been written with deployement on Deno Deploy in mind, in a few easy steps:

### Environnement variables: API Keys and users
- Add your OpenAI and Stability API keys in your Deno Deploy Settings / Environnements Variables
- Add users for your instance. Prefixed user name as key and Bcrypt hashed password as value. 
- Prefix the user name with USER_
- You can use a tool like https://bcrypt.online to generate the password hashes

<img width="50%" alt="screenshot of Deno Deploy Settings / Environnements Variables with API keys and an user being added" src="https://github.com/juliendorra/esquisse/assets/109677/6ceef65e-02a4-4e69-8f01-066f5848e802">

### Deploy 
- link the repo in Deno Deploy Dashboard in automatic mode
- pick main.ts as the entry point
