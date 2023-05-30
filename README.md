# <img width="128rem" style="border-radius: 0.4rem; vertical-align: middle;" src="https://github.com/BenthamRealities/visi-llm/assets/109677/ea817721-ff7c-4aae-939b-b625cf97bb40"> visi-llm — reactive LLM/Diffusion cells


### A light tool when you need to prototype a workflow one level or two above prompt engineering.

I (https://github.com/juliendorra) originally built this web-tool so my design students could prototype mini AI-apps in a couple of hours: _a fantasy football club generator, with logo and jersey; a user interview template that auto-update according to answers; an idea helper for products;_ and more!

### Why create this mini AI-app builder?
To give users a malleable and generic way to draft AI usages **one level or two up from just "prompting"**. Without code, my design students managed to build AI pipelines… and also asked for a few updates that I added and tested with them 😅

## Install and use

You can use the builder on you own computer by cloning and running the repo: [Local usage](#local-dev)

Or you can easily deploy on Deno Deploy: [Deploy](#deploy-on-deno-deploy)

## How to create and share mini AI apps?

- Adds text and image generation blocks
- Reference and use the result from a text block by using #[nameofthecell] in another block (text or image) top 'Data' cell. You can mix and match several text results and static text.
- ⟳ button refresh a block result by sending a new request
- The structure of your AI cells is saved in the URL: names, data text, transform text. Share the URL to share the structure (not the results). You can go back to reload a previous structure.

## Set UI/UX Hints on blocks

- 📥 button set the block as an _entry_ block, only the data cell is writable.
- 🔒 button set the block as an _locked_ block, no cell is writable. 

These cells keeps updating normally when the results they reference update: these are purely UI/UX hints, and can be reversed any time.

## Examples:

_Screenshot of a simple app that generates three images combining a character and scene as paintings from the the 16th, 17th and 19th century:_

<img width="50%" alt="screenshot of a simple app that generates three images combining a character and scene as paintings from the the 16th, 17th and 19th century" src="https://github.com/BenthamRealities/visi-llm/assets/109677/2d42c609-91b9-49de-80d2-839322a3faae">

_Students at Strate in the process of creating apps:_

<img width="50%"  src="https://github.com/BenthamRealities/visi-llm/assets/109677/9213c7fc-d86c-47ef-a9ce-a52fa3271394">

<img width="50%"  src="https://github.com/BenthamRealities/visi-llm/assets/109677/9faeded3-d248-4456-81e6-cce76358b28f">

## Local dev

- create .env based on .env.SAMPLE and add your OpenAI and Stability API keys
- `deno cache main.ts`
- `deno task dev`
- visit http://127.0.0.1:8000/ to use

## Deploy on Deno Deploy

The code has been written with deployement on Deno Deploy in mind, in a few easy steps:
- Add your OpenAI and Stability API keys in your Deno Deploy project
- link the repo in Deno Deploy Dashboard in automatic mode
- pick main.ts as the entry point
