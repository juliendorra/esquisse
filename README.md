# <img width="128rem" style="border-radius: 0.4rem; vertical-align: middle;" src="https://github.com/BenthamRealities/visi-llm/assets/109677/9202bf9b-de1f-482c-b312-47669c776ece"> visi-llm — reactive LLM/Diffusion cells

### A light tool when you need to prototype a workflow one level or two above prompt engineering.

I originally built this web-tool so my design students could prototype mini AI-apps in a couple of hours: a fantasy football club generator, with logo and jersey; a user interview template that auto-update according to answers; an idea helper for products; and more!

**Why create this mini AI-app builder?** To give them something malleable and generic to draft AI usages **one level or two** up from just "prompting". Without code, they managed to build AI pipelines… and also asked for a few updates that I could add and test with them 😅

## Create and share mini AI apps 

- Adds text and image generation blocks
- Reference and use the result from a text block by using #[nameofthecell] in another block (text or image) top 'Data' cell. You can mix and match several text results and static text.
- ⟳ button refresh a block result by sending a new request
- The structure of your AI cells is saved in the URL: names, data text, transform text. Share the URL to share the structure (not the results). You can go back to reload a previous structure.

## UI/UX Hints

- 📥 button set the block as an _entry_ block, only the data cell is writable.
- 🔒 button set the block as an _locked_ block, no cell is writable. 

These cells keeps updating normally when the results they reference update: these are purely UI/UX hints, and can be reversed any time.

## Examples:

_Screenshot of a simple app that generates three images combining a character and scene as paintings from the the 16th, 17th and 19th century:_

<img width="50%" alt="screenshot of a simple app that generates three images combining a character and scene as paintings from the the 16th, 17th and 19th century" src="https://github.com/BenthamRealities/visi-llm/assets/109677/3b3b56c0-dacd-4618-8b40-646637319bc6">

_Students at Strate in the process of creating apps:_

<img width="50%"  src="https://github.com/BenthamRealities/visi-llm/assets/109677/61eca7e3-2e43-466f-bfe0-17600de69943">

<img width="50%"  src="https://github.com/BenthamRealities/visi-llm/assets/109677/603b4b68-c4dc-4019-bdb0-44d1415647bc">


